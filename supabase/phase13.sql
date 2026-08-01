-- Phase 13 — security hardening (v1.5, from the security audit)
-- Run this in the Supabase Dashboard → SQL Editor (after phase12.sql).
--
-- Closes the audit's confirmed data-integrity holes. The common theme: RLS
-- verified WHO was writing but not WHAT they wrote — a group member could
-- reference users outside the group (or move an expense into a foreign
-- group) and corrupt balances. Fixes:
--
--   1. Expense UPDATE gets an explicit WITH CHECK. Postgres reuses USING as
--      the check when WITH CHECK is omitted, which already pinned
--      created_by — but nothing pinned group_id, so a creator could UPDATE
--      an expense INTO a group they don't belong to (cross-group injection).
--   2. Triggers validate every referenced participant (paid_by, each
--      split_among entry, settlement from/to) is a member of the row's
--      group, and that split_among has no duplicates. Triggers rather than
--      CHECK constraints because the rule spans tables (group_members).

-- is_group_member() only answers for auth.uid(); participant checks need
-- "is USER X a member of group G". SECURITY DEFINER for the same reason as
-- phase2.sql note 1: the lookup itself must bypass group_members RLS.
create or replace function public.is_member_of(gid uuid, uid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = uid
  );
$$;

-- ── 1. Expense UPDATE: pin the row to a group the editor belongs to ──────

drop policy "Creators can update their expenses" on public.expenses;
create policy "Creators can update their expenses"
  on public.expenses for update
  using (created_by = (select auth.uid()))
  with check (
    public.is_group_member(group_id)
    and created_by = (select auth.uid())
  );

-- ── 2. Expense participants must be members of the expense's group ───────

create or replace function public.validate_expense_participants()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid;
begin
  if new.paid_by is not null
     and not public.is_member_of(new.group_id, new.paid_by) then
    raise exception 'paid_by must be a member of this group';
  end if;

  if new.split_among is not null then
    if array_length(new.split_among, 1)
       <> (select count(distinct u) from unnest(new.split_among) u) then
      raise exception 'split_among must not contain duplicates';
    end if;
    foreach uid in array new.split_among loop
      if not public.is_member_of(new.group_id, uid) then
        raise exception 'split_among contains a non-member';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

create trigger expenses_validate_participants
  before insert or update on public.expenses
  for each row execute function public.validate_expense_participants();

-- ── 3. Settlement participants must be members of the settlement's group ─
-- INSERT only: settlements are immutable (phase7.sql), there is no UPDATE.

create or replace function public.validate_settlement_participants()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_member_of(new.group_id, new.from_user)
     or not public.is_member_of(new.group_id, new.to_user) then
    raise exception 'settlement participants must be members of this group';
  end if;
  return new;
end;
$$;

create trigger settlements_validate_participants
  before insert on public.settlements
  for each row execute function public.validate_settlement_participants();
