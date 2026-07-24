import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId } from "react";

import { formatMoney } from "./currency";
import { supabase } from "./supabase";
import type { ActivityEntry } from "./types";

/**
 * Activity feed (v1.1). Rows are written exclusively by DB triggers
 * (supabase/phase6.sql), so this module is read-only: a paged query plus a
 * realtime subscription that keeps the feed live while it's on screen.
 * Push notifications for these same rows are sent server-side by the
 * notify-activity Edge Function — the client never sends anything.
 */

/** Feed row with the actor's name joined in (null actor = departed user). */
export type ActivityWithActor = ActivityEntry & {
  profiles: { name: string } | null;
};

/** Global-feed row also carries which group it belongs to. */
export type ActivityWithGroup = ActivityWithActor & {
  groups: { name: string; currency: string } | null;
};

export const activityKeys = {
  list: (groupId: string) => ["activity", groupId] as const,
  all: ["activity", "all"] as const,
};

const FEED_LIMIT = 50;
const GLOBAL_FEED_LIMIT = 100;

export function useActivity(groupId: string) {
  return useQuery({
    queryKey: activityKeys.list(groupId),
    queryFn: async (): Promise<ActivityWithActor[]> => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*, profiles(name)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(FEED_LIMIT);
      if (error) throw error;
      return data as unknown as ActivityWithActor[];
    },
  });
}

/**
 * Global activity across ALL the user's groups (design v3 — the Activity
 * tab). No group filter: RLS already scopes activity_log to groups the user
 * belongs to. Joins in the group name so each row shows its context.
 */
export function useAllActivity() {
  return useQuery({
    queryKey: activityKeys.all,
    queryFn: async (): Promise<ActivityWithGroup[]> => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*, profiles(name), groups(name, currency)")
        .order("created_at", { ascending: false })
        .limit(GLOBAL_FEED_LIMIT);
      if (error) throw error;
      return data as unknown as ActivityWithGroup[];
    },
  });
}

/** Live-refresh the global feed while the Activity tab is mounted. */
export function useAllActivityRealtime() {
  const queryClient = useQueryClient();
  // Unique per mount — same rationale as useGroupRealtime (see expenseSync.ts).
  const instanceId = useId();

  useEffect(() => {
    const channel = supabase
      .channel(`activity:all:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log" },
        () => {
          queryClient.invalidateQueries({ queryKey: activityKeys.all });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, instanceId]);
}

/**
 * Keep the feed live while its screen is mounted. Unlike expenses (which
 * merge surgically for instant optimistic UX), an INSERT here just
 * invalidates: the feed is append-only and low-volume, and the refetch
 * brings the joined actor name that the realtime payload lacks.
 */
export function useActivityRealtime(groupId: string) {
  const queryClient = useQueryClient();
  // Unique per mount — same rationale as useGroupRealtime (see expenseSync.ts).
  const instanceId = useId();

  useEffect(() => {
    const channel = supabase
      .channel(`activity:${groupId}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_log",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: activityKeys.list(groupId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient, instanceId]);
}

/** "Bob added ₹500.00 for Dinner" — one line per feed row. `currency` is
 *  the entry's group currency (v1.3); defaults to INR for legacy callers. */
export function describeActivity(
  entry: ActivityWithActor,
  currency = "INR",
): string {
  const actor = entry.profiles?.name ?? "Someone";
  const what = entry.details.description ?? "an expense";
  const amount =
    entry.details.amount !== undefined
      ? formatMoney(entry.details.amount, currency)
      : "";

  switch (entry.action) {
    case "expense_added":
      return `${actor} added ${amount} for ${what}`;
    case "expense_edited":
      return `${actor} edited ${what}${amount ? ` (now ${amount})` : ""}`;
    case "expense_deleted":
      return `${actor} deleted ${what}${amount ? ` (${amount})` : ""}`;
    case "member_joined":
      return `${actor} joined the group`;
    case "settled_up":
      return `${actor} recorded a payment${amount ? ` of ${amount}` : ""}`;
    case "settlement_deleted":
      return `${actor} deleted a payment${amount ? ` of ${amount}` : ""}`;
  }
}
