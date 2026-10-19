-- Task preset library: reusable bilingual templates (system + household).
-- Separate from task_templates (active recurring schedules).

-- ---------------------------------------------------------------------------
-- task_preset_categories
-- ---------------------------------------------------------------------------
create table if not exists public.task_preset_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_zh text not null,
  name_id text not null,
  icon text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create index if not exists idx_task_preset_categories_sort
  on public.task_preset_categories (sort_order)
  where is_active = true;

-- ---------------------------------------------------------------------------
-- task_presets
-- ---------------------------------------------------------------------------
create table if not exists public.task_presets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  source text not null
    check (source in ('system', 'household')),
  category_id uuid not null references public.task_preset_categories (id),
  system_key text,
  title_zh text not null,
  title_id text not null,
  instructions_zh text not null default '',
  instructions_id text not null default '',
  suggested_task_type text not null default 'scheduled'
    check (suggested_task_type in ('adhoc', 'scheduled')),
  suggested_time time,
  suggested_recurrence jsonb,
  suggested_priority text not null default 'normal'
    check (suggested_priority in ('low', 'normal', 'high', 'urgent')),
  safety_warning boolean not null default false,
  translation_approved boolean not null default true,
  keywords text[] not null default '{}',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint task_presets_source_household_ck check (
    (source = 'system' and household_id is null)
    or (source = 'household' and household_id is not null)
  ),
  constraint task_presets_system_key_ck check (
    (source = 'system' and system_key is not null)
    or (source = 'household' and system_key is null)
  )
);

create unique index if not exists idx_task_presets_system_key
  on public.task_presets (system_key);

create index if not exists idx_task_presets_category
  on public.task_presets (category_id)
  where archived_at is null and is_active = true;

create index if not exists idx_task_presets_household_source
  on public.task_presets (household_id, source)
  where archived_at is null and is_active = true;

create index if not exists idx_task_presets_active
  on public.task_presets (is_active)
  where archived_at is null;

drop trigger if exists trg_task_presets_updated_at on public.task_presets;
create trigger trg_task_presets_updated_at
  before update on public.task_presets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- task_preset_usage (recently used, dedupe by querying distinct presets)
-- ---------------------------------------------------------------------------
create table if not exists public.task_preset_usage (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  preset_id uuid not null references public.task_presets (id) on delete cascade,
  created_task_occurrence_id uuid references public.task_occurrences (id) on delete set null,
  created_task_template_id uuid references public.task_templates (id) on delete set null,
  used_by uuid not null references auth.users (id),
  used_at timestamptz not null default now()
);

create index if not exists idx_task_preset_usage_household_recent
  on public.task_preset_usage (household_id, used_at desc);

create index if not exists idx_task_preset_usage_preset
  on public.task_preset_usage (preset_id, used_at desc);

-- ---------------------------------------------------------------------------
-- household_preset_favourites
-- ---------------------------------------------------------------------------
create table if not exists public.household_preset_favourites (
  household_id uuid not null references public.households (id) on delete cascade,
  preset_id uuid not null references public.task_presets (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (household_id, preset_id)
);

create index if not exists idx_household_preset_favourites_preset
  on public.household_preset_favourites (preset_id);
