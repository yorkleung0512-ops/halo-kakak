# Phase 1A — In-app notifications (DB only)

**Status:** Complete on project `yevqwospotfujiziegpz`. **STOPPED** — awaiting approval before Notification Centre UI / Today redesign.

## Architecture assessment (pre-change)

| Area | Finding |
|------|---------|
| Today / Calendar / History | `src/pages/Today.jsx`, `Calendar.jsx`, `History.jsx` — load `task_occurrences` via REST; Today calls `ensure_today_occurrences` then lists today. |
| TaskCard / Edit | `TaskCard.jsx`, `EditTaskModal.jsx` — status, bilingual text, additional instructions; no type badge yet (Phase 1B). |
| Nav / App | `Nav.jsx`, `App.jsx` — no notification bell. |
| Realtime | **No** `postgres_changes` subscriptions for tasks. Only auth `onAuthStateChange` unsubscribe. |
| Task creation | Preset path: `create_tasks_from_presets` (atomic, idempotent). Custom path: direct REST inserts in `Today.jsx` (no notify in 1A). |
| Recurrence | `task_templates` + `ensure_today_occurrences`; scoped edit via `edit_task_occurrence_scoped`. |
| Offline | `offlineQueue.js` — status updates only. |
| Existing notifications | **None** (no table/code). |

**Storage today:** Ad-hoc = `task_occurrences.template_id IS NULL`. Scheduled = template + occurrences. Assignee = `assigned_to`. Creator = `created_by`. Due = `due_at` / `default_time`.

## What Phase 1A shipped

### Tables
- `notifications` — durable in-app rows; unique `(recipient_user_id, dedupe_key)`; soft delete; `expires_at`
- `notification_preferences` — stub `(user_id, household_id)` with `in_app_enabled` default true

### RLS
- Recipient-only `SELECT` (`deleted_at is null`)
- Recipient-only `UPDATE` of `read_at` / `deleted_at` (enforced by trigger)
- **No** client `INSERT` / `DELETE`
- Preferences: own rows only
- Anon: none

### Functions
- `private.insert_notification` / `private.notify_for_new_task` — **SECURITY DEFINER**, fixed `search_path`, not granted to clients
- Wired inside `create_tasks_from_presets` (same transaction; notify failure aborts batch)
- `get_unread_notification_count()` — INVOKER, `auth.uid()` only
- `mark_notifications_read(uuid[])` — convenience INVOKER

### Notify rules
| Event | Recipients | Type | Dedupe |
|-------|------------|------|--------|
| Ad-hoc assigned | That helper | `task_assigned` | `task_assigned:{occurrence_id}` |
| Ad-hoc unassigned | All active helpers | `task_available` | `task_available:{occurrence_id}:{user_id}` |
| Scheduled create | Assigned helper (or all active helpers if unassigned) | `schedule_created` | `schedule_created:{template_id}:{user_id}` |

Body = task title only. Metadata = `{mode, priority, client_item_id?}` — **no instructions**.

`ensure_today_occurrences` does **not** create schedule notifications (only template create does).

## Migrations (repo)
1. `20261019200000_phase1a_notifications.sql` — tables, indexes, RLS, helpers, count RPC
2. `20261019200100_phase1a_create_tasks_notify.sql` — replace `create_tasks_from_presets` with notify hooks

Applied live via Supabase `apply_migration` (chunked) on 2026-10-19.

## Test results (actual)

```
SMOKE_OK — notifs=1, unread_as_helper=1
EXTENDED_PASSED=9
```

Commands used: Supabase `execute_sql` with JWT claim impersonation (`request.jwt.claims` / `request.jwt.claim.sub`). Ephemeral helpers cleaned up afterward.

## Rollback
1. Redeploy previous `create_tasks_from_presets` from `20261019180100_phase2_create_tasks_rpc.sql`
2. Optional: `drop function public.get_unread_notification_count(); drop function public.mark_notifications_read(uuid[]);`
3. Optional: `drop table public.notifications; drop table public.notification_preferences;`
4. Do not drop if Phase 1B UI already depends on rows

## Not in this phase
- Notification Centre / bell / toast
- Today dashboard redesign
- Web Push / FCM / email / SMS
- Realtime subscription UI
- Notifying on custom (non-RPC) task inserts

## Acceptance (1A)
- [x] notifications table + indexes + FKs + soft delete + expires
- [x] preferences stub
- [x] RLS recipient-only; no client insert/delete
- [x] create_tasks_from_presets creates notifs in same txn
- [x] idempotent retry → no duplicate notifs
- [x] failed batch → no partial notifs
- [x] get_unread_notification_count
- [x] tests executed and recorded
- [ ] Frontend — **blocked until approval**
