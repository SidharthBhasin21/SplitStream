-- SplitStream — v1.2 database setup (settle up)
-- Run this in the Supabase Dashboard → SQL Editor (after phase6.sql).
--
-- A settlement records money changing hands OUTSIDE the app (cash/UPI):
-- from_user paid to_user `amount` within a group. Partial payments are just
-- smaller amounts. Settlements are immutable — no edits, no version column;
-- a mistaken entry is deleted (creator only) and re-recorded. That keeps
-- the conflict-resolution story confined to expenses, where concurrent
-- edits actually happen.

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user uuid not null references public.profiles(id),
  to_user uuid not null references public.profiles(id),
  amount numeric(10,2) not null check (amount > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  check (from_user <> to_user)
);

create index settlements_group_id_idx on public.settlements (group_id);

alter table public.settlements enable row level security;

create policy "Members can read their groups' settlements"
  on public.settlements for select
  using (public.is_group_member(group_id));

create policy "Members can record settlements in their groups"
  on public.settlements for insert
  with check (
    public.is_group_member(group_id)
    and created_by = (select auth.uid())
  );

create policy "Creators can delete their settlements"
  on public.settlements for delete
  using (created_by = (select auth.uid()));

-- Realtime: publish, with full replica identity so DELETE events carry
-- group_id and pass the client's filter (same reasoning as phase4.sql).
alter publication supabase_realtime add table public.settlements;
alter table public.settlements replica identity full;

-- ── Activity log integration ────────────────────────────────────────────

alter table public.activity_log drop constraint activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check
  check (action in (
    'expense_added', 'expense_edited', 'expense_deleted', 'member_joined',
    'settled_up', 'settlement_deleted'
  ));

create or replace function public.log_settlement_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_log (group_id, actor_id, action, details)
    values (new.group_id, auth.uid(), 'settled_up',
            jsonb_build_object('amount', new.amount));
    return new;
  else
    insert into activity_log (group_id, actor_id, action, details)
    values (old.group_id, auth.uid(), 'settlement_deleted',
            jsonb_build_object('amount', old.amount));
    return old;
  end if;
end;
$$;

create trigger settlements_log_activity
  after insert or delete on public.settlements
  for each row execute function public.log_settlement_activity();
