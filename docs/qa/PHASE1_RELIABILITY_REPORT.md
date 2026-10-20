# Halo Kakak — Phase 1 Reliability Verification Report

**Branch:** `phase1-reliability`  
**Zone:** Asia/Hong_Kong (UTC+8)  
**Report date:** 2026-10-20  

## Commit distinction

| Role | SHA | Notes |
|------|-----|-------|
| **Implementation commit** (code under test) | `11854fe02dfeeb2668c697183179952318aaa13f` | Deep-link TaskDetail, Calendar/History open, sign-out isolation, reconnect membership |
| **Documentation commit** | *(this commit — see git log)* | Sanitized report only; no product code |
| **Deployed / tested preview** | `11854fe02dfeeb2668c697183179952318aaa13f` | Must match implementation; docs commit is not required for preview UI |

Do not treat a later docs-only SHA as the commit that was browser-verified.

## Preview target (verified)

| Field | Value |
|-------|-------|
| Preview URL (branch alias) | https://phase1-reliability.halo-kakak.pages.dev |
| Deployment URL | https://5821b087.halo-kakak.pages.dev |
| Cloudflare status | success, environment **preview** |
| Deployed commit | `11854fe02dfeeb2668c697183179952318aaa13f` — **matches implementation** |
| Production site (unchanged) | https://halo-kakak.pages.dev — still on `main` `5f8835ec0435df1c2fe924480b203efc913674f3` |
| Cloudflare `production_branch` | `main` → **merge to main = production deploy** |

### Backend / environment

- **Both** Cloudflare Pages **preview** and **production** builds use  
  `VITE_SUPABASE_URL=https://yevqwospotfujiziegpz.supabase.co`
- Preview is **not** an isolated database. It shares the **same production Supabase** project.
- Therefore: authenticated browser tests against this preview **can mutate production data**.
- Do **not** run mutating browser tests until York approves exact QA accounts, records, and actions.
- Do **not** use real (non-QA) household data for testing.

If Cloudflare deployment protection blocks anonymous access, use an authorized session / Access policy configured for the project; credentials must never be written into this report.

## Authorization compliance

| Action | Done? |
|--------|-------|
| Code changes (implementation commit) | Yes |
| Unit / script tests | Yes |
| Git commit on feature branch | Yes |
| Push to `phase1-reliability` (preview only) | Yes |
| Merge / push `main` (Pages **production** auto-deploy) | **No** |
| `apply_migration` / schema migration | **No** |
| Create test accounts | **No** |
| Delete / clean QA data | **No** |
| Phase 2–4 features | **No** |
| Browser acceptance on preview | **NOT RUN** (pending approval — shared production DB) |

## Files changed (implementation commit)

### New
- `src/lib/taskDetailAccess.js` — fetch-by-id, deep-link param helpers, pending-link storage
- `src/lib/sessionLocalState.js` — sign-out local prefs + queue discard helpers
- `src/hooks/useTaskOccurrenceDetail.js` — shared open/close TaskDetail controller
- `scripts/phase1-unit.mjs` — unit tests for deep-link pure logic + queue isolation
- `docs/MVP_PHASE0_GAP_MATRIX.md` — Phase 0 + Phase 1 + decisions A–H

### Modified
- `src/pages/Today.jsx` — deep link fetch-by-id; generation guard; auth revalidate before flush; close clears params
- `src/pages/Calendar.jsx` / `History.jsx` — clickable rows → TaskDetail
- `src/pages/AuthCallback.jsx` / `SignIn.jsx` — preserve pending `/?task=` across magic link
- `src/lib/auth.jsx` — `signOut({ discardPending })` clears session-local state
- `src/lib/household.jsx` — online/visibility membership refetch; validate saved HH
- `src/lib/offlineQueue.js` — `discardQueueOnSignOut`, `countPendingForUser`
- `src/pages/Settings.jsx` — confirm discard pending before sign-out
- `src/pages/Household.jsx` — hide role `<select>` (decision H)
- `src/components/today/TaskDetailSheet.jsx` — show `task_date`
- `scripts/e4-rls-regression.mjs` — E4-18 allows hidden role UI; E4-15/16 non-destructive
- `package.json` — `test:phase1`

## Per-defect summary (implementation)

