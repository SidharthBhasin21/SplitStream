-- Phase 14 — account deletion (v1.7)
-- Run this in the Supabase Dashboard → SQL Editor (after phase13.sql).
--
-- Google Play requires any app with account creation to offer account
-- deletion. For a SHARED LEDGER that can't mean "erase every row this person
-- touched": if someone paid ₹3,000 for a group dinner and then deleted their
-- account, dropping that expense would silently rewrite what everyone else in
-- the group owes. You must not be able to erase your debts by leaving.
--
-- So deletion here is ANONYMISE, not destroy — which is what Play's policy
-- permits (data may be retained for a legitimate purpose; other members'
-- financial records are exactly that):
--
--   GONE      the login identity — auth.users row, so email, password hash
--             and any linked Google account. The person can never sign in
--             again, and no personal data survives in the auth schema.
--   GONE      push tokens, so their devices stop receiving notifications.
--   SCRUBBED  profiles.name becomes 'Deleted user'. The ROW survives as a
--             tombstone because expenses.paid_by, settlements.from_user/
--             to_user and groups.created_by all reference it with no
--             cascade — dropping it would break referential integrity.
--   KEPT      group_members, expenses, settlements, activity_log. Removing
--             the membership would change the split divisor and retroactively
--             alter every remaining member's balance (see lib/balances.ts);
--             keeping it means the group still sees what the departed member
--             owed or was owed, and can settle up.
--
-- The privacy policy must describe exactly this behaviour.

-- profiles.id references auth.users with no ON DELETE action, which would
-- block the auth-row delete below. Dropping the constraint lets the tombstone
-- profile outlive the auth user — deliberately orphaned. New profiles are
-- still created only by the on_auth_user_created trigger (phase1.sql), so
-- rows can't appear from anywhere else.
alter table public.profiles drop constraint if exists profiles_id_fkey;

create or replace function public.delete_account()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Scrub the only personal data in public schema: the display name.
  update public.profiles set name = 'Deleted user' where id = uid;

  -- Stop all future pushes to this person's devices.
  delete from public.push_tokens where user_id = uid;

  -- Destroy the login identity last. Cascades through auth.identities,
  -- auth.sessions and auth.refresh_tokens, so no email, password hash or
  -- OAuth link remains anywhere.
  delete from auth.users where id = uid;
end;
$$;

-- Callable by signed-in users only; the function re-checks auth.uid() itself
-- and can only ever delete the CALLER (no user id parameter exists to abuse).
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
