-- SplitStream — Phase 3 database setup (expenses)
-- Run this in the Supabase Dashboard → SQL Editor (after phase2.sql).
--
-- The `version` column is the heart of conflict detection: every client
-- update is a compare-and-set (`... where id = X and version = N`), so a
-- stale write matches zero rows instead of silently clobbering a newer edit.
-- The client-side half of this lives in lib/expenseSync.ts.

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null,
  paid_by uuid references public.profiles(id),
  split_type text default 'equal', -- future: 'custom'
  version integer default 1,       -- for conflict resolution
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- The expense list is always fetched per group.
create index expenses_group_id_idx on public.expenses (group_id);

-- Keep updated_at server-authoritative instead of trusting client clocks.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────
-- Reads: any member of the group. Writes: inserts by any member (as
-- themselves); edits/deletes only by the expense's creator (PRD 5.3).

alter table public.expenses enable row level security;

create policy "Members can read their groups' expenses"
  on public.expenses for select
  using (public.is_group_member(group_id));

create policy "Members can add expenses to their groups"
  on public.expenses for insert
  with check (
    public.is_group_member(group_id)
    and created_by = (select auth.uid())
  );

create policy "Creators can update their expenses"
  on public.expenses for update
  using (created_by = (select auth.uid()));

create policy "Creators can delete their expenses"
  on public.expenses for delete
  using (created_by = (select auth.uid()));
