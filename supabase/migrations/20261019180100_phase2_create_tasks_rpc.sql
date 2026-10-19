-- Phase 2: extend create_tasks_from_presets for biweekly/custom/interval

create or replace function public.create_tasks_from_presets(
  p_household_id uuid,
  p_idempotency_key uuid,
  p_tasks jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_batch public.task_creation_batches;
  v_batch_id uuid;
  v_item jsonb;
  v_idx int := 0;
  v_mode text;
  v_preset_id uuid;
  v_preset public.task_presets;
  v_title_zh text;
  v_title_id text;
  v_instr_zh text;
  v_instr_id text;
  v_add_zh text;
  v_add_id text;
  v_task_date date;
  v_due_time text;
  v_due_at timestamptz;
  v_start_date date;
  v_end_date date;
  v_rule text;
  v_weekdays int[];
  v_priority text;
  v_assigned uuid;
  v_approved boolean;
  v_client_id text;
  v_occ public.task_occurrences;
  v_tmpl public.task_templates;
  v_created jsonb := '[]'::jsonb;
  v_result jsonb;
  v_today date := (timezone('Asia/Hong_Kong', now()))::date;
  v_dow int;
  v_should_occur boolean;
  v_default_time time;
  v_ok boolean;
  v_interval int;
begin
  if v_uid is null then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Authentication required');
  end if;
  if p_household_id is null or p_idempotency_key is null then
    perform private.raise_app_error('BATCH_FAILED', 'household_id and idempotency_key are required');
  end if;
  if not public.is_employer_or_owner(p_household_id) then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Employer or owner role required');
  end if;
  if p_tasks is null or jsonb_typeof(p_tasks) <> 'array' then
    perform private.raise_app_error('BATCH_FAILED', 'p_tasks must be a JSON array');
  end if;
  if jsonb_array_length(p_tasks) = 0 then
    perform private.raise_app_error('BATCH_FAILED', 'p_tasks must not be empty');
  end if;
  if jsonb_array_length(p_tasks) > 20 then
    perform private.raise_app_error('BATCH_LIMIT_EXCEEDED', 'Maximum 20 tasks per batch');
  end if;

  v_hash := encode(sha256(convert_to(p_tasks::text, 'UTF8')), 'hex');

  insert into public.task_creation_batches (
    household_id, idempotency_key, requested_by, request_hash, status
  ) values (
    p_household_id, p_idempotency_key, v_uid, v_hash, 'pending'
  )
  on conflict (household_id, idempotency_key) do nothing
  returning id into v_batch_id;

  if v_batch_id is null then
    select * into v_batch from public.task_creation_batches
    where household_id = p_household_id and idempotency_key = p_idempotency_key;
    if not found then
      perform private.raise_app_error('BATCH_FAILED', 'Idempotency claim race');
    end if;
    if v_batch.request_hash is distinct from v_hash then
      perform private.raise_app_error('DUPLICATE_REQUEST', 'Same idempotency key with different payload');
    end if;
    if v_batch.status = 'completed' and v_batch.result is not null then
      return v_batch.result || jsonb_build_object('replayed', true);
    end if;
    if v_batch.status = 'pending' then
      perform private.raise_app_error('DUPLICATE_REQUEST', 'Batch already in progress');
    end if;
    if v_batch.status = 'failed' then
      perform private.raise_app_error(coalesce(v_batch.error_code, 'BATCH_FAILED'), coalesce(v_batch.error_message, 'Previous batch failed'));
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_tasks)
  loop
    v_idx := v_idx + 1;
    v_client_id := coalesce(nullif(v_item->>'client_item_id', ''), v_idx::text);
    v_mode := lower(coalesce(v_item->>'mode', ''));
    if v_mode not in ('adhoc', 'scheduled') then
      perform private.raise_app_error('BATCH_FAILED', format('Item %s: mode must be adhoc or scheduled', v_client_id));
    end if;

    v_ok := false;
    begin
      v_preset_id := nullif(v_item->>'preset_id', '')::uuid;
      v_ok := true;
    exception when others then
      v_ok := false;
    end;
    if not v_ok or v_preset_id is null then
      perform private.raise_app_error('INVALID_PRESET', format('Item %s: invalid or missing preset_id', v_client_id));
    end if;

    select * into v_preset from public.task_presets
    where id = v_preset_id and is_active = true and archived_at is null
      and ((source = 'system' and household_id is null)
        or (source = 'household' and household_id = p_household_id));
    if not found then
      perform private.raise_app_error('INVALID_PRESET', format('Item %s: preset not found or inaccessible', v_client_id));
    end if;

    v_title_zh := trim(coalesce(v_item->>'title_zh', v_preset.title_zh, ''));
    v_title_id := trim(coalesce(v_item->>'title_id', v_preset.title_id, ''));
    if v_title_zh = '' then
      perform private.raise_app_error('BATCH_FAILED', format('Item %s: title_zh required', v_client_id));
    end if;
    v_instr_zh := coalesce(v_item->>'instructions_zh', v_preset.instructions_zh, '');
    v_instr_id := coalesce(v_item->>'instructions_id', v_preset.instructions_id, '');
    v_add_zh := coalesce(v_item->>'additional_instructions_zh', '');
    v_add_id := coalesce(v_item->>'additional_instructions_id', '');

    v_ok := false;
    begin
      v_task_date := coalesce(nullif(v_item->>'task_date','')::date, v_today);
      v_start_date := coalesce(nullif(v_item->>'start_date','')::date, v_task_date);
      if v_item ? 'end_date' and nullif(v_item->>'end_date','') is not null then
        v_end_date := (v_item->>'end_date')::date;
      else
        v_end_date := null;
      end if;
      v_ok := true;
    exception when others then
      v_ok := false;
    end;
    if not v_ok then
      perform private.raise_app_error('BATCH_FAILED', format('Item %s: invalid date fields', v_client_id));
    end if;
    if v_end_date is not null and v_start_date > v_end_date then
      perform private.raise_app_error('INVALID_RECURRENCE', format('Item %s: start_date after end_date', v_client_id));
    end if;

    v_due_time := nullif(trim(coalesce(v_item->>'due_time', '')), '');
    if v_due_time is not null and v_due_time !~ '^\d{2}:\d{2}(:\d{2})?$' then
      perform private.raise_app_error('BATCH_FAILED', format('Item %s: invalid due_time', v_client_id));
    end if;

    v_priority := coalesce(nullif(v_item->>'priority', ''), v_preset.suggested_priority, 'normal');
    if v_priority not in ('low', 'normal', 'high', 'urgent') then
      perform private.raise_app_error('BATCH_FAILED', format('Item %s: invalid priority', v_client_id));
    end if;
    v_approved := coalesce((v_item->>'translation_approved')::boolean, v_preset.translation_approved, false);

    v_assigned := null;
    if v_item ? 'assigned_to' and nullif(v_item->>'assigned_to', '') is not null then
      v_ok := false;
      begin
        v_assigned := (v_item->>'assigned_to')::uuid;
        v_ok := true;
      exception when others then
        v_ok := false;
      end;
      if not v_ok then
        perform private.raise_app_error('INVALID_ASSIGNEE', format('Item %s: invalid assigned_to', v_client_id));
      end if;
      if not exists (
        select 1 from public.household_members m
        where m.household_id = p_household_id and m.user_id = v_assigned
          and m.role = 'helper' and m.status = 'active'
      ) then
        perform private.raise_app_error('INVALID_ASSIGNEE', format('Item %s: assignee must be an active helper in this household', v_client_id));
      end if;
    end if;

    if v_mode = 'adhoc' then
      if v_due_time is not null then
        v_due_at := (v_task_date::text || 'T' || left(v_due_time, 5) || ':00+08:00')::timestamptz;
      else
        v_due_at := null;
      end if;
      insert into public.task_occurrences (
        household_id, task_date, due_at,
        title_zh, title_id, instructions_zh, instructions_id,
        additional_instructions_zh, additional_instructions_id,
        assigned_to, status, priority, created_by, translation_approved
      ) values (
        p_household_id, v_task_date, v_due_at,
        v_title_zh, v_title_id, v_instr_zh, v_instr_id,
        v_add_zh, v_add_id,
        v_assigned, 'pending', v_priority, v_uid, v_approved
      ) returning * into v_occ;

      insert into public.task_preset_usage (
        household_id, preset_id, used_by, created_task_occurrence_id, created_task_template_id
      ) values (p_household_id, v_preset_id, v_uid, v_occ.id, null);

      v_created := v_created || jsonb_build_array(jsonb_build_object(
        'client_item_id', v_client_id, 'mode', 'adhoc', 'preset_id', v_preset_id,
        'occurrence_id', v_occ.id, 'template_id', null
      ));
    else
      v_rule := coalesce(nullif(v_item->>'recurrence_rule', ''), 'daily');
      if v_rule not in ('daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'custom') then
        perform private.raise_app_error('INVALID_RECURRENCE', format('Item %s: invalid recurrence_rule', v_client_id));
      end if;
      v_weekdays := null;
      if v_item ? 'recurrence_weekdays' and jsonb_typeof(v_item->'recurrence_weekdays') = 'array' then
        select array_agg(x::int order by ord) into v_weekdays
        from jsonb_array_elements_text(v_item->'recurrence_weekdays') with ordinality as t(x, ord);
        if exists (select 1 from unnest(v_weekdays) w where w < 1 or w > 7) then
          perform private.raise_app_error('INVALID_RECURRENCE', format('Item %s: weekdays must be 1-7', v_client_id));
        end if;
      end if;
      v_interval := coalesce(nullif(v_item->>'recurrence_interval','')::int, 1);
      if v_interval < 1 or v_interval > 365 then
        perform private.raise_app_error('INVALID_RECURRENCE', format('Item %s: invalid recurrence_interval', v_client_id));
      end if;
      if v_rule = 'biweekly' then
        v_interval := greatest(v_interval, 2);
      end if;
      if v_rule in ('weekly', 'biweekly', 'custom') and v_item ? 'recurrence_weekdays'
         and jsonb_typeof(v_item->'recurrence_weekdays') = 'array' then
        null; -- already parsed above
      end if;

      if v_due_time is not null then
        v_default_time := left(v_due_time, 5)::time;
      else
        v_default_time := null;
      end if;

      insert into public.task_templates (
        household_id, title_zh, title_id, instructions_zh, instructions_id,
        additional_instructions_zh, additional_instructions_id,
        default_time, recurrence_rule, recurrence_weekdays, recurrence_interval,
        start_date, end_date, priority, assigned_to,
        created_by, translation_approved, is_active
      ) values (
        p_household_id, v_title_zh, v_title_id, v_instr_zh, v_instr_id,
        v_add_zh, v_add_id,
        v_default_time, v_rule, v_weekdays, v_interval,
        v_start_date, v_end_date, v_priority, v_assigned,
        v_uid, v_approved, true
      ) returning * into v_tmpl;

      v_should_occur := private.template_applies_on_date(v_tmpl, v_task_date);

      v_occ := null;
      if v_should_occur then
        if v_default_time is not null then
          v_due_at := (v_task_date + v_default_time) at time zone 'Asia/Hong_Kong';
        else
          v_due_at := null;
        end if;
        insert into public.task_occurrences (
          household_id, template_id, task_date, due_at,
          title_zh, title_id, instructions_zh, instructions_id,
          additional_instructions_zh, additional_instructions_id,
          assigned_to, status, priority, created_by, translation_approved
        ) values (
          p_household_id, v_tmpl.id, v_task_date, v_due_at,
          v_title_zh, v_title_id, v_instr_zh, v_instr_id,
          v_add_zh, v_add_id,
          v_assigned, 'pending', v_priority, v_uid, v_approved
        )
        on conflict (template_id, task_date) do nothing
        returning * into v_occ;
      end if;

      insert into public.task_preset_usage (
        household_id, preset_id, used_by, created_task_occurrence_id, created_task_template_id
      ) values (p_household_id, v_preset_id, v_uid, v_occ.id, v_tmpl.id);

      v_created := v_created || jsonb_build_array(jsonb_build_object(
        'client_item_id', v_client_id, 'mode', 'scheduled', 'preset_id', v_preset_id,
        'occurrence_id', v_occ.id, 'template_id', v_tmpl.id
      ));
    end if;
  end loop;

  v_result := jsonb_build_object(
    'ok', true,
    'batch_id', coalesce(v_batch_id, v_batch.id),
    'idempotency_key', p_idempotency_key,
    'replayed', false,
    'created', v_created,
    'count', jsonb_array_length(v_created)
  );

  update public.task_creation_batches
  set status = 'completed', result = v_result, completed_at = now()
  where id = coalesce(v_batch_id, v_batch.id);

  return v_result;
exception
  when others then
    if sqlerrm in (
      'NOT_AUTHORIZED', 'INVALID_ASSIGNEE', 'INVALID_PRESET', 'INVALID_RECURRENCE',
      'DUPLICATE_REQUEST', 'BATCH_LIMIT_EXCEEDED', 'BATCH_FAILED', 'PAYLOAD_MISMATCH'
    ) or sqlerrm like 'NOT_AUTHORIZED%' or sqlerrm like 'INVALID_%'
      or sqlerrm like 'DUPLICATE_%' or sqlerrm like 'BATCH_%' then
      raise;
    end if;
    raise exception 'BATCH_FAILED' using errcode = 'P0001', detail = sqlerrm;
end;
$fn$;

revoke all on function public.create_tasks_from_presets(uuid, uuid, jsonb) from public;
grant execute on function public.create_tasks_from_presets(uuid, uuid, jsonb) to authenticated;
