-- RLS for task preset library tables.
-- Helpers: read only. Employers/owners: manage household presets, usage, favourites.
-- System presets and categories: authenticated read; no client writes.

alter table public.task_preset_categories enable row level security;
alter table public.task_presets enable row level security;
alter table public.task_preset_usage enable row level security;
alter table public.household_preset_favourites enable row level security;

-- ---------------------------------------------------------------------------
-- task_preset_categories
-- ---------------------------------------------------------------------------
drop policy if exists preset_categories_select on public.task_preset_categories;
create policy preset_categories_select on public.task_preset_categories
  for select to authenticated
  using (is_active = true);

-- No insert/update/delete for authenticated (seed via migration / service role)

-- ---------------------------------------------------------------------------
-- task_presets — system (read-only for all authenticated)
-- ---------------------------------------------------------------------------
drop policy if exists presets_select_system on public.task_presets;
create policy presets_select_system on public.task_presets
  for select to authenticated
  using (
    source = 'system'
    and is_active = true
    and archived_at is null
  );

-- ---------------------------------------------------------------------------
-- task_presets — household (members read; employers write)
-- ---------------------------------------------------------------------------
drop policy if exists presets_select_household on public.task_presets;
create policy presets_select_household on public.task_presets
  for select to authenticated
  using (
    source = 'household'
    and household_id is not null
    and public.is_active_member(household_id)
    and (
      archived_at is null
      or public.is_employer_or_owner(household_id)
    )
  );

drop policy if exists presets_insert_household on public.task_presets;
create policy presets_insert_household on public.task_presets
  for insert to authenticated
  with check (
    source = 'household'
    and household_id is not null
    and public.is_employer_or_owner(household_id)
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists presets_update_household on public.task_presets;
create policy presets_update_household on public.task_presets
  for update to authenticated
  using (
    source = 'household'
    and household_id is not null
    and public.is_employer_or_owner(household_id)
  )
  with check (
    source = 'household'
    and household_id is not null
    and public.is_employer_or_owner(household_id)
  );

drop policy if exists presets_delete_household on public.task_presets;
create policy presets_delete_household on public.task_presets
  for delete to authenticated
  using (
    source = 'household'
    and household_id is not null
    and public.is_employer_or_owner(household_id)
  );

-- System presets: no insert/update/delete policies for authenticated

-- ---------------------------------------------------------------------------
-- task_preset_usage
-- ---------------------------------------------------------------------------
drop policy if exists preset_usage_select on public.task_preset_usage;
create policy preset_usage_select on public.task_preset_usage
  for select to authenticated
  using (public.is_active_member(household_id));

drop policy if exists preset_usage_insert on public.task_preset_usage;
create policy preset_usage_insert on public.task_preset_usage
  for insert to authenticated
  with check (
    public.is_employer_or_owner(household_id)
    and used_by = auth.uid()
  );

-- No update/delete of usage rows for authenticated (append-only)

-- ---------------------------------------------------------------------------
-- household_preset_favourites
-- ---------------------------------------------------------------------------
drop policy if exists preset_fav_select on public.household_preset_favourites;
create policy preset_fav_select on public.household_preset_favourites
  for select to authenticated
  using (public.is_active_member(household_id));

drop policy if exists preset_fav_insert on public.household_preset_favourites;
create policy preset_fav_insert on public.household_preset_favourites
  for insert to authenticated
  with check (
    public.is_employer_or_owner(household_id)
    and created_by = auth.uid()
  );

drop policy if exists preset_fav_delete on public.household_preset_favourites;
create policy preset_fav_delete on public.household_preset_favourites
  for delete to authenticated
  using (public.is_employer_or_owner(household_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on public.task_preset_categories from anon;
revoke all on public.task_presets from anon;
revoke all on public.task_preset_usage from anon;
revoke all on public.household_preset_favourites from anon;

grant select on public.task_preset_categories to authenticated;
grant select, insert, update, delete on public.task_presets to authenticated;
grant select, insert on public.task_preset_usage to authenticated;
grant select, insert, delete on public.household_preset_favourites to authenticated;
