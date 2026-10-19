# Custom task creation via atomic RPC

**Status:** Complete on project `yevqwospotfujiziegpz`. **STOPPED** — no Today-page redesign in this change.

## Current flow (before → after)

| Path | Before | After |
|------|--------|-------|
| Employer custom ad-hoc (`Today` 自訂 → 單次) | Direct `task_occurrences.insert` | `createCustomTask` → `create_tasks_from_presets` (`preset_id` null) |
| Employer custom scheduled | Direct `task_templates.insert` + `ensureToday` | Same RPC (`mode=scheduled`) + optional `ensureToday` |
| Preset / Quick Add / batch | Already on RPC | Unchanged |

## Root cause addressed

Custom creates bypassed notifications, idempotency, and atomicity. A failed step could leave orphan rows with no notification.

## Files

| File | Change |
|------|--------|
| `supabase/migrations/20261019220000_custom_tasks_via_rpc.sql` | Replace RPC: null `preset_id` = custom; skip `task_preset_usage`; write `task_events`; keep notify in same txn |
| `src/lib/taskPayload.js` | Pure `draftToPayload` (preset or custom) |
| `src/lib/presets.js` | `createTasksFromPresets` accepts custom; new `createCustomTask` |
| `src/pages/Today.jsx` | `onAddSubmit` uses `createCustomTask`; removed `createOneShot` / dead `submitTask` inserts |
| `scripts/presets-unit.mjs` | Custom payload unit asserts |
| `supabase/tests/custom_task_rpc_checks.sql` | Notes + recorded DB results |
| `docs/CUSTOM_TASK_RPC.md` | This file |

## RPC behaviour

- `preset_id` omitted/null → custom; titles/instructions from payload only.
- Custom does **not** insert `task_preset_usage`.
- Always inserts `task_events` (`task_created` / `schedule_created`).
- Same notify rules as presets (assigned helper / all active helpers / one `schedule_created`).
- Idempotency key unchanged; notify failure aborts entire batch.

## RLS

No new policies. RPC remains **SECURITY INVOKER**; `private.notify_for_new_task` remains DEFINER and not granted to clients.

## Tests (actual)

### Unit

```
npm run test:presets   → All passed (includes custom payload asserts)
npm run test:notifications → All notification unit tests passed
npm run build → success
```

### Database (JWT claim impersonation on live project)

```
T1–T6_PASSED=6 FAIL=
  T1 custom adhoc assigned → occurrence + custom=true
  T2 Helper A exactly 1 notification
  T3/T4 schedule_created once for assigned helper (total=1)
  T5 idempotent replay → replayed=true, still 1 occ + 1 notif
  T6 forced notify failure → 0 occ + 0 notif (full rollback)

T7–T13_PASSED=10 FAIL=
  T7 Helper B other HH → 0 notifs for HH1
  T8 removed helper → 0 notifs
  T9 deep link occ + schedule template ids present
  T10 mark read → task status still pending
  T11 additional_instructions_zh/id persisted
  T12 unassigned → task_available to active helpers only
  T13 bilingual titles/bodies; metadata has no instructions
  T13 task_events present; no preset_usage for custom
  T13 system preset path still works + writes usage
```

## Deploy

1. Migration applied live (`custom_tasks_via_rpc` + function replace).
2. Push frontend to `main` → Cloudflare Pages.
3. Smoke: employer 自訂臨時／排程；姐姐收到通知；Quick Add 仍可用。

## Rollback

1. Frontend: revert to commit before this change (restore REST inserts).
2. DB: re-apply `20261019200100_phase1a_create_tasks_notify.sql` body (requires `preset_id`).
3. Do not drop `notifications` / `task_events` rows.

## Confirmation

`rg "task_occurrences'\)\.insert|task_templates'\)\.insert" src` → **no matches**.
Employer creates go only through `create_tasks_from_presets`.
