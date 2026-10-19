-- Phase 3: RLS — deny by default, least privilege
-- Does not modify household_sync policies yet (legacy still needed until cutover)

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_occurrences enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_events enable row level security;
alter table public.household_glossary enable row level security;
alter table public.privacy_consents enable row level security;

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.household_members me
    join public.household_members them
      on me.household_id = them.household_id
    where me.user_id = auth.uid() and me.status = 'active'
      and them.user_id = profiles.id and them.status = 'active'
  ));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- households: no anon; only active members; no public listing
drop policy if exists households_select_member on public.households;
create policy households_select_member on public.households
  for select to authenticated
  using (deleted_at is null and public.is_active_member(id));

drop policy if exists households_insert_auth on public.households;
create policy households_insert_auth on public.households
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists households_update_owner on public.households;
create policy households_update_owner on public.households
  for update to authenticated
  using (public.is_owner(id))
  with check (public.is_owner(id));

drop policy if exists households_delete_owner on public.households;
create policy households_delete_owner on public.households
  for delete to authenticated
  using (public.is_owner(id));

-- household_members
drop policy if exists members_select_same_household on public.household_members;
create policy members_select_same_household on public.household_members
  for select to authenticated
  using (public.is_active_member(household_id));

-- Inserts only via security definer RPCs (create_household / accept_invite)
-- Block direct self-insert
drop policy if exists members_no_direct_insert on public.household_members;
-- owners can update status (remove member)
drop policy if exists members_update_owner on public.household_members;
create policy members_update_owner on public.household_members
  for update to authenticated
  using (public.is_owner(household_id) or (user_id = auth.uid() and status = 'active'))
  with check (
    public.is_owner(household_id)
    or (user_id = auth.uid() and status in ('left', 'active'))
  );

-- invites: employers/owners manage; helpers never list tokens
drop policy if exists invites_select_employer on public.household_invites;
create policy invites_select_employer on public.household_invites
  for select to authenticated
  using (public.is_employer_or_owner(household_id));

drop policy if exists invites_insert_employer on public.household_invites;
create policy invites_insert_employer on public.household_invites
  for insert to authenticated
  with check (
    public.is_employer_or_owner(household_id)
    and created_by = auth.uid()
  );

drop policy if exists invites_update_employer on public.household_invites;
create policy invites_update_employer on public.household_invites
  for update to authenticated
  using (public.is_employer_or_owner(household_id))
  with check (public.is_employer_or_owner(household_id));

-- task_templates
drop policy if exists templates_select_member on public.task_templates;
create policy templates_select_member on public.task_templates
  for select to authenticated
  using (deleted_at is null and public.is_active_member(household_id));

drop policy if exists templates_insert_employer on public.task_templates;
create policy templates_insert_employer on public.task_templates
  for insert to authenticated
  with check (public.is_employer_or_owner(household_id) and created_by = auth.uid());

drop policy if exists templates_update_employer on public.task_templates;
create policy templates_update_employer on public.task_templates
  for update to authenticated
  using (public.is_employer_or_owner(household_id))
  with check (public.is_employer_or_owner(household_id));

drop policy if exists templates_delete_employer on public.task_templates;
create policy templates_delete_employer on public.task_templates
  for delete to authenticated
  using (public.is_employer_or_owner(household_id));

-- task_occurrences
drop policy if exists occurrences_select_member on public.task_occurrences;
create policy occurrences_select_member on public.task_occurrences
  for select to authenticated
  using (deleted_at is null and public.is_active_member(household_id));

drop policy if exists occurrences_insert_employer on public.task_occurrences;
create policy occurrences_insert_employer on public.task_occurrences
  for insert to authenticated
  with check (public.is_employer_or_owner(household_id) and created_by = auth.uid());

-- Helpers may update only allowed status fields via column-level discipline in RPC;
-- direct UPDATE policy: employers full; helpers limited by WITH CHECK
drop policy if exists occurrences_update_employer on public.task_occurrences;
create policy occurrences_update_employer on public.task_occurrences
  for update to authenticated
  using (public.is_employer_or_owner(household_id))
  with check (public.is_employer_or_owner(household_id));

drop policy if exists occurrences_update_helper on public.task_occurrences;
create policy occurrences_update_helper on public.task_occurrences
  for update to authenticated
  using (
    public.is_active_member(household_id)
    and public.member_role(household_id) = 'helper'
  )
  with check (
    public.is_active_member(household_id)
    and public.member_role(household_id) = 'helper'
    and household_id = household_id  -- cannot change household via separate check in trigger
  );

