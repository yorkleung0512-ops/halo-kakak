# Phase 3 — Template management, versioning/fallback, a11y

## Household template management（設定 → 我的範本）

| Action | Household | System |
|--------|-----------|--------|
| 使用 | ✓ (opens Add Task Flow) | ✓ |
| 編輯 | ✓ (`update_household_preset`) | ✗ copy-only |
| 複製 | ✓ | ✓ → household |
| 加到常用 / 移除常用 | ✓ | ✓ |
| 封存 | soft-archive (`archive_household_preset`) | ✗ |
| 復原 | ✓ (`restore_household_preset`) | ✗ |

Editable fields: category, titles ZH/ID, instructions, additional_instructions, suggested type/time/recurrence/weekdays/interval/priority, safety_warning, keywords, translation_approved.

Sensitive-content detector warns before save (ack required). Soft-archive never hard-deletes; usage FK is `ON DELETE RESTRICT`; archive confirms when usage_count > 0. Archived tab + restore.

## Versioning / offline fallback

| Field | Where |
|-------|--------|
| `template_version` | `task_presets` (bumped on update/archive/restore) |
| `seed_version` | `preset_library_meta` (`2026.10.19`) + `CLIENT_SEED_VERSION` |
| `last_synced_at` | `preset_library_meta` + local system cache |

Client (`fetchPresetLibrary`):

1. Prefer live DB when online.
2. Shared `localStorage` cache = **system presets only** (never household). Contaminated cache purged.
3. Bundled `FALLBACK_SYSTEM_PRESETS` only if offline / network unavailable and cache empty.
4. Auth / JWT / RLS / schema errors → `mode: 'error'`, message shown, **no** silent fallback.
5. Offline banner ZH/ID: `OFFLINE_PRESET_MSG` / `UNAVAILABLE_PRESET_MSG`.
6. `window` `online` → `refreshPresetLibraryOnReconnect`.

## Accessibility

- Preset cards: **checkbox** (+「已選」text), not `role=option` in fake listbox.
- Category chips: `role=group` + `aria-pressed` (not listbox/option).
- Live region announces selected count (ZH + ID).
- Favourite `aria-label` includes template name.
- Modal focus trap re-queries focusables each Tab (dynamic steps).
- Step headings `tabIndex={-1}` focused on open/step change.
- Space/Enter on checkboxes; min 44px; not colour-alone; `lang="zh-Hant"` / `lang="id"`.

## Migrations

`20261019190000_phase3_preset_management.sql` — applied live as `phase3_preset_management` on `yevqwospotfujiziegpz`.

RPCs: `update_household_preset`, `archive_household_preset`, `restore_household_preset`.

## Tests

```bash
npm run test:presets
npm run build
```

## Rollback

1. Redeploy prior frontend.
2. Optional: revoke Phase 3 RPCs; drop `preset_library_meta`.
3. Do **not** drop `additional_instructions_*` / `template_version` if rows use them.
4. Usage FK can be restored to `ON DELETE CASCADE` if desired (soft-archive still preferred).

## Acceptance checklist

- [ ] Settings → 我的範本: use / edit / copy / fav / unfav / archive / restore
- [ ] System presets copy-only (no edit)
- [ ] Archived view + restore
- [ ] Soft-archive when usage refs exist (confirm + no hard delete)
- [ ] Sensitive warning before save
- [ ] Offline shows ZH/ID banner; household not in shared cache
- [ ] Auth/schema errors not masked by fallback
- [ ] Reconnect refreshes library
- [ ] Checkbox cards; selected count announced; fav labels named
- [ ] Modal trap works across Add Task steps
- [ ] Phase 1–2 RPC / scheduling / teal / RLS unchanged
