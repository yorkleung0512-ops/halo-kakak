# Hola-Kakak database migration guide

## What changed

Prototype table `public.household_sync` (room_code + JSON payload) remains **intact**.
New normalized tables: profiles, households, household_members, household_invites,
task_templates, task_occurrences, task_comments, task_events, household_glossary,
privacy_consents.

## Backup before cutover

```sql
-- Already live: one demo row HOME-888 with 7 routines + 3 tasks
create table if not exists public.household_sync_backup_20261019 as
select * from public.household_sync;
```

## Apply migrations (order)

1. `supabase/migrations/20261019150000_normalized_schema.sql`
2. `supabase/migrations/20261019150100_rls_policies.sql`
3. `supabase/migrations/20261019150200_rpc_auth_invites.sql`

Via MCP `apply_migration` or Supabase SQL editor. Do **not** drop `household_sync`.

## Data migration plan (legacy → normalized)

1. Employer signs in with magic link.
2. Call `create_household('我家')` → get household id.
3. Map each `payload.routines[]` → `task_templates` with `recurrence_rule='daily'` and `default_time`.
4. Map each `payload.tasks[]` → one-time `task_occurrences` for today (HK timezone).
5. Call `ensure_today_occurrences(household_id)` for routines.
6. Create helper invite via `create_household_invite` and share WhatsApp link.
7. Verify UI + RLS tests.
8. Only then revoke anon policies on `household_sync` (separate migration).

## Rollback

```sql
-- Drop new objects only if needed (legacy data untouched)
drop function if exists public.ensure_today_occurrences(uuid, date);
drop function if exists public.update_task_occurrence(uuid, int, jsonb);
drop function if exists public.remove_household_member(uuid, uuid);
drop function if exists public.revoke_household_invite(uuid);
drop function if exists public.accept_household_invite(text);
drop function if exists public.create_household_invite(uuid, text, int);
drop function if exists public.create_household(text, text);
-- then drop tables in reverse FK order, keep household_sync
```

## Security notes

- Invitation tokens: SHA-256 hash only in DB; plaintext returned once.
- Display codes never grant access.
- Service role key must never appear in frontend.
- Legacy `household_sync` still has open anon RLS until cutover migration.


## Task preset library (2026-10-19)

4. `supabase/migrations/20261019160000_task_presets.sql`
5. `supabase/migrations/20261019160100_task_presets_rls.sql`
6. `supabase/migrations/20261019160200_task_presets_seed.sql`

See `docs/TASK_PRESETS.md` for UX, deploy, rollback, and acceptance checklist.
