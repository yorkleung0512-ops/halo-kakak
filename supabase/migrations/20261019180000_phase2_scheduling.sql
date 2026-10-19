-- Phase 2: scheduling expansion, pause/resume, scoped edit RPC
-- Weekday convention: ISO 1=Mon .. 7=Sun (PostgreSQL extract(isodow))

-- Expand recurrence_rule + interval + paused_at (backward compatible)
alter table public.task_templates
  drop constraint if exists task_templates_recurrence_rule_check;

alter table public.task_templates
  add constraint task_templates_recurrence_rule_check
  check (recurrence_rule in (
    'none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'custom'
  ));

alter table public.task_templates
  add column if not exists recurrence_interval int not null default 1;

alter table public.task_templates
  drop constraint if exists task_templates_recurrence_interval_check;

alter table public.task_templates
  add constraint task_templates_recurrence_interval_check
  check (recurrence_interval >= 1 and recurrence_interval <= 365);

alter table public.task_templates
  add column if not exists paused_at timestamptz;

comment on column public.task_templates.recurrence_weekdays is
  'ISO weekdays 1=Mon .. 7=Sun. Null means every day for weekly/biweekly.';
comment on column public.task_templates.recurrence_interval is
  'For daily/custom: days between. For weekly/biweekly: weeks between (biweekly implies 2). For monthly: months between.';
comment on column public.task_templates.paused_at is
  'When set, template is paused (is_active may still be true); ensure_today skips.';

-- Does this template generate an occurrence on p_date?
create or replace function private.template_applies_on_date(
  tmpl public.task_templates,
  p_date date
)
returns boolean
language plpgsql
immutable
as $$
declare
  dow int;
  start_d date;
  interval_n int;
  weeks_diff int;
  months_diff int;
  day_diff int;
begin
  if tmpl.deleted_at is not null then return false; end if;
  if tmpl.is_active is not true then return false; end if;
  if tmpl.paused_at is not null then return false; end if;
  if tmpl.recurrence_rule = 'none' then return false; end if;

  start_d := coalesce(tmpl.start_date, p_date);
  if p_date < start_d then return false; end if;
  if tmpl.end_date is not null and p_date > tmpl.end_date then return false; end if;

  dow := extract(isodow from p_date)::int;
  interval_n := greatest(coalesce(tmpl.recurrence_interval, 1), 1);

  if tmpl.recurrence_rule = 'daily' then
    day_diff := p_date - start_d;
    return (day_diff % interval_n) = 0;
  end if;

  if tmpl.recurrence_rule = 'weekdays' then
    return dow <= 5;
  end if;

  if tmpl.recurrence_rule = 'weekly' then
    if tmpl.recurrence_weekdays is not null
       and array_length(tmpl.recurrence_weekdays, 1) is not null
       and not (dow = any (tmpl.recurrence_weekdays)) then
      return false;
    end if;
    weeks_diff := ((p_date - start_d) / 7);
    return (weeks_diff % interval_n) = 0;
  end if;

  if tmpl.recurrence_rule = 'biweekly' then
    if tmpl.recurrence_weekdays is not null
       and array_length(tmpl.recurrence_weekdays, 1) is not null
       and not (dow = any (tmpl.recurrence_weekdays)) then
      return false;
    elsif tmpl.recurrence_weekdays is null
       and dow <> extract(isodow from start_d)::int then
      return false;
    end if;
    weeks_diff := ((p_date - start_d) / 7);
    return (weeks_diff % 2) = 0;
  end if;

  if tmpl.recurrence_rule = 'monthly' then
    -- Same day-of-month as start (clamp when month shorter)
    if extract(day from p_date)::int
         <> least(
              extract(day from start_d)::int,
              extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day')::date)::int
            )
    then
      -- Allow last-day clamp: if start day > last day of this month, match last day
      if extract(day from start_d)::int
           > extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day')::date)::int
         and extract(day from p_date)::int
           = extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day')::date)::int
      then
        null; -- ok
      else
        return false;
      end if;
    end if;
    months_diff := (extract(year from p_date)::int - extract(year from start_d)::int) * 12
                 + (extract(month from p_date)::int - extract(month from start_d)::int);
    return months_diff >= 0 and (months_diff % interval_n) = 0;
  end if;

  if tmpl.recurrence_rule = 'custom' then
    day_diff := p_date - start_d;
    return (day_diff % interval_n) = 0;
  end if;

  return false;
end;
$$;

revoke all on function private.template_applies_on_date(public.task_templates, date) from public;

