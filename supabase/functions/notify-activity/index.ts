// SplitStream — notify-activity Edge Function (v1.1)
//
// Called by a Database Webhook on INSERT into activity_log (setup steps in
// the repo README / phase6 notes). Fans the event out as Expo push
// notifications to every group member EXCEPT the actor.
//
// Deploy:   supabase functions deploy notify-activity --no-verify-jwt
// Secret:   set WEBHOOK_SECRET in the function's secrets and send the same
//           value in the webhook's "x-webhook-secret" header.

import { createClient } from "jsr:@supabase/supabase-js@2";

interface ActivityRecord {
  id: string;
  group_id: string;
  actor_id: string | null;
  action: string;
  details: { description?: string; amount?: number };
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  // Service role: needs to read all members' push tokens; RLS is bypassed.
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function describe(action: string, actor: string, details: ActivityRecord["details"]): string {
  const what = details.description ?? "an expense";
  const amount = details.amount !== undefined ? `₹${details.amount.toFixed(2)}` : "";
  switch (action) {
    case "expense_added":
      return `${actor} added ${amount} for ${what}`;
    case "expense_edited":
      return `${actor} edited ${what}${amount ? ` (now ${amount})` : ""}`;
    case "expense_deleted":
      return `${actor} deleted ${what}`;
    case "member_joined":
      return `${actor} joined the group`;
    case "settled_up":
      return `${actor} recorded a payment${amount ? ` of ${amount}` : ""}`;
    case "settlement_deleted":
      return `${actor} deleted a payment${amount ? ` of ${amount}` : ""}`;
    default:
      return `${actor} updated the group`;
  }
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  const payload = await req.json();
  if (payload.type !== "INSERT" || payload.table !== "activity_log") {
    return new Response("ignored", { status: 200 });
  }
  const record = payload.record as ActivityRecord;

  // Group name + actor name for the notification copy.
  const [{ data: group }, { data: actor }] = await Promise.all([
    supabase.from("groups").select("name").eq("id", record.group_id).single(),
    record.actor_id
      ? supabase.from("profiles").select("name").eq("id", record.actor_id).single()
      : Promise.resolve({ data: null }),
  ]);

  // Every member except the person who performed the action.
  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", record.group_id)
    .neq("user_id", record.actor_id ?? "00000000-0000-0000-0000-000000000000");

  // Surface query failures loudly — a silent empty list here once masked an
  // invalid service key (pg_net stores this body in net._http_response).
  if (membersError) {
    return new Response(`members query failed: ${membersError.message}`, {
      status: 500,
    });
  }

  const userIds = (members ?? []).map((m) => m.user_id);
  if (userIds.length === 0) return new Response("no recipients", { status: 200 });

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token")
    .in("user_id", userIds);

  if (!tokens?.length) return new Response("no tokens", { status: 200 });

  const body = describe(record.action, actor?.name ?? "Someone", record.details);
  const messages = tokens.map(({ token }) => ({
    to: token,
    title: group?.name ?? "SplitStream",
    body,
    data: { groupId: record.group_id },
  }));

  // Expo push API accepts up to 100 messages per call — fine for 3-8 member
  // groups; chunk if that assumption ever changes.
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });

  return new Response(await res.text(), { status: res.status });
});
