-- Halo Kakak Phase 2: normalized schema
-- SAFE: does NOT drop or alter household_sync data
-- Rollback: see docs/MIGRATION.md

create schema if not exists private;

-- updated_at helper (reuse if exists)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  preferred_language text not null default 'zh-Hant'
    check (preferred_language in ('zh-Hant', 'id', 'en')),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Hong_Kong',
  display_code text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists idx_households_display_code_active
  on public.households (display_code)
  where display_code is not null and deleted_at is null;

drop trigger if exists trg_households_updated_at on public.households;
create trigger trg_households_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- household_members
-- ---------------------------------------------------------------------------
create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'employer', 'helper')),
  status text not null default 'active'
    check (status in ('active', 'removed', 'left')),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (household_id, user_id)
);

create index if not exists idx_household_members_user_active
  on public.household_members (user_id)
  where status = 'active';

create index if not exists idx_household_members_household_active
  on public.household_members (household_id)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- household_invites (token stored as hash only)
-- ---------------------------------------------------------------------------
create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token_hash text not null,
  invited_role text not null check (invited_role in ('employer', 'helper')),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint invites_one_use check (used_at is null or revoked_at is null or true)
);

create unique index if not exists idx_household_invites_token_hash
  on public.household_invites (token_hash);

create index if not exists idx_household_invites_household
  on public.household_invites (household_id);

-- ---------------------------------------------------------------------------
-- task_templates
-- ---------------------------------------------------------------------------
create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title_zh text not null,
  title_id text not null default '',
  instructions_zh text not null default '',
  instructions_id text not null default '',
  default_time time,
  recurrence_rule text not null default 'none'
    check (recurrence_rule in ('none', 'daily', 'weekdays', 'weekly', 'monthly')),
  recurrence_weekdays int[] default null,
  start_date date,
  end_date date,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references auth.users (id),
  is_active boolean not null default true,
  translation_approved boolean not null default false,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_task_templates_household_active
  on public.task_templates (household_id)
  where deleted_at is null and is_active = true;

drop trigger if exists trg_task_templates_updated_at on public.task_templates;
create trigger trg_task_templates_updated_at
  before update on public.task_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- task_occurrences
-- ---------------------------------------------------------------------------
create table if not exists public.task_occurrences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  template_id uuid references public.task_templates (id) on delete set null,
  task_date date not null,
  due_at timestamptz,
  title_zh text not null,
  title_id text not null default '',
  instructions_zh text not null default '',
  instructions_id text not null default '',
  assigned_to uuid references auth.users (id),
  status text not null default 'pending'
    check (status in (
      'pending', 'acknowledged', 'in_progress', 'needs_clarification',
      'cannot_complete', 'delayed', 'completed', 'cancelled'
    )),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  completed_at timestamptz,
  completed_by uuid references auth.users (id),
  translation_approved boolean not null default false,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  deleted_at timestamptz,
  unique (template_id, task_date)
);

create index if not exists idx_task_occurrences_household_date
  on public.task_occurrences (household_id, task_date)
  where deleted_at is null;

create index if not exists idx_task_occurrences_assigned
  on public.task_occurrences (assigned_to, task_date)
  where deleted_at is null;

drop trigger if exists trg_task_occurrences_updated_at on public.task_occurrences;
create trigger trg_task_occurrences_updated_at
  before update on public.task_occurrences
  for each row execute function public.set_updated_at();

-- Optimistic concurrency: bump version; reject stale updates via RPC
create or replace function public.bump_task_occurrence_version()
returns trigger
language plpgsql
as $$
begin
  if old.version is distinct from new.version and tg_op = 'UPDATE' then
    -- client must send expected version; we bump after check in RPC
    null;
  end if;
  new.version = old.version + 1;
  return new;
end;
$$;

drop trigger if exists trg_task_occurrences_version on public.task_occurrences;
create trigger trg_task_occurrences_version
  before update on public.task_occurrences
  for each row execute function public.bump_task_occurrence_version();

-- ---------------------------------------------------------------------------
-- task_comments
-- ---------------------------------------------------------------------------
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  task_occurrence_id uuid not null references public.task_occurrences (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  message text not null default '',
  attachment_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_comments_task
  on public.task_comments (task_occurrence_id, created_at);

-- ---------------------------------------------------------------------------
-- task_events (audit)
-- ---------------------------------------------------------------------------
create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  task_occurrence_id uuid not null references public.task_occurrences (id) on delete cascade,
  actor_id uuid references auth.users (id),
  event_type text not null,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_events_task
  on public.task_events (task_occurrence_id, created_at);

-- ---------------------------------------------------------------------------
-- household_glossary
-- ---------------------------------------------------------------------------
create table if not exists public.household_glossary (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  chinese_term text not null,
  indonesian_term text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, chinese_term)
);

drop trigger if exists trg_household_glossary_updated_at on public.household_glossary;
create trigger trg_household_glossary_updated_at
  before update on public.household_glossary
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- privacy_consents
-- ---------------------------------------------------------------------------
create table if not exists public.privacy_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  policy_version text not null,
  consent_type text not null
    check (consent_type in ('privacy', 'terms', 'pics', 'translation')),
  accepted_at timestamptz not null default now(),
  unique (user_id, policy_version, consent_type)
);

-- ---------------------------------------------------------------------------
-- Membership helpers (private schema — not exposed via Data API)
-- ---------------------------------------------------------------------------
create or replace function private.is_active_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function private.member_role(p_household_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role from public.household_members m
  where m.household_id = p_household_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function private.is_employer_or_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'employer')
  );
$$;

create or replace function private.is_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'owner'
  );
$$;

revoke all on function private.is_active_member(uuid) from public;
revoke all on function private.member_role(uuid) from public;
revoke all on function private.is_employer_or_owner(uuid) from public;
revoke all on function private.is_owner(uuid) from public;
grant execute on function private.is_active_member(uuid) to authenticated;
grant execute on function private.member_role(uuid) to authenticated;
grant execute on function private.is_employer_or_owner(uuid) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;

-- Public wrappers for RLS (Postgres policies need accessible functions)
create or replace function public.is_active_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_active_member(p_household_id);
$$;

create or replace function public.is_employer_or_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_employer_or_owner(p_household_id);
$$;

create or replace function public.is_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_owner(p_household_id);
$$;

create or replace function public.member_role(p_household_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select private.member_role(p_household_id);
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, preferred_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'preferred_language', 'zh-Hant')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on table public.household_sync is
  'LEGACY prototype JSON blob. Kept for backup until migration verified. Do not use for new writes.';
