-- Phase 1 RPCs: create household, invite, accept, revoke, remove member, optimistic task update

create extension if not exists pgcrypto;

-- Create household + owner membership (atomic)
create or replace function public.create_household(p_name text, p_timezone text default 'Asia/Hong_Kong')
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.households;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_name is null or length(trim(p_name)) < 1 then
    raise exception 'household name required';
  end if;

  insert into public.households (name, timezone, created_by)
  values (trim(p_name), coalesce(nullif(trim(p_timezone), ''), 'Asia/Hong_Kong'), uid)
  returning * into h;

  insert into public.household_members (household_id, user_id, role, status)
  values (h.id, uid, 'owner', 'active');

  return h;
end;
$$;

revoke all on function public.create_household(text, text) from public;
grant execute on function public.create_household(text, text) to authenticated;

-- Create invite: returns plaintext token ONCE (never stored)
create or replace function public.create_household_invite(
  p_household_id uuid,
  p_invited_role text default 'helper',
  p_expires_hours int default 72
)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  raw_token text;
  thash text;
  exp timestamptz;
  iid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not public.is_employer_or_owner(p_household_id) then
    raise exception 'forbidden';
  end if;
  if p_invited_role not in ('employer', 'helper') then
    raise exception 'invalid role';
  end if;

  raw_token := encode(gen_random_bytes(32), 'hex');
  thash := encode(digest(raw_token, 'sha256'), 'hex');
  exp := now() + make_interval(hours => greatest(p_expires_hours, 1));

  insert into public.household_invites (
    household_id, token_hash, invited_role, expires_at, created_by
  ) values (
    p_household_id, thash, p_invited_role, exp, uid
  ) returning id into iid;

  invite_id := iid;
  token := raw_token;
  expires_at := exp;
  return next;
end;
$$;

revoke all on function public.create_household_invite(uuid, text, int) from public;
grant execute on function public.create_household_invite(uuid, text, int) to authenticated;

