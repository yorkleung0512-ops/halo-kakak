# Halo Kakak — Phase 1 Reliability Verification Report

**Branch:** `phase1-reliability`  
**Zone:** Asia/Hong_Kong (UTC+8)  
**Report date:** 2026-10-21

## Commit distinction

| Role | SHA | Notes |
|------|-----|-------|
| Original implementation | `11854fe02dfeeb2668c697183179952318aaa13f` | Deep-link, Calendar/History open, initial sign-out isolation |
| Docs (pre-isolation) | `d255312` / tip `97de02e` | Sanitized report only |
| **Isolation security fix** | *(filled after commit)* | sessionEpoch, queue quarantine, membership revalidate, loader guards |
| **Deployed preview after push** | same as isolation fix commit | Push to `phase1-reliability` **auto-updates Cloudflare Pages preview** (not production) |

Do **not** run browser tests against `11854fe` and present them as validation of the isolation fix.

## Preview target

| Field | Value |
|-------|-------|
| Preview URL (branch alias) | https://phase1-reliability.halo-kakak.pages.dev |
| Cloudflare `production_branch` | `main` → **merge to main = production deploy** |
| Production site (unchanged until merge) | https://halo-kakak.pages.dev — `main` |

### Backend / environment

- Preview and production Pages builds both use Supabase project `yevqwospotfujiziegpz` (**shared production DB**).
- Preview is **not** an isolated database.
- Authenticated browser tests **can mutate production data** — require York’s bounded QA approval.
- **Pushing `origin/phase1-reliability` automatically deploys/updates the Cloudflare preview** for this branch. It does **not** deploy production.

## Authorization compliance (this isolation pass)

| Action | Done? |
|--------|-------|
| Branch-only code fixes | Yes |
| Local / non-production unit tests | Yes |
| Live E4 / password login to production Supabase | **No** (not re-run) |
| Production DB writes | **No** |
| Create accounts / migrations / QA cleanup | **No** |
| Merge `main` / production deploy | **No** |
| Browser acceptance | **NOT RUN** (awaiting bounded approval after this fix) |

## Isolation security fixes (this pass)

### 1. Late-response / account-switch isolation

- New `src/lib/sessionEpoch.js`: monotonic epoch; `bumpSessionEpoch` / `getSessionEpoch` / `subscribeSessionEpoch` / `captureEpoch`.
- Bumped on: `clearSessionLocalState`, `SIGNED_OUT` / external auth loss (`auth.jsx`), user id change, household select/switch (`household.jsx`).
- Generation + epoch guards before `setState` in:
  - `notificationsContext.jsx` (refreshList / refreshUnread / Realtime INSERT+UPDATE)
  - `Today.jsx` (loadTasks, mergeTemplatesAndComments, unread comments, Realtime handlers)
  - `Calendar.jsx` / `History.jsx` (list fetch; clear on user/household/epoch)
  - `Household.jsx` page (members/invites load)
  - `household.jsx` glossary load
- Abort alone is not relied on; epoch/gen checked after awaits.
- Auth changes outside Settings button: `onAuthStateChange` `SIGNED_OUT` / user→null calls `clearSessionLocalState` (idempotent with explicit `signOut`).

### 2. Legacy queue ownership

- `isTrustedScope(m)` requires **both** non-empty `userId` and `householdId` stamps on the queue entry.
- `payload.household_id` alone is **not** ownership trust; enqueue no longer promotes it to `householdId`.
- Quarantined items: never flushed, never in `peekQueue` / `pendingTaskIds`; `listQuarantined` / `countQuarantined` / `discardQuarantined`.
- Sign-out discards this user’s **trusted** items; quarantined remain until **explicit** Settings discard (no silent discard of ambiguous work; next user cannot flush them).
- Settings shows amber banner + discard when `quarantined > 0` (zh / id).

### 3. Membership revalidation before replay

- `verifyActiveMembership(householdId, expectedUserId)` in `household.jsx` (server path: `auth.getUser` + `household_members` active row).
- `Today.jsx` online flush: batch blocked if membership not ok; per-mutation re-check auth, queue owner, household stamp, and membership. Failures leave items in queue (no false-success toast).
- RLS remains authoritative on writes.

### 4. Service worker cache policy

**File:** `public/sw.js` (`halo-kakak-shell-v1`)

| Cached | Not cached |
|--------|------------|
| App shell: `/`, `/index.html`, `/manifest.webmanifest`, `/favicon.svg` | Any request whose hostname includes `supabase` |
| Same-origin static GET assets (stale-while-revalidate) | `/functions`, paths containing `/rest/` or `/auth/` |
| Navigation network-first; offline fallback to cached `/index.html` | Non-GET methods |

**Private data after logout:** Authenticated API responses (tasks, comments, notifications) go to Supabase hosts and are **explicitly skipped** by the fetch handler, so they do not enter Cache Storage. Not clearing SW cache on logout is acceptable for public shell assets only. **No code change required** for SW in this pass.

## Automated test results (simulations — not browser)

```
npm run test:phase1             # PASS (phase1-unit + phase1-isolation-unit)
npm run test:today              # PASS
npm run test:comment-reads      # PASS
npm run test:presets            # PASS
npm run test:notifications      # PASS
npm run build                   # PASS
```

