-- Phase 1A: in-app notifications (durable records + RLS). No push/email.
-- Frontend Notification Centre is NOT in this migration.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  type text not null
    check (type = any (array[
      'task_assigned'::text,
      'task_available'::text,
      'schedule_created'::text
    ])),
  title_zh text not null default '',
  title_id text not null default '',
  body_zh text not null default '',
  body_id text not null default '',
  task_occurrence_id uuid references public.task_occurrences(id) on delete set null,
  task_template_id uuid references public.task_templates(id) on delete set null,
  dedupe_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  deleted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_recipient_dedupe unique (recipient_user_id, dedupe_key),
  constraint notifications_has_target check (
    task_occurrence_id is not null or task_template_id is not null
  )
);

comment on table public.notifications is
  'In-app notifications. Minimal content only — never store full instructions in metadata.';
comment on column public.notifications.dedupe_key is
  'Deterministic key unique per recipient; enables idempotent creation.';
comment on column public.notifications.metadata is
  'Non-sensitive only: mode, priority, client_item_id. No instructions.';

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_user_id, created_at desc)
  where deleted_at is null and read_at is null;

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc)
  where deleted_at is null;

create index if not exists notifications_household_idx
  on public.notifications (household_id, created_at desc);

create index if not exists notifications_occurrence_idx
  on public.notifications (task_occurrence_id)
  where task_occurrence_id is not null;

create index if not exists notifications_template_idx
  on public.notifications (task_template_id)
  where task_template_id is not null;

create index if not exists notifications_expires_idx
  on public.notifications (expires_at)
  where deleted_at is null and expires_at is not null;

-- Preferences stub (UI in later phase)
create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  in_app_enabled boolean not null default true,
  mute_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, household_id)
);

comment on table public.notification_preferences is
  'Per-user per-household notification prefs. Defaults apply when row missing.';

-- ---------------------------------------------------------------------------
-- Restrict client updates to read_at / deleted_at only
-- ---------------------------------------------------------------------------
create or replace function private.notifications_restrict_client_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP <> 'UPDATE' then
    return NEW;
  end if;
  if NEW.id is distinct from OLD.id
     or NEW.household_id is distinct from OLD.household_id
     or NEW.recipient_user_id is distinct from OLD.recipient_user_id
     or NEW.actor_user_id is distinct from OLD.actor_user_id
     or NEW.type is distinct from OLD.type
     or NEW.title_zh is distinct from OLD.title_zh
     or NEW.title_id is distinct from OLD.title_id
     or NEW.body_zh is distinct from OLD.body_zh
     or NEW.body_id is distinct from OLD.body_id
     or NEW.task_occurrence_id is distinct from OLD.task_occurrence_id
     or NEW.task_template_id is distinct from OLD.task_template_id
     or NEW.dedupe_key is distinct from OLD.dedupe_key
     or NEW.metadata is distinct from OLD.metadata
     or NEW.expires_at is distinct from OLD.expires_at
     or NEW.created_at is distinct from OLD.created_at
  then
    raise exception 'NOT_AUTHORIZED'
      using errcode = 'P0001',
            detail = 'Only read_at and deleted_at may be updated on notifications';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notifications_restrict_update on public.notifications;
create trigger trg_notifications_restrict_update
  before update on public.notifications
  for each row
  execute function private.notifications_restrict_client_update();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

revoke all on public.notifications from anon, authenticated, public;
revoke all on public.notification_preferences from anon, authenticated, public;

grant select, update on public.notifications to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;

-- Recipient-only select (exclude soft-deleted for normal reads; allow seeing deleted=false)
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (
    recipient_user_id = auth.uid()
    and deleted_at is null
  );

-- Update own rows only (column restriction via trigger)
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

-- NO insert / delete policies for clients (deny by default)