| ID | Fix (short) |
|----|-------------|
| DL-1 | Fetch occurrence by ID → shared TaskDetail; close clears query; login preserves deep link |
| CAL-1 / HIST-1 | Calendar / History rows open same TaskDetail sheet |
| AUTH-ISO-1 | Sign-out clears active HH + preview + current-user/legacy queue (confirm if pending) |
| OFF-1 | Online/visibility membership refetch; flush revalidates `getUser()` |
| H | Hide role `<select>`; keep remove + labelled helper preview |

## Automated commands executed

Ran against local checkout at implementation commit (not a substitute for browser acceptance):

```
npm run test:phase1          # PASS
npm run test:today           # PASS
npm run test:comment-reads   # PASS
npm run test:presets         # PASS
npm run test:notifications   # PASS
npm run build                # PASS
node scripts/e4-rls-regression.mjs  # PASS 18/0  (see E4 clarification)
```

## Test matrix (York checklist)

| # | Item | Result | Evidence class |
|---|------|--------|----------------|
| 1–10 | Deep links (today/future/past/empty today/refresh/sign-in/invalid/other-HH/close/Calendar+History) | **NOT RUN** browser | Unit: resolve/clear/sanitize **PASS** |
| 11–13 | History comments / read receipts | **NOT RUN** browser | Unit comment-reads **PASS**; sheet reuse by code inspection |
| 14–17 | Sign-out isolation / queue | Unit queue discard **PASS**; shared-device browser **NOT RUN** | |
| 18–20 | Reconnect membership | Code paths present; browser **NOT RUN** | |
| 21 | E4 escalation | **PASS** 18/0 | Live authenticated Supabase (see below) |
| 22 | Cross-household RLS (E4-09/16) | **PASS** | Live authenticated Supabase |
| 23 | Atomic create + notifications | **NOT RUN** this phase | Prior smoke cited in E4-17 |
| 24 | Notif read ≠ task ack | **NOT RUN** browser | Unchanged server semantics (inspection) |

### Evidence class legend

- **Automated unit / build** — Node scripts + Vite build; no browser.
- **Live authenticated DB (E4)** — Real QA users against production Supabase project `yevqwospotfujiziegpz`; **not** mocked.
- **Browser** — Authenticated UI on preview URL; **NOT RUN**.
- **Code inspection** — Static review of logout / queue / realtime teardown.

## E4 clarification — what “E4 18 PASS” means

- **Runner:** `scripts/e4-rls-regression.mjs`
- **Clients:** `@supabase/supabase-js` with **anon key** + `signInWithPassword` for QA keys from local manifest (`/tmp/halo-kakak-qa/manifest.json` — **not** committed).
- **Target URL:** from `/tmp/halo-kakak-qa/anon.env` → `https://yevqwospotfujiziegpz.supabase.co` (same production project as Pages).
- **Not mocked:** Each scenario issues live REST/RPC as authenticated QA roles (helper/employer/owner A/B, removed helper).
- **Scope:** Membership privilege / RLS / RPC forbidden paths (E4-01…E4-18), including role-select UI expectation (E4-18: `roleSelectHidden=true`), invite accept/remove (E4-15), cross-household forbidden (E4-16).
- **Not covered by E4:** Browser deep links, Calendar/History UI, offline queue flush UX, notification-centre click → TaskDetail, reconnect without reload.
- **Do not relabel** E4 as browser verification or as frontend isolation proof.

Results artifact (local, not committed): `/tmp/halo-kakak-qa/e4-results.json` — counts PASS=18, FAIL=0.

## Security review (code inspection)

### A. Logout isolation

**Entry:** `AuthProvider.signOut` in `src/lib/auth.jsx` → `clearSessionLocalState(uid, { discardQueue })` then `supabase.auth.signOut()`; profile cleared on `SIGNED_OUT`.

**What is cleared (beyond bare session):**

| Concern | Handled? | Mechanism / files |
|---------|----------|-------------------|
| Persisted active household | Yes | `clearHouseholdLocalPrefs()` removes `halo-kakak-active-household` — `sessionLocalState.js` |
| Helper preview flag | Yes | Removes `halo-kakak-preview-helper` — same |
| Persisted offline queue (this user + legacy unscoped) | Yes (when `discardPending`) | `discardQueueOnSignOut(userId)` in `offlineQueue.js` — keeps *other* users’ scoped items |
| In-memory household/membership state | Yes (indirect) | `HouseholdProvider.loadMemberships` resets when `user` is null — `household.jsx` |
| Notifications in-memory list / unread | Yes (indirect) | `NotificationsProvider` `clearLocal()` when `!isAuthenticated` — `notificationsContext.jsx` |
| Realtime subscriptions | Yes (indirect) | Effects tear down channels when auth/household cleared — `Today.jsx`, `notificationsContext.jsx`, `TaskDetailSheet.jsx` |
| Today task list generation | Partially | `loadGenRef` ignores stale loads after newer generation — `Today.jsx` |
| Membership load race | Partially | `loadGenRef` in `household.jsx` |