-- ensure_today with full pattern support
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
  tmpl public.task_templates;
  inserted int := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_active_member(p_household_id) then raise exception 'forbidden'; end if;

  for tmpl in
    select * from public.task_templates
    where household_id = p_household_id
      and deleted_at is null
      and is_active = true
      and recurrence_rule in ('daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'custom')
  loop
    if not private.template_applies_on_date(tmpl, p_date) then
      continue;
    end if;

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

-- Pause / resume recurring template
create or replace function public.set_task_template_paused(
  p_template_id uuid,
  p_paused boolean
)
returns public.task_templates
language plpgsql
security invoker
set search_path = public
as $$
declare
  t public.task_templates;
begin
  if auth.uid() is null then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Authentication required');
  end if;

  select * into t from public.task_templates where id = p_template_id and deleted_at is null;
  if not found then
    perform private.raise_app_error('BATCH_FAILED', 'Template not found');
  end if;
  if not public.is_employer_or_owner(t.household_id) then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Employer or owner required');
  end if;

  update public.task_templates
  set paused_at = case when p_paused then coalesce(paused_at, now()) else null end,
      is_active = case when p_paused then is_active else true end,
      updated_at = now()
  where id = p_template_id
  returning * into t;

  insert into public.task_events (household_id, task_occurrence_id, actor_id, event_type, previous_value, new_value)
  values (
    t.household_id, null, auth.uid(),
    case when p_paused then 'template_paused' else 'template_resumed' end,
    jsonb_build_object('template_id', p_template_id),
    jsonb_build_object('paused', p_paused)
  );

  return t;
end;
$$;

revoke all on function public.set_task_template_paused(uuid, boolean) from public;
grant execute on function public.set_task_template_paused(uuid, boolean) to authenticated;

-- Allow template-level audit events without an occurrence
alter table public.task_events
  alter column task_occurrence_id drop not null;

-- Scoped edit for recurring tasks
-- p_scope: this_only | this_and_future | entire_series
create or replace function public.edit_task_occurrence_scoped(
  p_id uuid,
  p_expected_version int,
  p_scope text,
  p_patch jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  occ public.task_occurrences;
  tmpl public.task_templates;
  updated_occ public.task_occurrences;
  scope text := lower(coalesce(p_scope, 'this_only'));
  patch jsonb := coalesce(p_patch, '{}'::jsonb);
  fut record;
  n_future int := 0;
begin
  if auth.uid() is null then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Authentication required');
  end if;
  if scope not in ('this_only', 'this_and_future', 'entire_series') then
    perform private.raise_app_error('INVALID_SCOPE', 'scope must be this_only|this_and_future|entire_series');
  end if;

  select * into occ from public.task_occurrences
  where id = p_id and deleted_at is null for update;
  if not found then
    perform private.raise_app_error('BATCH_FAILED', 'Occurrence not found');
  end if;
  if not public.is_employer_or_owner(occ.household_id) then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Employer or owner required');
  end if;
  if occ.version is distinct from p_expected_version then
    raise exception 'version conflict' using errcode = '40001';
  end if;

  -- Always update this occurrence (never overwrite completed status via this path unless patch says so)
  if occ.status = 'completed' and scope <> 'this_only' then
    -- still allow this_only edits on completed; for series scopes skip completed rows later
    null;
  end if;

  update public.task_occurrences set
    title_zh = coalesce(patch->>'title_zh', title_zh),
    title_id = coalesce(patch->>'title_id', title_id),
    instructions_zh = coalesce(patch->>'instructions_zh', instructions_zh),
    instructions_id = coalesce(patch->>'instructions_id', instructions_id),
    additional_instructions_zh = coalesce(patch->>'additional_instructions_zh', additional_instructions_zh),
    additional_instructions_id = coalesce(patch->>'additional_instructions_id', additional_instructions_id),
    priority = coalesce(patch->>'priority', priority),
    due_at = case when patch ? 'due_at' then nullif(patch->>'due_at', '')::timestamptz else due_at end,
    assigned_to = case
      when patch ? 'assigned_to' then nullif(patch->>'assigned_to', '')::uuid
      else assigned_to end,
    translation_approved = coalesce((patch->>'translation_approved')::boolean, translation_approved),
    updated_at = now()
  where id = p_id
  returning * into updated_occ;

  insert into public.task_events (household_id, task_occurrence_id, actor_id, event_type, previous_value, new_value)
  values (
    occ.household_id, occ.id, auth.uid(), 'scoped_edit',
    jsonb_build_object('scope', scope, 'version', p_expected_version),
    patch
  );

  if scope = 'this_only' or occ.template_id is null then
    return jsonb_build_object(
      'ok', true,
      'scope', scope,
      'occurrence', to_jsonb(updated_occ),
      'future_updated', 0
    );
  end if;

  select * into tmpl from public.task_templates
  where id = occ.template_id and deleted_at is null for update;
  if not found then
    return jsonb_build_object('ok', true, 'scope', scope, 'occurrence', to_jsonb(updated_occ), 'future_updated', 0);
  end if;

  -- Update template schedule/content for this_and_future / entire_series
  update public.task_templates set
    title_zh = coalesce(patch->>'title_zh', title_zh),
    title_id = coalesce(patch->>'title_id', title_id),
    instructions_zh = coalesce(patch->>'instructions_zh', instructions_zh),
    instructions_id = coalesce(patch->>'instructions_id', instructions_id),
    additional_instructions_zh = coalesce(patch->>'additional_instructions_zh', additional_instructions_zh),
    additional_instructions_id = coalesce(patch->>'additional_instructions_id', additional_instructions_id),
    priority = coalesce(patch->>'priority', priority),
    default_time = case
      when patch ? 'due_time' and nullif(patch->>'due_time','') is not null
        then left(patch->>'due_time', 5)::time
      when patch ? 'default_time' and nullif(patch->>'default_time','') is not null
        then left(patch->>'default_time', 5)::time
      else default_time end,
    recurrence_rule = coalesce(nullif(patch->>'recurrence_rule',''), recurrence_rule),
    recurrence_interval = coalesce((patch->>'recurrence_interval')::int, recurrence_interval),
    recurrence_weekdays = case
      when patch ? 'recurrence_weekdays' and jsonb_typeof(patch->'recurrence_weekdays') = 'array'
        then (select array_agg(x::int) from jsonb_array_elements_text(patch->'recurrence_weekdays') t(x))
      else recurrence_weekdays end,
    end_date = case
      when patch ? 'end_date' then nullif(patch->>'end_date','')::date
      else end_date end,
    assigned_to = case
      when patch ? 'assigned_to' then nullif(patch->>'assigned_to', '')::uuid
      else assigned_to end,
    translation_approved = coalesce((patch->>'translation_approved')::boolean, translation_approved),
    start_date = case
      when scope = 'this_and_future' then greatest(coalesce(start_date, occ.task_date), occ.task_date)
      else start_date end,
    updated_at = now()
  where id = tmpl.id
  returning * into tmpl;

  -- Propagate to other non-completed occurrences
  for fut in
    select * from public.task_occurrences
    where template_id = tmpl.id
      and deleted_at is null
      and id <> occ.id
      and status <> 'completed'
      and (
        (scope = 'this_and_future' and task_date >= occ.task_date)
        or scope = 'entire_series'
      )
    for update
  loop
    update public.task_occurrences set
      title_zh = coalesce(patch->>'title_zh', title_zh),
      title_id = coalesce(patch->>'title_id', title_id),
      instructions_zh = coalesce(patch->>'instructions_zh', instructions_zh),
      instructions_id = coalesce(patch->>'instructions_id', instructions_id),
      additional_instructions_zh = coalesce(patch->>'additional_instructions_zh', additional_instructions_zh),
      additional_instructions_id = coalesce(patch->>'additional_instructions_id', additional_instructions_id),
      priority = coalesce(patch->>'priority', priority),
      assigned_to = case
        when patch ? 'assigned_to' then nullif(patch->>'assigned_to', '')::uuid
        else assigned_to end,
      translation_approved = coalesce((patch->>'translation_approved')::boolean, translation_approved),
      due_at = case
        when patch ? 'due_time' and nullif(patch->>'due_time','') is not null then
          (task_date::text || 'T' || left(patch->>'due_time', 5) || ':00+08:00')::timestamptz
        when patch ? 'due_at' then nullif(patch->>'due_at','')::timestamptz
        else due_at end,
      updated_at = now()
    where id = fut.id;
    n_future := n_future + 1;
  end loop;

  insert into public.task_events (household_id, task_occurrence_id, actor_id, event_type, previous_value, new_value)
  values (
    occ.household_id, occ.id, auth.uid(), 'scoped_edit_propagate',
    jsonb_build_object('scope', scope),
    jsonb_build_object('future_updated', n_future, 'template_id', tmpl.id)
  );

  return jsonb_build_object(
    'ok', true,
    'scope', scope,
    'occurrence', to_jsonb(updated_occ),
    'template_id', tmpl.id,
    'future_updated', n_future
  );
end;
$$;

revoke all on function public.edit_task_occurrence_scoped(uuid, int, text, jsonb) from public;
grant execute on function public.edit_task_occurrence_scoped(uuid, int, text, jsonb) to authenticated;
