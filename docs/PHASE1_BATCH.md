# Phase 1 — Atomic batch task creation

## Assessment (pre-change)

**Architecture:** `task_presets` = reusable library; `task_templates` = active recurring schedules; `task_occurrences` = dated instances. Add Task Flow / Quick Add previously called `createFromPreset` in a client-side loop.

**Root causes:**
1. **Partial batch:** `AddTaskFlow.submitAll` looped `createFromPreset` sequentially — early items committed before a later failure.
2. **Notes discarded:** ConfigureStep stored `notes` only in React state; inserts never wrote them (no DB column).
3. **Assignee UI missing:** `assigned_to` existed on tables / insert paths but no picker.

## What shipped

| Piece | Detail |
|--------|--------|
| Columns | `additional_instructions_zh/id` on `task_templates` + `task_occurrences` |
| `ensure_today_occurrences` | Copies additional_instructions from template |
| `update_task_occurrence` | Patches additional_instructions + assigned_to |
| Table | `task_creation_batches` (unique household+idempotency_key) |
| RPC | `create_tasks_from_presets` — **SECURITY INVOKER**, atomic, idempotent |
| Frontend | AddTaskFlow / Quick Add use RPC; 補充指示; 指派給 |

## Deploy order (backward compatible)

1. Apply `20261019170000_phase1_additional_instructions.sql`
2. Apply `20261019170100_phase1_batch_creation.sql` (table + RLS + RPC)
3. Deploy frontend that calls the RPC
4. Smoke-test batch create + idempotent retry

## Rollback

1. Redeploy previous frontend (direct inserts still work for custom form).
2. Optional: `drop function public.create_tasks_from_presets(uuid,uuid,jsonb);`
3. Do **not** drop `additional_instructions_*` columns if any rows use them.
4. Optional: `drop table public.task_creation_batches;`

## Acceptance (Phase 1)

- [x] Multi-task create is atomic (all-or-nothing)
- [x] Idempotent retry does not duplicate
- [x] Same key + different payload rejected
- [x] Additional instructions persist and show on TaskCard
- [x] Assignee picker + INVALID_ASSIGNEE for non-helpers
- [x] Quick Add uses same RPC
- [x] Batch limit 20
- [ ] Full keyboard / 375px manual QA on production UI (after Pages deploy)

## STOP

Phase 2 (scheduling expansion / full preview polish) and Phase 3 (template management UX) are **not** started — awaiting approval.