**Settings UX:** If pending count &gt; 0, `window.confirm` — Cancel stays signed in; OK calls `signOut({ discardPending: true })` (`Settings.jsx`). There is no “sign out but keep my queue” path from Settings (intentional for isolation).

**Gaps (code inspection — not browser-proven):**

- **signOut does not synchronously `removeChannel` / abort in-flight fetches**; teardown depends on React effect cleanup after auth state flips.
- **Notifications `refreshList` / `refreshUnread` lack a generation token** — a response that started while signed-in could theoretically `setItems` after sign-out if the closure still runs (fail-soft UI flicker risk; server still RLS-gated).
- **No React Query / global query cache** in this app — N/A, but other in-memory page state (Calendar/History lists) relies on unmount / route change rather than an explicit sign-out wipe.
- **Cache Storage / service worker** explicitly not wiped (`sessionLocalState.js` comment).

### B. Queue replay authorization

**Flush path:** `Today.jsx` `online` handler → `supabase.auth.getUser()` must match React `user.id` → `flushQueue(handler, queueScope)` where `queueScope = { userId, householdId }`.

**Client checks:**

1. Outer auth match before flush (`getUser()` vs `user.id`).
2. Per-mutation re-check inside handler (`auth_mismatch` throw).
3. `flushQueue` skips items whose `userId` / `householdId` disagree with scope (`offlineQueue.js`).
4. Mutations call RPCs / inserts under the **current** session JWT (`update_task_occurrence`, `task_comments` insert, `markTaskCommentsRead`).

**Server:** RLS / RPC grants remain authoritative. Client scope is a **defense-in-depth filter**, not a substitute for membership checks.

**Gaps (code inspection):**

- **Client does not re-query active `household_members` before each mutation** — a removed member’s leftover queue item scoped to that HH would still be *attempted*; success depends on RLS/RPC denial. Preferred: fail closed client-side after membership refresh (membership is already refreshed best-effort before flush).
- **Legacy items without `userId`:** `peekQueue` / flush may still include them when household matches or is unknown; sign-out discard removes legacy unscoped items for the signing-out user path, but a device that never signed out cleanly could retain ambiguous rows until discarded.
- **Comment insert uses React `user.id`**, not re-read `again.user.id`, after the auth re-check (minor consistency nit if those ever diverged mid-handler).

**Conclusion:** Queue replay is **not** “any logged-in user can flush anything”; it is scoped by userId + householdId and revalidated for session identity, with **RLS as the final gate**. Browser proof of cross-account non-replay remains **NOT RUN**.

## Remaining limitations

1. Production (`main` / halo-kakak.pages.dev) still has pre–Phase-1 deep-link behaviour until merge+deploy is approved.
2. Browser Phase 1 checklist **not executed** on preview (blocked on mutating-test approval because preview shares production Supabase).
3. Multi-HH: deep link to another membership’s task does not auto-switch household (by design).
4. Employer Edit on completed tasks still appears when role allows — server enforces; polish later (decision G).
5. Template-only Calendar preview still cannot open a fabricated occurrence.

## Proposed merge / deploy / rollback (needs separate explicit approval)

1. Open PR `phase1-reliability` → `main` (or merge after review).  
2. Cloudflare Pages **auto-deploys production** from `main` (`production_branch=main`). Treat **merge and production release as one approval boundary**.  
3. Smoke deep-link + Calendar/History + sign-out on production with **approved QA** accounts only.  
4. **Rollback:** revert merge commit on `main` (Pages redeploys previous). **No DB migration** to roll back for Phase 1.

## Confirmations

- No migration applied via `apply_migration`.  
- No QA cleanup / account creation in this verification pass.  
- This document contains **no** passwords, tokens, magic links, or sensitive task text.  
- Browser acceptance and any production-data mutations await York’s explicit approval of accounts, records, and actions.
