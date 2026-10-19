# Phase 2 — Scheduling, scoped edit, preview, Quick Add

## Weekday convention

- **ISO 1–7**: Monday=1 … Sunday=7 (PostgreSQL `extract(isodow)`).
- **Do not use 0–6** (JS `Date.getDay()` Sunday=0). UI labels: 一…日 / Senin…Minggu.
- Stored on `task_templates.recurrence_weekdays int[]`.

## Recurrence patterns

| Rule | Meaning | `recurrence_interval` |
|------|---------|------------------------|
| `daily` | Every N days from start | N days (default 1) |
| `weekdays` | Mon–Fri | ignored |
| `weekly` | Selected weekdays, every N weeks | N weeks |
| `biweekly` | Every 2 weeks (interval forced ≥2) | 2 |
| `monthly` | Same day-of-month (last-day clamp) | N months |
| `custom` | Every N days | N days |

- Timezone for “today”: **Asia/Hong_Kong**.
- Start date required for interval math; optional `end_date` or never ends (`null`).
- Pause: `set_task_template_paused` sets `paused_at`; `ensure_today_occurrences` skips paused.
- Unique `(template_id, task_date)` unchanged.

## RPCs

| Function | Role |
|----------|------|
| `private.template_applies_on_date(tmpl, date)` | Pattern matcher |
| `public.ensure_today_occurrences` | Materialise today’s rows for all patterns |
| `public.create_tasks_from_presets` | Batch create; accepts biweekly/custom/interval/weekdays/end |
| `public.edit_task_occurrence_scoped` | Scoped edit + audit |
| `public.set_task_template_paused` | Pause / resume |

### Edit scopes (`p_scope`)

| Value | ZH | ID | Behaviour |
|-------|----|----|-----------|
| `this_only` | 只修改今次 | Hanya kali ini | This occurrence only; no template change |
| `this_and_future` | 今次及之後 | Kali ini dan seterusnya | This + future non-completed + template (`start_date` bumped) |
| `entire_series` | 整個排程 | Seluruh jadwal | All non-completed + template |

Completed occurrences are **never** overwritten by propagate. Events: `scoped_edit`, `scoped_edit_propagate`, `template_paused` / `template_resumed`.

## Migrations (version-controlled)

1. `20261019180000_phase2_scheduling.sql` — schema, template_applies, ensure_today, pause, scoped edit
2. `20261019180100_phase2_create_tasks_rpc.sql` — create_tasks_from_presets Phase 2

Applied live to project `yevqwospotfujiziegpz` via Supabase `apply_migration` / staging execute.

## Frontend

- `RecurrenceFields` + `BulkApplyBar` (套用到全部 + confirm)
- Full bilingual `PreviewStep` (titles, instructions, additional, type, date/time, recurrence, end, assignee, priority, safety, translation status, counts, adhoc vs scheduled)
- Quick Add: max **6** visible; favourites→recent→time→usage; 查看全部範本; remove suggestion; confirm + date + assignee; `create_tasks_from_presets`
- `EditTaskModal` uses scoped RPC + pause

## Tests

```bash
npm run test:presets
```

## Rollback

1. Redeploy previous frontend (Phase 1 UI still works with new columns/defaults).
2. Optional DB: restore prior `create_tasks_from_presets` / `ensure_today_occurrences` bodies from Phase 1 migration files.
3. Do **not** drop `recurrence_interval` / `paused_at` if rows use them.
4. Scoped edit / pause RPCs can be revoked:  
   `revoke execute on function public.edit_task_occurrence_scoped from authenticated;`  
   `revoke execute on function public.set_task_template_paused from authenticated;`

## STOP

Phase 3 (template management UX / library polish beyond Phase 2) is **not** started — awaiting approval.
