-- SplitStream — push notification webhook (v1.1 deployment)
-- Run this in the Supabase Dashboard → SQL Editor (after phase6.sql).
--
-- Replaces the dashboard "Database Webhook" UI with an explicit trigger:
-- every new activity_log row fires the notify-activity Edge Function, which
-- fans the event out to group members' devices as an Expo push.
--
-- Before running, replace __WEBHOOK_SECRET__ below with the value stored as
-- the function's WEBHOOK_SECRET (the Edge Function rejects any call whose
-- x-webhook-secret header doesn't match). The secret is NOT committed here.

-- pg_net lets Postgres make outbound HTTP calls (async, fire-and-forget).
create extension if not exists pg_net;

create or replace function public.notify_activity_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://iktxymjxpmpmhzexahlp.supabase.co/functions/v1/notify-activity',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '__WEBHOOK_SECRET__'
    ),
    -- Shape mirrors a Supabase Database Webhook payload, which the Edge
    -- Function already parses (type / table / record).
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'activity_log',
      'schema', 'public',
      'record', to_jsonb(new)
    )
  );
  return new;
end;
$$;

drop trigger if exists activity_log_notify_webhook on public.activity_log;
create trigger activity_log_notify_webhook
  after insert on public.activity_log
  for each row execute function public.notify_activity_webhook();
