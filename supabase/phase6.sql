-- SplitStream — v1.1 database setup (categories, activity log, push tokens)
-- Run this in the Supabase Dashboard → SQL Editor (after phase4.sql).

-- ── Expense categories ──────────────────────────────────────────────────
-- Fixed v1.1 set; keep in sync with CATEGORIES in lib/categories.ts.

alter table public.expenses
  add column category text not null default 'other'
  check (category in (
    'food', 'travel', 'rent', 'shopping', 'utilities', 'entertainment', 'other'
  ));

-- ── Activity log ────────────────────────────────────────────────────────
-- Append-only feed per group. Rows are written ONLY by the triggers below
-- (SECURITY DEFINER), never by clients — no client code path can forget to
-- log, and nobody can forge entries. Rendered client-side from the
-- structured `details` jsonb ("Bob added ₹500 for dinner").

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null check (action in (
    'expense_added', 'expense_edited', 'expense_deleted', 'member_joined'
  )),
  details jsonb not null default '{}',
  created_at timestamptz default now()
);

create index activity_log_group_id_idx
  on public.activity_log (group_id, created_at desc);

alter table public.activity_log enable row level security;

create policy "Members can read their groups' activity"
  on public.activity_log for select
  using (public.is_group_member(group_id));
-- No insert/update/delete policies: append-only via triggers, immutable.

create or replace function public.log_expense_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_log (group_id, actor_id, action, details)
    values (new.group_id, auth.uid(), 'expense_added',
            jsonb_build_object('description', new.description, 'amount', new.amount));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into activity_log (group_id, actor_id, action, details)
    values (new.group_id, auth.uid(), 'expense_edited',
            jsonb_build_object('description', new.description, 'amount', new.amount));
    return new;
  else
    insert into activity_log (group_id, actor_id, action, details)
    values (old.group_id, auth.uid(), 'expense_deleted',
            jsonb_build_object('description', old.description, 'amount', old.amount));
    return old;
  end if;
end;
$$;

create trigger expenses_log_activity
  after insert or update or delete on public.expenses
  for each row execute function public.log_expense_activity();

create or replace function public.log_member_joined()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into activity_log (group_id, actor_id, action, details)
  values (new.group_id, new.user_id, 'member_joined', '{}');
  return new;
end;
$$;

create trigger group_members_log_activity
  after insert on public.group_members
  for each row execute function public.log_member_joined();

-- Live feed: publish INSERTs (append-only, so nothing else needed).
alter publication supabase_realtime add table public.activity_log;

-- ── Push notification tokens ────────────────────────────────────────────
-- One row per (user, device). Written by the client after registering with
-- Expo's push service; read only by the notify-activity Edge Function
-- (service role, bypasses RLS).

create table public.push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null, -- ExponentPushToken[...]
  updated_at timestamptz default now(),
  primary key (user_id, token)
);

alter table public.push_tokens enable row level security;

create policy "Users manage their own push tokens"
  on public.push_tokens for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
