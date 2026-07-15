-- SplitStream — Phase 4 database setup (realtime)
-- Run this in the Supabase Dashboard → SQL Editor (after phase3.sql).

-- Publish expenses changes over Supabase Realtime (WAL → WebSocket).
-- RLS still applies: subscribers only receive rows their policies allow.
alter publication supabase_realtime add table public.expenses;

-- By default the WAL only records the primary key of deleted/updated rows.
-- FULL replica identity makes DELETE events carry the whole old row and,
-- crucially, lets our `group_id=eq.X` subscription filter apply to DELETEs —
-- without this, delete events silently never reach the other clients.
alter table public.expenses replica identity full;
