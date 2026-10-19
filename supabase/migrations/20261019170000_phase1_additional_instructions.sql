-- Phase 1: additional instructions columns + ensure_today inheritance
-- Backward-compatible: default empty; no drops.

alter table public.task_templates
  add column if not exists additional_instructions_zh text not null default '',
  add column if not exists additional_instructions_id text not null default '';

alter table public.task_occurrences
  add column if not exists additional_instructions_zh text not null default '',
  add column if not exists additional_instructions_id text not null default '';

-- Copy additional_instructions when generating today's occurrences from templates.
create or replace function public.ensure_today_occurrences(
  p_household_id uuid,
  p_date date default (timezone('Asia/Hong_Kong', now()))::date
)
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

  dow := extract(isodow from p_date)::int;

  for tmpl in
    select * from public.task_templates
    where household_id = p_household_id
      and is_active = true
      and deleted_at is null
      and recurrence_rule in ('daily', 'weekdays', 'weekly', 'monthly', 'none')
  loop
    if tmpl.recurrence_rule = 'none' then
      continue;
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
      additional_instructions_zh, additional_instructions_id,
      assigned_to, status, priority, created_by, translation_approved
    )
    values (
      tmpl.household_id, tmpl.id, p_date,
      case when tmpl.default_time is not null
        then (p_date + tmpl.default_time) at time zone 'Asia/Hong_Kong'
        else null end,
      tmpl.title_zh, tmpl.title_id, tmpl.instructions_zh, tmpl.instructions_id,
      coalesce(tmpl.additional_instructions_zh, ''),
      coalesce(tmpl.additional_instructions_id, ''),
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

-- Extend update RPC with additional_instructions (preserve helper restrictions).
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
      additional_instructions_zh = coalesce(
        p_patch->>'additional_instructions_zh', additional_instructions_zh
      ),
      additional_instructions_id = coalesce(
        p_patch->>'additional_instructions_id', additional_instructions_id
      ),
      status = coalesce(p_patch->>'status', status),
      priority = coalesce(p_patch->>'priority', priority),
      due_at = case when p_patch ? 'due_at' then (p_patch->>'due_at')::timestamptz else due_at end,
      assigned_to = case
        when p_patch ? 'assigned_to' then nullif(p_patch->>'assigned_to', '')::uuid
        else assigned_to end,
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
