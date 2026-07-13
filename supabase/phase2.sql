-- SplitStream — Phase 2 database setup (groups + membership + RLS)
-- Run this in the Supabase Dashboard → SQL Editor (after phase1.sql).
--
-- Design notes (interview talking points):
--
-- 1. RLS recursion: a naive "members can see membership rows of their groups"
--    policy on group_members would query group_members inside its own policy,
--    which Postgres rejects as infinite recursion. The standard fix is a
--    SECURITY DEFINER helper (is_group_member) that bypasses RLS for the
--    membership lookup itself.
--
-- 2. Create/join go through RPCs, not raw inserts:
--    - create_group: inserting the group AND the creator's membership must be
--      atomic — two client-side inserts could leave an orphaned group.
--    - join_group: a non-member can't SELECT a group (RLS), so they could
--      never look up the group id to insert a membership row. The invite code
--      itself acts as the credential; the definer function does the lookup.

-- 6-char invite code from an alphabet without lookalikes (no 0/O, 1/I/L).
create or replace function public.gen_invite_code()
returns text
language sql
volatile
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (random() * 30)::int + 1, 1),
    ''
  )
  from generate_series(1, 6);
$$;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default public.gen_invite_code(),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- Membership lookups are always by user; the PK only covers (group_id, user_id).
create index group_members_user_id_idx on public.group_members (user_id);

-- RLS-bypassing membership check — see design note 1.
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- True when the current user shares at least one group with `other`.
-- Used to let group members see each other's profile names.
create or replace function public.shares_group_with(other uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from group_members mine
    join group_members theirs using (group_id)
    where mine.user_id = auth.uid() and theirs.user_id = other
  );
$$;

-- Atomic create: group + creator's membership in one transaction (note 2).
create or replace function public.create_group(group_name text)
returns public.groups
language plpgsql
security definer set search_path = public
as $$
declare
  g public.groups;
  attempts int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if length(trim(group_name)) = 0 then
    raise exception 'Group name is required';
  end if;

  -- The default invite code could (rarely) collide with an existing one;
  -- retry a few times instead of failing the whole create.
  loop
    begin
      insert into groups (name, created_by)
      values (trim(group_name), auth.uid())
      returning * into g;
      exit;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 5 then
        raise;
      end if;
    end;
  end loop;

  insert into group_members (group_id, user_id) values (g.id, auth.uid());
  return g;
end;
$$;

-- Join by invite code — the code is the credential (note 2). Idempotent:
-- joining a group you're already in just returns the group.
create or replace function public.join_group(code text)
returns public.groups
language plpgsql
security definer set search_path = public
as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into g from groups where invite_code = upper(trim(code));
  if not found then
    raise exception 'No group found with that invite code';
  end if;

  insert into group_members (group_id, user_id)
  values (g.id, auth.uid())
  on conflict do nothing;

  return g;
end;
$$;

-- ── Row Level Security ──────────────────────────────────────────────────
-- Reads are policy-based; the only writes in v1 (create/join) go through the
-- SECURITY DEFINER RPCs above, so no INSERT/UPDATE/DELETE policies exist —
-- raw writes from clients are denied outright.

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy "Members can read their groups"
  on public.groups for select
  using (public.is_group_member(id));

create policy "Members can read memberships of their groups"
  on public.group_members for select
  using (public.is_group_member(group_id));

-- Widen Phase 1's profiles policy: members of a shared group can read each
-- other's names (needed for member lists and, later, expense rows).
create policy "Group members can read each other's profiles"
  on public.profiles for select
  using (public.shares_group_with(id));
