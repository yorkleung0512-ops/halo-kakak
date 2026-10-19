# Task Template Library（任務範本）

## Architecture

| Table | Role |
|-------|------|
| `task_presets` | Reusable bilingual library (system + household) |
| `task_preset_categories` | Category chips |
| `task_preset_usage` | Recently used (dedupe client-side by preset) |
| `household_preset_favourites` | Per-household favourites (never on system rows globally) |
| `task_templates` | **Active** recurring schedules (unchanged) |
| `task_occurrences` | Concrete day tasks (unchanged) |

Creating from a preset:

1. **臨時任務 / ad-hoc** → `insert task_occurrences` (same as Today `createOneShot`)
2. **排程任務 / scheduled** → `insert task_templates` then `ensure_today_occurrences`

Unmodified system / approved household bilingual text does **not** call the translation Edge Function.

## UX flow

1. Employer taps **新增** → MethodStep: **從範本選擇** (primary) / **自訂任務**
2. Browse / search / filter / multi-select → Configure (臨時 vs 排程) → Preview → create
3. **快速新增** on Today for favourites / top presets
4. Settings → **我的範本** manage household presets

## Migrations (order)

1. `20261019160000_task_presets.sql` — tables
2. `20261019160100_task_presets_rls.sql` — RLS
3. `20261019160200_task_presets_seed.sql` — categories + ≥44 system presets

Applied live as: `task_presets`, `task_presets_rls`, `task_presets_seed_categories` (+ data via SQL).

## Deploy

1. Apply migrations (MCP `apply_migration` or SQL editor) on project `yevqwospotfujiziegpz`
2. `npm run build` && push `main` → Cloudflare Pages
3. Smoke: sign in as employer → 新增 → 從範本選擇 → create ad-hoc + scheduled

## Rollback

```sql
-- Soft: stop using UI; data remains
-- Hard (destructive — only if needed):
drop table if exists public.household_preset_favourites;
drop table if exists public.task_preset_usage;
drop table if exists public.task_presets;
drop table if exists public.task_preset_categories;
```

Does **not** touch `task_templates` / `task_occurrences` / auth / RLS on older tables.

## Acceptance checklist

1. Employer opens Add Task and selects a system template
2. Ad-hoc from template → occurrence only
3. Scheduled from template → template + ensure_today
4. Multi-select creates multiple tasks
5. Suggested values editable
6. Editing Chinese resets `translation_approved`
7. Save as household template
8. Household template not visible cross-household
9. Helper cannot edit/delete templates
10. Employer cannot edit global system templates
11. Recently used ordered + deduped
12. Favourites in Quick Add
13. No duplicate occurrences from template path
14. RLS blocks cross-household
15. Works on 375px
16. Keyboard / screen-reader selection
17. Unmodified system preset skips translation API
18. Archived household presets hidden from normal search

## Tests

- `npm run test:presets` — mapRecurrence, sensitive detector, filter
- `npm run test:rls` — REST smoke when tokens set
- `supabase/tests/rls_checks.sql` — checklist 13–19