`scripts/phase1-isolation-unit.mjs` covers (labeled **automated simulations, no network**):

- Stale notifications after logout / user switch / household switch ignored
- Calendar/History-style loader cleared; stale cannot repopulate
- Legacy queue blocked from flush/peek/pendingTaskIds
- User A queue cannot flush as User B
- Removed / failed membership blocks replay; ok membership allows
- Scoped retries keep distinct ids
- `payload.household_id` alone not trusted
- Sign-out keeps quarantined; next user cannot flush

**Not run:** `e4-rls-regression.mjs` (live production), any browser tests.

## Security review — remaining findings

| Finding | Severity | Notes |
|---------|----------|-------|
| In-flight fetches not AbortController-cancelled everywhere | Low | Epoch/gen guards prevent setState; abort is best-effort where present |
| Explicit signOut still relies on effect teardown for Realtime | Low | Channels cleaned on auth/user/hh change; handlers also check userId/epoch |
| Quarantined items remain in localStorage until explicit discard | Intentional | Banner in Settings; not silent |
| Preview shares production Supabase | Process | Browser run needs bounded QA approval |
| Seed records from 2026-10-19 may be stale | Process | Manifest lists confirmation / proposed_qa_records |

## Browser approval manifest

- Path: `/tmp/halo-kakak-qa/phase1-browser-approval-manifest.json`
- Sanitized summary below. **No passwords / tokens / OTPs / magic links.**
- Opening task/comment treated as **potentially mutating** (notification read / comment_reads).

### Scenario table (approval request)

| Test ID | Account | Household | Existing IDs / proposed | Mutating? | Real HH data? | Cleanup (NOT authorized) |
|---------|---------|-----------|-------------------------|-----------|---------------|---------------------------|
| A1 | qa-helper-a | A `9aeb…` | **proposed:** future occ + unread notif | Yes (notif read) | No if QA-only | delete disposable notif |
| A2 | qa-helper-a | A | yesterday `a111…190`; notif needs confirm | Yes | No | reset read_at |
| A3 | qa-employer-a | A | `a111…101` | Potentially | No | none / receipts |
| A4 | qa-employer-a | A | `a111…190` | Potentially | No | none |
| A5 | qa-helper-a | A | occ + comment `c111…190` | Yes (comment_reads) | No | delete receipts |
| A6 | qa-helper-a | A | `a111…101` | No expected | No | none |
| A7 | qa-helper-a | A | `a111…101` | Auth only | No | none |
| A8 | qa-helper-a | A | `a111…101` | No | No | none |
| A9 | qa-helper-a | A | fake UUID | No | No | none |
| A10 | qa-helper-a | A vs B occ `b222…201` | No leak expected | No | No | none |
| B1 | helper-a → helper-b | A→B | — | No | No | none |
| B2 | helper-a → helper-b | A/B | **proposed disposable** offline target | Yes if flush | No | revert disposable |
| B3 | qa-helper-a | A | local pending | Local | No | discard local |
| B4 | qa-helper-a | A | local pending discard | Local irreversible | No | none |
| B5 | helper-a → helper-b | A/B | — | No | No | none |
| B6 | qa-removed-helper-a | A (removed) | optional local queue | Yes if attempt write | No | clear local |
| C1 | qa-owner-a | A | — | Reads | No | none |
| C2 | qa-helper-a | A | **proposed disposable** | Yes (flush) | No | revert |
| C3 | qa-helper-a | A | notif `f111…101` + occ | Yes (notif) | No | reset read_at |
| C4 | qa-helper-a | A | `a111…101` | Potentially receipts | No | none |
| C5 | helper-a + employer-a | A | comments `c111…101/102` | Yes (receipts) | No | delete A receipts |
| C6 | qa-helper-a | A | — | Yes | No | reset reads |

**Missing before run:** confirm seed still exists; approve proposed future-notif + disposable offline targets if missing. Do not create automatically.

## Per-defect summary (cumulative Phase 1)

| ID | Fix (short) |
|----|-------------|
| DL-1 | Fetch occurrence by ID → shared TaskDetail; close clears query; login preserves deep link |
| CAL-1 / HIST-1 | Calendar / History rows open same TaskDetail sheet |
| AUTH-ISO-1 | Sign-out + SIGNED_OUT clear prefs/queue; epoch invalidates loaders; Calendar/History/Household wiped |
| OFF-1 | Online membership refetch; flush revalidates auth **and** active membership |
| Queue legacy | Quarantine unscoped; explicit discard; no cross-account replay |
| H | Hide role `<select>`; keep remove + labelled helper preview |

## Proposed merge / deploy / rollback (needs separate explicit approval)

1. After browser pass on **isolation-fix preview commit**, open PR `phase1-reliability` → `main`.
2. Cloudflare Pages **auto-deploys production** from `main`. Treat **merge and production release as one approval boundary**.
3. Smoke with approved QA accounts only.
4. **Rollback:** revert merge on `main` (Pages redeploys previous). **No DB migration** for Phase 1.

## Confirmations

- No migration; no QA cleanup; no account creation; no live E4 re-run; no browser run in this pass.
- No passwords, tokens, magic links, or sensitive task text in this document.
- Browser acceptance awaits York’s explicit bounded approval against the **isolation fix** preview commit.