drop policy if exists occurrences_delete_employer on public.task_occurrences;
create policy occurrences_delete_employer on public.task_occurrences
  for delete to authenticated
  using (public.is_employer_or_owner(household_id));

-- Prevent helpers from changing protected columns
create or replace function public.guard_task_occurrence_update()
returns trigger
language plpgsql
as $$
declare
  role text;
begin
  role := public.member_role(old.household_id);
  if role = 'helper' then
    if new.household_id is distinct from old.household_id then
      raise exception 'helpers cannot change household_id';
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      raise exception 'helpers cannot change assigned_to';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'helpers cannot change created_by';
    end if;
    if new.template_id is distinct from old.template_id then
      raise exception 'helpers cannot change template_id';
    end if;
    if new.title_zh is distinct from old.title_zh
       or new.instructions_zh is distinct from old.instructions_zh then
      raise exception 'helpers cannot edit Chinese content';
    end if;
    if new.status not in (
      'acknowledged', 'in_progress', 'needs_clarification',
      'cannot_complete', 'delayed', 'completed'
    ) and new.status is distinct from old.status then
      raise exception 'helpers cannot set status %', new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_task_occurrence on public.task_occurrences;
create trigger trg_guard_task_occurrence
  before update on public.task_occurrences
  for each row execute function public.guard_task_occurrence_update();

-- task_comments
drop policy if exists comments_select_member on public.task_comments;
create policy comments_select_member on public.task_comments
  for select to authenticated
  using (public.is_active_member(household_id));

drop policy if exists comments_insert_member on public.task_comments;
create policy comments_insert_member on public.task_comments
  for insert to authenticated
  with check (
    public.is_active_member(household_id)
    and user_id = auth.uid()
  );

-- task_events: read for members; insert via trigger/RPC only for helpers/employers
drop policy if exists events_select_member on public.task_events;
create policy events_select_member on public.task_events
  for select to authenticated
  using (public.is_active_member(household_id));

drop policy if exists events_insert_member on public.task_events;
create policy events_insert_member on public.task_events
  for insert to authenticated
  with check (
    public.is_active_member(household_id)
    and (actor_id = auth.uid() or actor_id is null)
  );

-- glossary
drop policy if exists glossary_select_member on public.household_glossary;
create policy glossary_select_member on public.household_glossary
  for select to authenticated
  using (public.is_active_member(household_id));

drop policy if exists glossary_insert_employer on public.household_glossary;
create policy glossary_insert_employer on public.household_glossary
  for insert to authenticated
  with check (public.is_employer_or_owner(household_id) and created_by = auth.uid());

drop policy if exists glossary_update_employer on public.household_glossary;
create policy glossary_update_employer on public.household_glossary
  for update to authenticated
  using (public.is_employer_or_owner(household_id))
  with check (public.is_employer_or_owner(household_id));

drop policy if exists glossary_delete_employer on public.household_glossary;
create policy glossary_delete_employer on public.household_glossary
  for delete to authenticated
  using (public.is_employer_or_owner(household_id));

-- privacy_consents
drop policy if exists consents_select_own on public.privacy_consents;
create policy consents_select_own on public.privacy_consents
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists consents_insert_own on public.privacy_consents;
create policy consents_insert_own on public.privacy_consents
  for insert to authenticated
  with check (user_id = auth.uid());

-- Revoke anon on new tables explicitly
revoke all on public.profiles from anon;
revoke all on public.households from anon;
revoke all on public.household_members from anon;
revoke all on public.household_invites from anon;
revoke all on public.task_templates from anon;
revoke all on public.task_occurrences from anon;
revoke all on public.task_comments from anon;
revoke all on public.task_events from anon;
revoke all on public.household_glossary from anon;
revoke all on public.privacy_consents from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.households to authenticated;
grant select, update on public.household_members to authenticated;
grant select, insert, update on public.household_invites to authenticated;
grant select, insert, update, delete on public.task_templates to authenticated;
grant select, insert, update, delete on public.task_occurrences to authenticated;
grant select, insert on public.task_comments to authenticated;
grant select, insert on public.task_events to authenticated;
grant select, insert, update, delete on public.household_glossary to authenticated;
grant select, insert on public.privacy_consents to authenticated;
