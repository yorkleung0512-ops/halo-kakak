-- Peer profile read, consent update, leave_household, lock legacy sync
create policy profiles_select_household_peers on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.household_members me
      join public.household_members them
        on them.household_id = me.household_id
       and them.status = 'active'
       and them.user_id = profiles.id
      where me.user_id = auth.uid()
        and me.status = 'active'
    )
  );

drop policy if exists profiles_select_own on public.profiles;

create policy consents_update_own on public.privacy_consents
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  r := public.member_role(p_household_id);
  if r is null then raise exception 'not a member'; end if;
  if r = 'owner' then raise exception 'owner cannot leave; transfer ownership first'; end if;
  update public.household_members
  set status = 'left', removed_at = now()
  where household_id = p_household_id
    and user_id = auth.uid()
    and status = 'active';
end;
$$;

revoke all on function public.leave_household(uuid) from public;
grant execute on function public.leave_household(uuid) to authenticated;

drop policy if exists "Allow public read household_sync" on public.household_sync;
drop policy if exists "Allow public insert household_sync" on public.household_sync;
drop policy if exists "Allow public update household_sync" on public.household_sync;