-- Preferences: own rows only
drop policy if exists notification_prefs_select_own on public.notification_preferences;
create policy notification_prefs_select_own on public.notification_preferences
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notification_prefs_insert_own on public.notification_preferences;
create policy notification_prefs_insert_own on public.notification_preferences
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_member(household_id)
  );

drop policy if exists notification_prefs_update_own on public.notification_preferences;
create policy notification_prefs_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_active_member(household_id)
  );

-- ---------------------------------------------------------------------------
-- Internal: should recipient receive in-app?
-- ---------------------------------------------------------------------------
create or replace function private.notification_in_app_allowed(
  p_user_id uuid,
  p_household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.in_app_enabled
        and (p.mute_until is null or p.mute_until <= now())
      from public.notification_preferences p
      where p.user_id = p_user_id and p.household_id = p_household_id
    ),
    true
  );
$$;

revoke all on function private.notification_in_app_allowed(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER insert helper (clients have no INSERT policy)
-- Justified: only callable from trusted RPCs; validates actor membership;
-- fixed search_path; no grant to authenticated (private schema).
-- ---------------------------------------------------------------------------
create or replace function private.insert_notification(
  p_household_id uuid,
  p_recipient_user_id uuid,
  p_actor_user_id uuid,
  p_type text,
  p_title_zh text,
  p_title_id text,
  p_body_zh text,
  p_body_id text,
  p_task_occurrence_id uuid,
  p_task_template_id uuid,
  p_dedupe_key text,
  p_metadata jsonb default '{}'::jsonb,
  p_expires_at timestamptz default (now() + interval '30 days')
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_recipient_user_id is null or p_dedupe_key is null or p_type is null then
    raise exception 'BATCH_FAILED'
      using errcode = 'P0001', detail = 'notification recipient/type/dedupe required';
  end if;

  -- Recipient must be active member of the household
  if not exists (
    select 1 from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = p_recipient_user_id
      and m.status = 'active'
  ) then
    raise exception 'NOT_AUTHORIZED'
      using errcode = 'P0001', detail = 'notification recipient not an active household member';
  end if;

  if not private.notification_in_app_allowed(p_recipient_user_id, p_household_id) then
    return null;
  end if;

  insert into public.notifications (
    household_id, recipient_user_id, actor_user_id, type,
    title_zh, title_id, body_zh, body_id,
    task_occurrence_id, task_template_id, dedupe_key, metadata, expires_at
  ) values (
    p_household_id, p_recipient_user_id, p_actor_user_id, p_type,
    coalesce(p_title_zh, ''), coalesce(p_title_id, ''),
    coalesce(p_body_zh, ''), coalesce(p_body_id, ''),
    p_task_occurrence_id, p_task_template_id, p_dedupe_key,
    coalesce(p_metadata, '{}'::jsonb), p_expires_at
  )
  on conflict (recipient_user_id, dedupe_key) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.insert_notification(
  uuid, uuid, uuid, text, text, text, text, text, uuid, uuid, text, jsonb, timestamptz
) from public;

-- ---------------------------------------------------------------------------
-- Notify helpers for a newly created adhoc occurrence or schedule template
-- ---------------------------------------------------------------------------
create or replace function private.notify_for_new_task(
  p_household_id uuid,
  p_actor_user_id uuid,
  p_mode text, -- adhoc | scheduled
  p_title_zh text,
  p_title_id text,
  p_priority text,
  p_assigned_to uuid,
  p_occurrence_id uuid,
  p_template_id uuid,
  p_client_item_id text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_helper record;
  v_nid uuid;
  v_meta jsonb;
  v_short_zh text;
  v_short_id text;
begin
  if p_mode not in ('adhoc', 'scheduled') then
    raise exception 'BATCH_FAILED'
      using errcode = 'P0001', detail = 'notify mode must be adhoc or scheduled';
  end if;

  -- Truncate body to title only (never full instructions)
  v_short_zh := left(coalesce(nullif(trim(p_title_zh), ''), '新任務'), 120);
  v_short_id := left(coalesce(nullif(trim(p_title_id), ''), 'Tugas baru'), 120);
  v_meta := jsonb_build_object(
    'mode', p_mode,
    'priority', coalesce(p_priority, 'normal')
  );
  if p_client_item_id is not null then
    v_meta := v_meta || jsonb_build_object('client_item_id', p_client_item_id);
  end if;

  if p_mode = 'adhoc' then
    if p_occurrence_id is null then
      raise exception 'BATCH_FAILED'
        using errcode = 'P0001', detail = 'adhoc notification requires occurrence_id';
    end if;

    if p_assigned_to is not null then
      v_nid := private.insert_notification(
        p_household_id, p_assigned_to, p_actor_user_id,
        'task_assigned',
        '新任務', 'Tugas baru',
        v_short_zh, v_short_id,
        p_occurrence_id, null,
        'task_assigned:' || p_occurrence_id::text,
        v_meta
      );
      if v_nid is not null then v_count := v_count + 1; end if;
    else
      for v_helper in
        select m.user_id
        from public.household_members m
        where m.household_id = p_household_id
          and m.role = 'helper'
          and m.status = 'active'
      loop
        v_nid := private.insert_notification(
          p_household_id, v_helper.user_id, p_actor_user_id,
          'task_available',
          '新任務', 'Tugas baru',
          v_short_zh, v_short_id,
          p_occurrence_id, null,
          'task_available:' || p_occurrence_id::text || ':' || v_helper.user_id::text,
          v_meta
        );
        if v_nid is not null then v_count := v_count + 1; end if;
      end loop;
    end if;

  else
    -- scheduled: one schedule_created per recipient (not per occurrence)
    if p_template_id is null then
      raise exception 'BATCH_FAILED'
        using errcode = 'P0001', detail = 'schedule notification requires template_id';
    end if;

    if p_assigned_to is not null then
      v_nid := private.insert_notification(
        p_household_id, p_assigned_to, p_actor_user_id,
        'schedule_created',
        '新排程', 'Jadwal baru',
        v_short_zh, v_short_id,
        p_occurrence_id, p_template_id,
        'schedule_created:' || p_template_id::text || ':' || p_assigned_to::text,
        v_meta
      );
      if v_nid is not null then v_count := v_count + 1; end if;
    else
      for v_helper in
        select m.user_id
        from public.household_members m
        where m.household_id = p_household_id
          and m.role = 'helper'
          and m.status = 'active'
      loop
        v_nid := private.insert_notification(
          p_household_id, v_helper.user_id, p_actor_user_id,
          'schedule_created',
          '新排程', 'Jadwal baru',
          v_short_zh, v_short_id,
          p_occurrence_id, p_template_id,
          'schedule_created:' || p_template_id::text || ':' || v_helper.user_id::text,
          v_meta
        );
        if v_nid is not null then v_count := v_count + 1; end if;
      end loop;
    end if;
  end if;

  return v_count;
end;
$$;

revoke all on function private.notify_for_new_task(
  uuid, uuid, text, text, text, text, uuid, uuid, uuid, text
) from public;

-- ---------------------------------------------------------------------------
-- Unread count for current user
-- ---------------------------------------------------------------------------
create or replace function public.get_unread_notification_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from public.notifications n
  where n.recipient_user_id = auth.uid()
    and n.deleted_at is null
    and n.read_at is null
    and (n.expires_at is null or n.expires_at > now());
$$;

revoke all on function public.get_unread_notification_count() from public;
grant execute on function public.get_unread_notification_count() to authenticated;

-- Soft-delete helper (optional convenience; Phase 1B UI may use direct update)
create or replace function public.mark_notifications_read(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_n int;
begin
  if auth.uid() is null then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Authentication required');
  end if;
  update public.notifications
  set read_at = coalesce(read_at, now())
  where recipient_user_id = auth.uid()
    and deleted_at is null
    and id = any (p_ids)
    and read_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.mark_notifications_read(uuid[]) from public;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
