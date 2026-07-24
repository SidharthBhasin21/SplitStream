-- Phase 11 — delete a group (v1.5)
--
-- Deleting a group removes it for EVERYONE and wipes its full history, so
-- this is deliberately owner-only: only the member who created the group
-- (groups.created_by) may delete it.
--
-- Like create/join (phase2.sql note 2), this goes through a SECURITY DEFINER
-- RPC rather than a raw client DELETE: the groups table has no DELETE policy,
-- so client deletes are denied outright, and the definer function is the one
-- controlled place the ownership check lives. Every child table
-- (group_members, expenses, settlements, activity_log) references
-- groups(id) ON DELETE CASCADE, so a single delete tears the whole group
-- down atomically — no manual child cleanup needed.

create or replace function public.delete_group(gid uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select created_by into owner from groups where id = gid;
  if not found then
    raise exception 'Group not found';
  end if;
  if owner is distinct from auth.uid() then
    raise exception 'Only the group creator can delete this group';
  end if;

  delete from groups where id = gid; -- cascades to all child rows
end;
$$;