-- Accept invite by plaintext token
create or replace function public.accept_household_invite(p_token text)
returns public.household_members
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  thash text;
  inv public.household_invites;
  mem public.household_members;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_token is null or length(p_token) < 16 then
    raise exception 'invalid token';
  end if;

  thash := encode(digest(p_token, 'sha256'), 'hex');

  select * into inv from public.household_invites
  where token_hash = thash
  for update;

  if inv.id is null then raise exception 'invite not found'; end if;
  if inv.revoked_at is not null then raise exception 'invite revoked'; end if;
  if inv.used_at is not null then raise exception 'invite already used'; end if;
  if inv.expires_at < now() then raise exception 'invite expired'; end if;

  -- Upsert membership
  insert into public.household_members (household_id, user_id, role, status, joined_at, removed_at)
  values (inv.household_id, uid, inv.invited_role, 'active', now(), null)
  on conflict (household_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        joined_at = now(),
        removed_at = null
  returning * into mem;

  update public.household_invites
  set used_at = now()
  where id = inv.id;

  return mem;
end;
$$;

revoke all on function public.accept_household_invite(text) from public;
grant execute on function public.accept_household_invite(text) to authenticated;

-- Revoke unused invite
create or replace function public.revoke_household_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.household_invites;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into inv from public.household_invites where id = p_invite_id;
  if inv.id is null then raise exception 'not found'; end if;
  if not public.is_employer_or_owner(inv.household_id) then
    raise exception 'forbidden';
  end if;
  if inv.used_at is not null then raise exception 'already used'; end if;
  update public.household_invites set revoked_at = now() where id = p_invite_id;
end;
$$;

revoke all on function public.revoke_household_invite(uuid) from public;
grant execute on function public.revoke_household_invite(uuid) to authenticated;

-- Remove member (owner only); immediately loses access via status
create or replace function public.remove_household_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_owner(p_household_id) then raise exception 'forbidden'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot remove yourself as owner'; end if;
  update public.household_members
  set status = 'removed', removed_at = now()
  where household_id = p_household_id and user_id = p_user_id and status = 'active';
end;
$$;

revoke all on function public.remove_household_member(uuid, uuid) from public;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;

-- Optimistic concurrency update for task occurrences
create or replace function public.update_task_occurrence(
  p_id uuid,
  p_expected_version int,
  p_patch jsonb
)
returns public.task_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.task_occurrences;
  role text;
  new_status text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into t from public.task_occurrences where id = p_id and deleted_at is null for update;
  if t.id is null then raise exception 'not found'; end if;
  if not public.is_active_member(t.household_id) then raise exception 'forbidden'; end if;
  if t.version <> p_expected_version then
    raise exception 'version conflict' using errcode = '40001';
  end if;

  role := public.member_role(t.household_id);

  if role = 'helper' then
    -- only status + completion fields from patch
    new_status := coalesce(p_patch->>'status', t.status);
    if new_status not in (
      'acknowledged', 'in_progress', 'needs_clarification',
      'cannot_complete', 'delayed', 'completed'
    ) and new_status is distinct from t.status then
      raise exception 'helpers cannot set status';
    end if;
    update public.task_occurrences set
      status = new_status,
      completed_at = case when new_status = 'completed' then now() else completed_at end,
      completed_by = case when new_status = 'completed' then auth.uid() else completed_by end,
      updated_at = now()
    where id = p_id
    returning * into t;
  elsif role in ('owner', 'employer') then
    update public.task_occurrences set
      title_zh = coalesce(p_patch->>'title_zh', title_zh),
      title_id = coalesce(p_patch->>'title_id', title_id),
      instructions_zh = coalesce(p_patch->>'instructions_zh', instructions_zh),
      instructions_id = coalesce(p_patch->>'instructions_id', instructions_id),
      status = coalesce(p_patch->>'status', status),
      priority = coalesce(p_patch->>'priority', priority),
      due_at = case when p_patch ? 'due_at' then (p_patch->>'due_at')::timestamptz else due_at end,
      assigned_to = case when p_patch ? 'assigned_to' then (p_patch->>'assigned_to')::uuid else assigned_to end,
      translation_approved = coalesce((p_patch->>'translation_approved')::boolean, translation_approved),
      completed_at = case
        when coalesce(p_patch->>'status', status) = 'completed' then coalesce(completed_at, now())
        when p_patch->>'status' is not null and p_patch->>'status' <> 'completed' then null
        else completed_at end,
      completed_by = case
        when coalesce(p_patch->>'status', status) = 'completed' then coalesce(completed_by, auth.uid())
        when p_patch->>'status' is not null and p_patch->>'status' <> 'completed' then null
        else completed_by end,
      updated_at = now()
    where id = p_id
    returning * into t;
  else
    raise exception 'forbidden';
  end if;

  insert into public.task_events (household_id, task_occurrence_id, actor_id, event_type, previous_value, new_value)
  values (
    t.household_id, t.id, auth.uid(), 'update',
    jsonb_build_object('version', p_expected_version),
    p_patch
  );

  return t;
end;
$$;

revoke all on function public.update_task_occurrence(uuid, int, jsonb) from public;
grant execute on function public.update_task_occurrence(uuid, int, jsonb) to authenticated;

-- Generate today's occurrences from active daily/weekday templates (employer call or cron later)
create or replace function public.ensure_today_occurrences(p_household_id uuid, p_date date default (timezone('Asia/Hong_Kong', now()))::date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  tmpl record;
  inserted int := 0;
  dow int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_active_member(p_household_id) then raise exception 'forbidden'; end if;

  dow := extract(isodow from p_date)::int; -- 1=Mon .. 7=Sun

  for tmpl in
    select * from public.task_templates
    where household_id = p_household_id
      and is_active = true
      and deleted_at is null
      and recurrence_rule in ('daily', 'weekdays', 'weekly', 'monthly', 'none')
  loop
    if tmpl.recurrence_rule = 'none' then
      continue; -- one-shot handled at creation time
    end if;
    if tmpl.recurrence_rule = 'weekdays' and dow > 5 then
      continue;
    end if;
    if tmpl.recurrence_rule = 'weekly'
       and tmpl.recurrence_weekdays is not null
       and not (dow = any (tmpl.recurrence_weekdays)) then
      continue;
    end if;
    if tmpl.start_date is not null and p_date < tmpl.start_date then continue; end if;
    if tmpl.end_date is not null and p_date > tmpl.end_date then continue; end if;

    insert into public.task_occurrences (
      household_id, template_id, task_date, due_at,
      title_zh, title_id, instructions_zh, instructions_id,
      assigned_to, status, priority, created_by, translation_approved
    )
    values (
      tmpl.household_id, tmpl.id, p_date,
      case when tmpl.default_time is not null
        then (p_date + tmpl.default_time) at time zone 'Asia/Hong_Kong'
        else null end,
      tmpl.title_zh, tmpl.title_id, tmpl.instructions_zh, tmpl.instructions_id,
      tmpl.assigned_to, 'pending', tmpl.priority, auth.uid(), tmpl.translation_approved
    )
    on conflict (template_id, task_date) do nothing;

    if found then inserted := inserted + 1; end if;
  end loop;

  return inserted;
end;
$$;

revoke all on function public.ensure_today_occurrences(uuid, date) from public;
grant execute on function public.ensure_today_occurrences(uuid, date) to authenticated;
