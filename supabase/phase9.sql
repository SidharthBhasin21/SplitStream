-- SplitStream — v1.3 database setup (multi-currency)
-- Run this in the Supabase Dashboard → SQL Editor (after phase7.sql).
--
-- Currency is scoped PER GROUP, not per-expense: every expense/settlement in
-- a group is denominated in that group's currency. This keeps all the
-- existing balance math (lib/balances.ts) untouched — it never had to know
-- about currency, because within one group there's only ever one.

alter table public.groups
  add column currency text not null default 'INR'
  check (currency in (
    'INR','USD','EUR','GBP','AUD','CAD','JPY','CNY','SGD','AED','THB','NPR'
  ));

-- create_group needs a currency parameter alongside the existing name one.
-- CREATE OR REPLACE can't add a parameter to an existing signature, so the
-- old single-arg version is dropped first.
drop function if exists public.create_group(text);

create or replace function public.create_group(group_name text, group_currency text default 'INR')
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

  loop
    begin
      insert into groups (name, currency, created_by)
      values (trim(group_name), group_currency, auth.uid())
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
