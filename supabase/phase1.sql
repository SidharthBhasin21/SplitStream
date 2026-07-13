-- SplitStream — Phase 1 database setup
-- Run this in the Supabase Dashboard → SQL Editor.
-- Only the auth-related piece of the PRD Section 7 schema lives here;
-- groups/group_members arrive in Phase 2, expenses in Phase 3.

create table public.profiles (
  id uuid references auth.users primary key,
  name text not null,
  created_at timestamptz default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
-- The name comes from the metadata passed to supabase.auth.signUp()
-- in app/(auth)/signup.tsx; falls back to the email's local part.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security: users can only see/edit their own profile for now.
-- Phase 2 widens SELECT so members of the same group can see each other's names.
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id);
