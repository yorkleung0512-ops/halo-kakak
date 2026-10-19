-- Task comment read receipts (per-user). Fixes sticky "需要處理" from inferred unread.
-- Does NOT change create_tasks_from_presets, notification creation, or task RLS.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.task_comment_reads (
  comment_id uuid not null references public.task_comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

comment on table public.task_comment_reads is
  'Per-user read receipts for task comments. Own comments are never unread; writes only via RPC.';

create index if not exists idx_task_comment_reads_user_read
  on public.task_comment_reads (user_id, read_at);

create index if not exists idx_task_comment_reads_hh_user
  on public.task_comment_reads (household_id, user_id);

create index if not exists idx_task_comment_reads_comment
  on public.task_comment_reads (comment_id);

-- Help unread summary join comments → occurrences for a household day
create index if not exists idx_task_comments_household_created
  on public.task_comments (household_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Immutable read_at (no updates)
-- ---------------------------------------------------------------------------
create or replace function public.guard_task_comment_reads_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform private.raise_app_error('NOT_AUTHORIZED', 'task_comment_reads rows are immutable');
  return null;
end;
$$;

drop trigger if exists trg_guard_task_comment_reads on public.task_comment_reads;
create trigger trg_guard_task_comment_reads
  before update or delete on public.task_comment_reads
  for each row execute function public.guard_task_comment_reads_immutable();

-- ---------------------------------------------------------------------------
-- RLS: select own rows only; no direct insert/update/delete for clients
-- ---------------------------------------------------------------------------
alter table public.task_comment_reads enable row level security;

drop policy if exists comment_reads_select_own on public.task_comment_reads;
create policy comment_reads_select_own on public.task_comment_reads
  for select to authenticated
  using (user_id = auth.uid());

-- Explicit deny-style: no insert/update/delete policies for authenticated.

revoke all on public.task_comment_reads from anon;
revoke all on public.task_comment_reads from authenticated;
grant select on public.task_comment_reads to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime (own receipts + existing task_comments already published)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_comment_reads'
  ) then
    alter publication supabase_realtime add table public.task_comment_reads;
  end if;
end;
$$;

alter table public.task_comment_reads replica identity full;

-- ---------------------------------------------------------------------------
-- mark_task_comments_read
-- SECURITY DEFINER: clients have no INSERT policy; inserts only for auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.mark_task_comments_read(
  p_task_occurrence_id uuid,
  p_comment_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_household_id uuid;
  v_marked int := 0;
  v_remaining int := 0;
  v_bad int;
begin
  if v_uid is null then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Authentication required');
  end if;

  if p_task_occurrence_id is null then
    perform private.raise_app_error('BATCH_FAILED', 'task_occurrence_id required');
  end if;

  select o.household_id into v_household_id
  from public.task_occurrences o
  where o.id = p_task_occurrence_id
    and o.deleted_at is null;

  if v_household_id is null then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Task not found or inaccessible');
  end if;

  if not public.is_active_member(v_household_id) then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Active membership required');
  end if;

  -- Reject IDs that belong to another task/household (or do not exist)
  if p_comment_ids is not null and cardinality(p_comment_ids) > 0 then
    select count(*)::int into v_bad
    from unnest(p_comment_ids) as x(id)
    where not exists (
      select 1
      from public.task_comments c
      where c.id = x.id
        and c.task_occurrence_id = p_task_occurrence_id
        and c.household_id = v_household_id
    );
    if v_bad > 0 then
      perform private.raise_app_error('NOT_AUTHORIZED', 'Comment does not belong to this task');
    end if;
  end if;

  with eligible as (
    select c.id, c.household_id
    from public.task_comments c
    where c.task_occurrence_id = p_task_occurrence_id
      and c.household_id = v_household_id
      and c.user_id <> v_uid
      and (
        p_comment_ids is null
        or cardinality(p_comment_ids) = 0
        or c.id = any (p_comment_ids)
      )
  ),
  inserted as (
    insert into public.task_comment_reads (comment_id, user_id, household_id)
    select e.id, v_uid, e.household_id
    from eligible e
    on conflict (comment_id, user_id) do nothing
    returning comment_id
  )
  select count(*)::int into v_marked from inserted;

  select count(*)::int into v_remaining
  from public.task_comments c
  where c.task_occurrence_id = p_task_occurrence_id
    and c.household_id = v_household_id
    and c.user_id <> v_uid
    and not exists (
      select 1
      from public.task_comment_reads r
      where r.comment_id = c.id
        and r.user_id = v_uid
    );

  return jsonb_build_object(
    'marked_count', coalesce(v_marked, 0),
    'remaining_unread_count', coalesce(v_remaining, 0)
  );
end;
$$;

revoke all on function public.mark_task_comments_read(uuid, uuid[]) from public;
grant execute on function public.mark_task_comments_read(uuid, uuid[]) to authenticated;

comment on function public.mark_task_comments_read(uuid, uuid[]) is
  'Mark visible comments as read for auth.uid(). Null/empty p_comment_ids = all others on the task. Idempotent.';

-- ---------------------------------------------------------------------------
-- get_my_unread_comment_summary
-- ---------------------------------------------------------------------------
create or replace function public.get_my_unread_comment_summary(
  p_household_id uuid,
  p_task_date date
)
returns table (
  task_occurrence_id uuid,
  unread_count integer,
  latest_unread_comment_at timestamptz,
  latest_comment_preview text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Authentication required');
  end if;

  if p_household_id is null or p_task_date is null then
    perform private.raise_app_error('BATCH_FAILED', 'household_id and task_date required');
  end if;

  if not public.is_active_member(p_household_id) then
    perform private.raise_app_error('NOT_AUTHORIZED', 'Active membership required');
  end if;

  return query
  select
    c.task_occurrence_id,
    count(*)::integer as unread_count,
    max(c.created_at) as latest_unread_comment_at,
    left(
      (array_agg(c.message order by c.created_at desc))[1],
      80
    ) as latest_comment_preview
  from public.task_comments c
  inner join public.task_occurrences o
    on o.id = c.task_occurrence_id
  where o.household_id = p_household_id
    and o.task_date = p_task_date
    and o.deleted_at is null
    and c.household_id = p_household_id
    and c.user_id <> v_uid
    and not exists (
      select 1
      from public.task_comment_reads r
      where r.comment_id = c.id
        and r.user_id = v_uid
    )
  group by c.task_occurrence_id
  order by max(c.created_at) desc;
end;
$$;

revoke all on function public.get_my_unread_comment_summary(uuid, date) from public;
grant execute on function public.get_my_unread_comment_summary(uuid, date) to authenticated;

comment on function public.get_my_unread_comment_summary(uuid, date) is
  'Unread comment counts for auth.uid() on a household day. Own comments excluded.';
