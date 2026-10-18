-- Halo Kakak · household_sync (already applied on project halo-kakak)
-- Reference migration for new environments

create table if not exists public.household_sync (
  room_code text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.household_sync replica identity full;

create index if not exists idx_household_sync_updated_at
  on public.household_sync (updated_at desc);

alter table public.household_sync enable row level security;

drop policy if exists "Allow public read household_sync" on public.household_sync;
create policy "Allow public read household_sync"
  on public.household_sync for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow public insert household_sync" on public.household_sync;
create policy "Allow public insert household_sync"
  on public.household_sync for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Allow public update household_sync" on public.household_sync;
create policy "Allow public update household_sync"
  on public.household_sync for update
  to anon, authenticated
  using (true)
  with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'household_sync'
  ) then
    alter publication supabase_realtime add table public.household_sync;
  end if;
end $$;

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_household_sync_updated_at on public.household_sync;
create trigger set_household_sync_updated_at
  before update on public.household_sync
  for each row
  execute function public.handle_updated_at();
