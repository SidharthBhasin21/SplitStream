-- Phase 12 — distinguish loans from settle-up payments (v1.5)
--
-- Both move money identically (from_user's net rises, to_user's falls), so
-- they share the settlements table and all its balance math. `kind` exists
-- purely so the UI and activity feed can LABEL them honestly: "paid" vs
-- "lent". Default 'payment' keeps every pre-existing row correct.

alter table public.settlements
  add column kind text not null default 'payment'
  check (kind in ('payment', 'loan'));

-- Carry the kind into the activity feed so it can say "lent" too.
create or replace function public.log_settlement_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_log (group_id, actor_id, action, details)
    values (new.group_id, auth.uid(), 'settled_up',
            jsonb_build_object('amount', new.amount, 'kind', new.kind));
    return new;
  else
    insert into activity_log (group_id, actor_id, action, details)
    values (old.group_id, auth.uid(), 'settlement_deleted',
            jsonb_build_object('amount', old.amount, 'kind', old.kind));
    return old;
  end if;
end;
$$;
