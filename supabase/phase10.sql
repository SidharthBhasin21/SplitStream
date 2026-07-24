-- Phase 10 — partial-member expense splits (v1.4)
--
-- An expense no longer has to be split across every group member: e.g. 3 of
-- 5 trip members go to dinner, only those 3 should owe a share. `split_among`
-- holds the participant user ids for the expense. NULL (or an empty array)
-- means "everyone currently in the group" — this keeps every pre-existing
-- expense row correct with no backfill required, and the client falls back
-- to the full member list the same way (lib/balances.ts).

alter table public.expenses
  add column split_among uuid[];

alter table public.expenses
  add constraint split_among_not_empty
  check (split_among is null or array_length(split_among, 1) > 0);
