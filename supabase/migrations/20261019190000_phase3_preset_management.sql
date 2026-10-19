-- Phase 3: household preset edit fields, versioning meta, soft-archive safety

alter table public.task_presets
  add column if not exists additional_instructions_zh text not null default '',
  add column if not exists additional_instructions_id text not null default '',
  add column if not exists template_version int not null default 1;

alter table public.task_presets
  drop constraint if exists task_presets_template_version_check;
alter table public.task_presets
  add constraint task_presets_template_version_check
  check (template_version >= 1);

comment on column public.task_presets.template_version is
  'Bumped on household/system content updates; clients may compare for cache freshness.';
comment on column public.task_presets.additional_instructions_zh is
  'Default supplemental instructions (ZH) copied into drafts when creating from preset.';
comment on column public.task_presets.additional_instructions_id is
  'Default supplemental instructions (ID).';

create table if not exists public.preset_library_meta (
  id text primary key default 'global',
  seed_version text not null default '2026.10.19',
  last_synced_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  constraint preset_library_meta_singleton check (id = 'global')
);

insert into public.preset_library_meta (id, seed_version, last_synced_at)
values ('global', '2026.10.19', now())
on conflict (id) do update
  set seed_version = excluded.seed_version,
      updated_at = now();

alter table public.preset_library_meta enable row level security;

drop policy if exists preset_library_meta_select on public.preset_library_meta;
create policy preset_library_meta_select on public.preset_library_meta
  for select to authenticated
  using (true);

alter table public.task_preset_usage
  drop constraint if exists task_preset_usage_preset_id_fkey;
alter table public.task_preset_usage
  add constraint task_preset_usage_preset_id_fkey
  foreign key (preset_id) references public.task_presets (id) on delete restrict;

create or replace function public.restore_household_preset(p_preset_id uuid)
returns public.task_presets
language plpgsql
security invoker
set search_path = public
as $$
declare
  p public.task_presets;
begin
  if auth.uid() is null then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Authentication required');
  end if;
  select * into p from public.task_presets
  where id = p_preset_id and source = 'household' for update;
  if not found then
    perform private.raise_app_error('INVALID_PRESET', 'Household preset not found');
  end if;
  if not public.is_employer_or_owner(p.household_id) then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Employer or owner required');
  end if;
  update public.task_presets
  set archived_at = null,
      is_active = true,
      template_version = template_version + 1,
      updated_at = now()
  where id = p_preset_id
  returning * into p;
  return p;
end;
$$;

revoke all on function public.restore_household_preset(uuid) from public;
grant execute on function public.restore_household_preset(uuid) to authenticated;

create or replace function public.update_household_preset(
  p_preset_id uuid,
  p_patch jsonb
)
returns public.task_presets
language plpgsql
security invoker
set search_path = public
as $$
declare
  p public.task_presets;
  patch jsonb := coalesce(p_patch, '{}'::jsonb);
begin
  if auth.uid() is null then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Authentication required');
  end if;
  select * into p from public.task_presets
  where id = p_preset_id and source = 'household' and archived_at is null for update;
  if not found then
    perform private.raise_app_error('INVALID_PRESET', 'Household preset not found or archived');
  end if;
  if not public.is_employer_or_owner(p.household_id) then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Employer or owner required');
  end if;

  update public.task_presets set
    category_id = coalesce(nullif(patch->>'category_id','')::uuid, category_id),
    title_zh = coalesce(nullif(patch->>'title_zh',''), title_zh),
    title_id = coalesce(nullif(patch->>'title_id',''), title_id),
    instructions_zh = coalesce(patch->>'instructions_zh', instructions_zh),
    instructions_id = coalesce(patch->>'instructions_id', instructions_id),
    additional_instructions_zh = coalesce(patch->>'additional_instructions_zh', additional_instructions_zh),
    additional_instructions_id = coalesce(patch->>'additional_instructions_id', additional_instructions_id),
    suggested_task_type = coalesce(nullif(patch->>'suggested_task_type',''), suggested_task_type),
    suggested_time = case
      when patch ? 'suggested_time' and nullif(patch->>'suggested_time','') is not null
        then left(patch->>'suggested_time', 5)::time
      when patch ? 'suggested_time' and nullif(patch->>'suggested_time','') is null
        then null
      else suggested_time end,
    suggested_recurrence = case
      when patch ? 'suggested_recurrence' then patch->'suggested_recurrence'
      else suggested_recurrence end,
    suggested_priority = coalesce(nullif(patch->>'suggested_priority',''), suggested_priority),
    safety_warning = coalesce((patch->>'safety_warning')::boolean, safety_warning),
    translation_approved = coalesce((patch->>'translation_approved')::boolean, translation_approved),
    keywords = case
      when patch ? 'keywords' and jsonb_typeof(patch->'keywords') = 'array'
        then (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(patch->'keywords') t(x))
      else keywords end,
    template_version = template_version + 1,
    updated_at = now()
  where id = p_preset_id
  returning * into p;

  return p;
end;
$$;

revoke all on function public.update_household_preset(uuid, jsonb) from public;
grant execute on function public.update_household_preset(uuid, jsonb) to authenticated;

create or replace function public.archive_household_preset(p_preset_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  p public.task_presets;
  usage_count int;
begin
  if auth.uid() is null then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Authentication required');
  end if;
  select * into p from public.task_presets
  where id = p_preset_id and source = 'household' for update;
  if not found then
    perform private.raise_app_error('INVALID_PRESET', 'Household preset not found');
  end if;
  if not public.is_employer_or_owner(p.household_id) then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Employer or owner required');
  end if;

  select count(*)::int into usage_count
  from public.task_preset_usage where preset_id = p_preset_id;

  update public.task_presets
  set archived_at = coalesce(archived_at, now()),
      is_active = false,
      template_version = template_version + 1,
      updated_at = now()
  where id = p_preset_id
  returning * into p;

  return jsonb_build_object(
    'ok', true,
    'preset_id', p.id,
    'usage_count', usage_count,
    'archived_at', p.archived_at
  );
end;
$$;

revoke all on function public.archive_household_preset(uuid) from public;
grant execute on function public.archive_household_preset(uuid) to authenticated;
