-- Harden household_members: remove client UPDATE privilege escalation (E4).
-- Helpers/employers must not PATCH membership rows via PostgREST.
-- Role/status changes only through controlled SECURITY DEFINER RPCs.

-- 1) Drop vulnerable UPDATE policy (self-update OR owner with no column guard)
drop policy if exists members_update_owner on public.household_members;

-- Intentionally NO replacement client UPDATE policy.
-- SELECT policy members_select_same_household is preserved.

-- 2) Revoke unsafe table privileges from API roles.
-- Keep SELECT for authenticated so members can list same-household memberships.
revoke all on table public.household_members from anon;
revoke all on table public.household_members from public;
revoke insert, update, delete, truncate, references, trigger
  on table public.household_members from authenticated;
grant select on table public.household_members to authenticated;

-- 3) Owner-only: change employer <-> helper (never owner via this RPC)
create or replace function public.change_household_member_role(
  p_household_id uuid,
  p_member_user_id uuid,
  p_new_role text
)
returns public.household_members
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target public.household_members;
  updated public.household_members;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_household_id is null or p_member_user_id is null then
    raise exception 'forbidden';
  end if;

  if p_new_role is null or p_new_role not in ('employer', 'helper') then
    raise exception 'invalid role';
  end if;

  -- Caller must be active owner of the named household
  if not public.is_owner(p_household_id) then
    raise exception 'forbidden';
  end if;

  -- Load target only within the same household; generic error if missing
  select * into target
  from public.household_members
  where household_id = p_household_id
    and user_id = p_member_user_id
  for update;

  if target.user_id is null then
    raise exception 'forbidden';
  end if;

  if target.status is distinct from 'active' then
    raise exception 'forbidden';
  end if;

  -- Never change owners through this RPC (no demotion / no owner transfer)
  if target.role = 'owner' then
    raise exception 'forbidden';
  end if;

  -- Cannot change own role via this path either (owners stay owner; others use admin path)
  if p_member_user_id = uid then
    raise exception 'forbidden';
  end if;

  update public.household_members
  set role = p_new_role
  where household_id = p_household_id
    and user_id = p_member_user_id
    and status = 'active'
    and role in ('employer', 'helper')
  returning * into updated;

  if updated.user_id is null then
    raise exception 'forbidden';
  end if;

  return updated;
end;
$$;

revoke all on function public.change_household_member_role(uuid, uuid, text) from public;
revoke all on function public.change_household_member_role(uuid, uuid, text) from anon;
grant execute on function public.change_household_member_role(uuid, uuid, text) to authenticated;

-- 4) Harden remove_household_member: owner-only, no self-remove, protect last active owner
create or replace function public.remove_household_member(
  p_household_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target public.household_members;
  owner_count int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_household_id is null or p_user_id is null then
    raise exception 'forbidden';
  end if;

  if not public.is_owner(p_household_id) then
    raise exception 'forbidden';
  end if;

  if p_user_id = uid then
    raise exception 'cannot remove yourself as owner';
  end if;

  select * into target
  from public.household_members
  where household_id = p_household_id
    and user_id = p_user_id
  for update;

  -- Cross-household / missing: generic forbidden (no existence leak)
  if target.user_id is null or target.status is distinct from 'active' then
    raise exception 'forbidden';
  end if;

  if target.role = 'owner' then
    select count(*)::int into owner_count
    from public.household_members
    where household_id = p_household_id
      and role = 'owner'
      and status = 'active';

    if owner_count <= 1 then
      raise exception 'cannot remove the last active owner';
    end if;
  end if;

  update public.household_members
  set status = 'removed', removed_at = now()
  where household_id = p_household_id
    and user_id = p_user_id
    and status = 'active';
end;
$$;

revoke all on function public.remove_household_member(uuid, uuid) from public;
revoke all on function public.remove_household_member(uuid, uuid) from anon;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;

-- leave_household already blocks owner leave; reaffirm grants only
revoke all on function public.leave_household(uuid) from public;
revoke all on function public.leave_household(uuid) from anon;
grant execute on function public.leave_household(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ROLLBACK SQL (manual; do not auto-run)
-- ---------------------------------------------------------------------------
-- drop function if exists public.change_household_member_role(uuid, uuid, text);
--
-- create or replace function public.remove_household_member(p_household_id uuid, p_user_id uuid)
-- returns void
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- begin
--   if auth.uid() is null then raise exception 'not authenticated'; end if;
--   if not public.is_owner(p_household_id) then raise exception 'forbidden'; end if;
--   if p_user_id = auth.uid() then raise exception 'cannot remove yourself as owner'; end if;
--   update public.household_members
--   set status = 'removed', removed_at = now()
--   where household_id = p_household_id and user_id = p_user_id and status = 'active';
-- end;
-- $$;
--
-- revoke all on function public.remove_household_member(uuid, uuid) from public;
-- grant execute on function public.remove_household_member(uuid, uuid) to authenticated;
--
-- drop policy if exists members_update_owner on public.household_members;
-- create policy members_update_owner on public.household_members
--   for update to authenticated
--   using (public.is_owner(household_id) or (user_id = auth.uid() and status = 'active'))
--   with check (
--     public.is_owner(household_id)
--     or (user_id = auth.uid() and status in ('left', 'active'))
--   );
--
-- grant select, update on table public.household_members to authenticated;
-- WARNING: rollback restores the privilege-escalation vulnerability (E4).
