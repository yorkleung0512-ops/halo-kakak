# Halo Kakak — MVP Phase 0 Gap Matrix & Implementation Plan

**Date:** 2026-10-20 (Asia/Hong_Kong, UTC+8)  
**Scope:** Audit only — no implementation, no migrations, no deploy, no account changes in this phase.  
**Repo:** `/workspace/halo-kakak`  
**Production:** https://halo-kakak.pages.dev/  
**Supabase:** `yevqwospotfujiziegpz` (read-only SQL inspection)  
**HEAD at audit:** `5f8835ec0435df1c2fe924480b203efc913674f3`

---

## Evidence classes (honesty rules)

| Label | Meaning |
|-------|---------|
| **Verified** | Confirmed by automated/scripted test artifacts or prior production UI smoke on disk |
| **Partial** | Substantial code/schema exists; gaps or incomplete UX remain |
| **Missing** | Not present for MVP need |
| **Defective** | Implemented path fails known tests or code path is wrong for stated goal |
| **Not verified** | Present in code/migrations; not re-executed in this Phase 0 audit |
| **Code inspection** | Conclusion from reading source/migrations only |
| **Assumption** | Inferred product intent; needs York decision |
| **Blocked** | Could not test (env / approval / missing seed day) |

This Phase 0 did **not** re-run production browser UI smoke or create/modify accounts. Prior QA files under `/tmp/halo-kakak-qa/` are cited as historical evidence.

---

## 0. Known defects FIRST (ranked)

| Rank | ID | Severity | Defect | Evidence | Proposed phase |
|------|----|----------|--------|----------|----------------|
| 1 | **G / DL-1** | **Critical** (MVP loop) | Notification deep link `/?task=<occurrence>&n=<id>` does **not** open a task whose `task_date` ≠ today. Today only loads `task_date = todayHK()`; deep-link effect only `find`s within that list. | Production UI smoke FAIL G (`ui-smoke-report.md`); code: `Today.jsx` `loadTasks` + deepTaskId effect; `notificationUtils.js` always links to `/`. | **Phase 1** |
| 2 | **CAL-1** | **High** | Calendar task rows are **not interactive** (`<li>` only). Cannot open detail/comments for non-today tasks. Blocks comment unread/read UI when Today is empty. | UI smoke N/A A3/C3/J; `Calendar.jsx` code inspection. | **Phase 1** (unblock collaboration) |
| 3 | **HIST-1** | **High** | History rows also non-interactive; completed/past tasks not reopenable for review thread. | `History.jsx` code inspection. | **Phase 1** (with CAL-1) or Phase 3 if product accepts Today-only detail |
| 4 | **OFF-1** | **Medium** | Offline: household member list goes blank; realtime WS errors; data returns only after **reload**, not auto-refetch. | UI smoke H PASS with noted bug. | **Phase 1** reliability |
| 5 | **AUTH-ISO-1** | **Medium–High** | `signOut()` clears Supabase session/profile only — does **not** clear `halo-kakak-offline-queue-v2`, `halo-kakak-active-household`, or preview flag. Shared-device isolation relied on manual `localStorage.clear()` in UI smoke. | `auth.jsx` signOut; `offlineQueue.js`; UI smoke F notes. | **Phase 1** |
| 6 | **PRIV-1** | **Medium** | Account “deletion request” only upserts `privacy_consents` with `policy_version='deletion-request'`; no ticket, no automated purge, no operator workflow. Export is client JSON (tasks ≤500, **own** comments ≤200). | `Settings.jsx` code inspection. | **Phase 3** (or 4 if beta OK with manual) |
| 7 | **AN-1** | **Low–Medium** | No analytics instrumentation (no events for household created, invite accepted, first task, helper ack, etc.). | Repo grep — no plausible/posthog/gtag. | **Phase 4** (lightest approach after decision) |
| 8 | **PUSH-1** | **Product** | Notifications are **in-app only** (DB + realtime + bell). No Web Push / OS notifications. | `notifications*` + migrations Phase 1A/1B; no push subscription code. | Defer unless York requires OS push for closed beta |
| 9 | **STOP-1** | **Product / Partial** | Pause/resume exists (`set_task_template_paused`); “stop series” is effectively `end_date` / deactivate — no dedicated stop RPC/UI copy confirmed as first-class. | `EditTaskModal.jsx`, `PHASE2_SCHEDULING.md`. | **Phase 2** after product call |
| 10 | **LEGACY-1** | **Low** (ops) | Legacy `household_sync` still exists per docs; new app does not write it. Anon RLS cutover may still be pending historically. | `docs/MIGRATION.md`. | Non-MVP / ops backlog |

**Already fixed (do not reopen as open E4):** privilege escalation on `household_members` — migration `20261019235300_harden_household_members_no_client_update.sql`, commit `5f8835e`, E4 matrix **18 PASS**, client UPDATE revoked (read-only SQL: `authenticated` has **SELECT only** on `household_members`).

---

## 1. Gap matrix

### 1.1 Auth & household invitations

| Field | Content |
|-------|---------|
| **Requirement** | Magic-link / OTP sign-in; create household; invite token (create/accept/revoke/expiry); helper joins with correct role |
| **Current implementation** | `SignIn.jsx` OTP; `AuthCallback.jsx`; RPCs `create_household`, `create_household_invite`, `accept_household_invite`, `revoke_household_invite`; `InviteAccept.jsx`; invites table RLS employer/owner only |
| **Files / tables / RPCs** | `src/lib/auth.jsx`, `src/pages/SignIn.jsx`, `InviteAccept.jsx`, `CreateHousehold.jsx`, `Household.jsx`; `household_invites`; migrations `…150200_rpc_auth_invites.sql`, `…235400_fix_invite_rpc_search_path.sql` |
| **Status** | **Partial** (core Verified historically for accept/role; invite expiry/revoke/reuse matrix **Not verified** this audit) |
| **Evidence** | Code + RLS policies present; UI smoke D removed helper; E4-15 cited in e4 scripts as invitation path; full invite edge matrix not in `ui-smoke-report.md` |
| **Minimum change** | Add/ rerun invite expiry·reuse·revoke regression tests; no rewrite of invite RPCs unless defects found |
| **Phase** | **1** (tests) / **4** (release gate) |

### 1.2 Owner / Employer / Helper authorization & RLS

| Field | Content |
|-------|---------|
| **Requirement** | Role-separated capabilities; cross-household isolation; no helper/employer self-escalation; removed members lose access |
| **Current implementation** | Roles `owner`/`employer`/`helper`; membership changes via DEFINER RPCs only; occurrence RLS + `guard_task_occurrence_update`; helpers cannot edit ZH fields / assignment / invalid statuses |
| **Files / tables / RPCs** | `household_members` (SELECT-only for authenticated); `change_household_member_role`, `remove_household_member`, `leave_household`; policies on occurrences/templates/comments/notifications |
| **Status** | **Verified** for E4 + household isolation smoke; broader RLS suite **Not verified** this turn |
| **Evidence** | `/tmp/halo-kakak-qa/e4-results.json` 18 PASS; smoke 27 PASS; UI E1–E3 isolation PASS; SQL grants SELECT-only on members |
| **Minimum change** | Keep; add regression to CI/scripts for release gate; do not reintroduce client UPDATE |
| **Phase** | Maintain; re-run in **Phase 4** |

### 1.3 Task creation & assignment

| Field | Content |
|-------|---------|
| **Requirement** | Employer/owner creates one-time or scheduled tasks; assign to helper; notes/titles bilingual |
| **Current implementation** | Preset + custom via `create_tasks_from_presets`; `AddTaskFlow` / `QuickAddConfirm`; `AssigneePicker` + `fetchActiveHelpers`; RLS insert employer/owner |
| **Files / tables / RPCs** | `src/lib/presets.js`, `taskPayload.js`, components under `presets/`; `task_occurrences`, `task_templates`, `task_creation_batches` |
| **Status** | **Partial** — creation path rich in code; end-to-end production create **Not verified** in last UI smoke (Today empty that day) |
| **Evidence** | Unit presets PASS; migrations Phase 1–3; UI showed quick-add chips for employer |
| **Minimum change** | Seed-day UI smoke for create→notify→helper see; fix assignee edge cases only if found |
| **Phase** | **2** polish / **4** validate |

### 1.4 Presets vs schedules vs occurrences

| Field | Content |
|-------|---------|
| **Requirement** | Clear separation: library presets ≠ recurring templates ≠ dated occurrences |
| **Current implementation** | System/household presets → create templates + occurrences; `ensure_today_occurrences`; unique `(template_id, task_date)` |
| **Files** | `task_presets*`, `PHASE2_SCHEDULING.md`, `TASK_PRESETS.md`, `HouseholdPresetsManager.jsx` |
| **Status** | **Partial** (architecture Verified by code/docs; generation correctness under all rules **Not verified** live this audit) |
| **Evidence** | Migrations + unit presets; `ensure_today` in household load path |
| **Minimum change** | Document UX copy; targeted recurrence tests (daily / selected weekdays / no dup) |
| **Phase** | **2** |

### 1.5 Atomic creation + notifications + idempotency

| Field | Content |
|-------|---------|
| **Requirement** | Task create and notification in one transaction; retries do not duplicate |
| **Current implementation** | `create_tasks_from_presets(..., p_idempotency_key, ...)` with `task_creation_batches` ON CONFLICT; notifications inserted in same function (Phase 1A) |
| **Files** | `20261019200100_phase1a_create_tasks_notify.sql`, `20261019220000_custom_tasks_via_rpc.sql`, `QuickAddConfirm` idempotencyKeyRef |
| **Status** | **Partial** — design Verified by code; duplicate-retry matrix **Not verified** this audit |
| **Evidence** | Migration SQL; client always passes UUID key; smoke did not specifically re-test DUPLICATE_REQUEST |
| **Minimum change** | Scripted retry/idempotency tests in Phase 2/4 |
| **Phase** | **2** (tests) / **4** (gate) |

### 1.6 Translation & TTS

| Field | Content |
|-------|---------|
| **Requirement** | ZH→ID translation via protected edge; glossary; TTS for helper; failure preserves input; high-risk warning |
| **Current implementation** | Edge `translate` (JWT, rate limit, MyMemory, no user/hh ids in provider URL); `translateClient.js`; `speakIndonesian`; `HK_DICT` / glossary; `HIGH_RISK_*` |
| **Files** | `supabase/functions/translate/index.ts`, `src/lib/translateClient.js`, `TaskCard.jsx` TTS button |
| **Status** | **Partial** — architecture present; failure UX / offline translate **Not verified** in UI smoke |
| **Evidence** | Code inspection; README deploy notes |
| **Minimum change** | Confirm save-without-translation path; user-visible error without false success; language review of glossary |
| **Phase** | **2** |

### 1.7 Today page

| Field | Content |
|-------|---------|
| **Requirement** | Mobile-first daily task list by role; sections; timezone Asia/Hong_Kong |
| **Current implementation** | Large `Today.jsx` + `todayClassify.js` + section components; `todayHK()` |
| **Status** | **Verified** (unit) / **Partial** (UI smoke: empty today day OK; deep link gap) |
| **Evidence** | `unit-today.log` PASS; UI A1/B1/C1 PASS; redesign commit `d001da0` |
| **Minimum change** | Deep-link fetch for off-today (Phase 1); otherwise no redesign |
| **Phase** | **1** for deep link only |

### 1.8 Task detail routing & notification deep links

| Field | Content |
|-------|---------|
| **Requirement** | Notification opens today/future/past tasks; safe after refresh; invalid IDs fail safely |
| **Current implementation** | `NotificationDeepLink` validates existence + marks notif read; Today opens detail **only if** task in today’s list; calendar template deep link exists |
| **Status** | **Defective** for off-today occurrence links |
| **Evidence** | FAIL G; code paths above |
| **Minimum change** | On `?task=`: if not in today list, fetch occurrence by id (RLS); if `task_date≠today`, navigate to `/calendar?date=` **or** open detail sheet with fetched row; keep unauthorized → toast + strip params |
| **Phase** | **1** |

### 1.9 Calendar / upcoming views

| Field | Content |
|-------|---------|
| **Requirement** | View tasks by date; open for collaboration/history |
| **Current implementation** | Date picker + list of titles/status; template highlight banner; **no open** |
| **Status** | **Defective** relative to MVP “review task and history” |
| **Evidence** | UI smoke; `Calendar.jsx` |
| **Minimum change** | Make rows open shared `TaskDetailSheet` (reuse Today sheet); optional `?task=` on calendar |
| **Phase** | **1** |

### 1.10 Recurrence generation & schedule controls

| Field | Content |
|-------|---------|
| **Requirement** | Daily / selected weekdays; pause/resume/stop; edit this / future / series; no dup; preserve completed |
| **Current implementation** | Rules daily/weekdays/weekly/biweekly/monthly/custom; pause RPC; scoped edit RPC; completed not overwritten (docs) |
| **Status** | **Partial** |
| **Evidence** | Migrations + EditTaskModal + PHASE2 doc; live recurrence matrix **Not verified** |
| **Minimum change** | Product decision on STOP; UI copy; automated apply-on-date tests |
| **Phase** | **2** |

### 1.11 Task comments & per-user read receipts

| Field | Content |
|-------|---------|
| **Requirement** | In-task clarification; per-user read ≠ notification read; accurate unread badges |
| **Current implementation** | `task_comments`, `task_comment_reads`, `mark_task_comments_read`, `get_my_unread_comment_summary`; `TaskDetailSheet` marks read on open |
| **Status** | **Verified** (DB/RPC smoke) / **Not verified** (production comment UI — N/A that day) |
| **Evidence** | Smoke 27 PASS comment scenarios; `unit-comment-reads.log` PASS; UI J N/A |
| **Minimum change** | Unlock via CAL-1 + seed today task; then UI verify unread→read |
| **Phase** | **1** unblock + **3** UX polish if needed |

### 1.12 Persistent notifications

| Field | Content |
|-------|---------|
| **Requirement** | Durable in-app notifications; unread count; realtime; reconnect recovery |
| **Current implementation** | `notifications` table; mark read/unread/soft delete RPCs; `NotificationsProvider` realtime; badge utils |
| **Status** | **Partial** — in-app Verified partially (helper had item); deep link Defective; reconnect count recovery **Not verified** rigorously |
| **Evidence** | UI G FAIL; unit-notifications PASS; Phase 1A/1B docs |
| **Minimum change** | Fix deep link; optional reconnect refetch test |
| **Phase** | **1** (deep link) / **3** (polish) |

### 1.13 Offline queue & account-switch isolation

| Field | Content |
|-------|---------|
| **Requirement** | Offline status/comment mutations queue; flush on online; no cross-user leakage on shared device |
| **Current implementation** | `offlineQueue.js` v2 with userId/householdId scope; Today flushes `update_task` + `mark_comments_read`; signOut does not clear queue/HH keys |
| **Status** | **Partial** / **Defective** on sign-out isolation |
| **Evidence** | Code; UI F used forced clear; OFFLINE_MSG constants |
| **Minimum change** | On sign-out: clear preview + active household + **drop or seal** queue items for previous user (prefer clear user-scoped entries); never flush another user’s mutations |
| **Phase** | **1** |

### 1.14 Privacy, export, deletion

| Field | Content |
|-------|---------|
| **Requirement** | Privacy/PICS/terms; export accessible data; deletion request path |
| **Current implementation** | Static Legal pages; Settings export JSON; deletion via consent upsert; `leave_household` for non-owners |
| **Status** | **Partial** |
| **Evidence** | Code inspection; not exercised in UI smoke beyond Settings reachability |
| **Minimum change** | Document manual deletion SLA for beta; optionally widen export; operator checklist |
| **Phase** | **3** / **4** |

### 1.15 Automated tests & deployment

| Field | Content |
|-------|---------|
| **Requirement** | Versioned migrations; runnable tests; deploy/rollback known |
| **Current implementation** | 19 migration files; npm scripts `test:presets|rls|notifications|today|comment-reads`; Cloudflare Pages + `_headers` CSP; docs per feature; no GitHub Actions visible in repo |
| **Status** | **Partial** |
| **Evidence** | package.json; unit logs PASS; smoke/e4 scripts under `/tmp` and `scripts/`; Pages URL live |
| **Minimum change** | Document release checklist; do not invent CI unless approved |
| **Phase** | **4** |

### 1.16 Task workflow states mapping

| MVP concept | DB / UI status | Gaps |
|-------------|----------------|------|
| Pending acknowledgement | `pending` | OK |
| Understood | `acknowledged` | OK |
| Question | `needs_clarification` (+ comment required) | OK |
| Completed | `completed` | OK |
| Cancelled | `cancelled` | Status exists; **employer cancel UX Not verified** |
| (extra) | `in_progress`, `delayed`, `cannot_complete` | Present in HELPER_ACTIONS — keep unless York wants simplification |

| **Status** | **Partial** — model fits MVP; full question→reply→complete UI loop **Not verified** on production last smoke |
| **Minimum change** | Do not collapse statuses without product approval; verify helper actions + employer reply via comments in Phase 3/4 |
| **Phase** | **2** (if simplify) else **4** validate |

### 1.17 Mobile UX / a11y / navigation

| Field | Content |
|-------|---------|
| **Requirement** | Mobile-first; bilingual shells; keyboard focus; 375px |
| **Current implementation** | Bottom `Nav`; helper ID / employer ZH; focus-visible rings; PWA manifest + `sw.js` shell cache |
| **Status** | **Verified** for spot checks (375, keyboard nav) |
| **Evidence** | UI I, A6 PASS |
| **Minimum change** | None beyond defect fixes; list untested browsers at release |
| **Phase** | **4** |

### 1.18 Analytics measurement readiness

| Field | Content |
|-------|---------|
| **Requirement** | Light privacy-conscious events for beta (household, invite, first task, ack, errors); no content/credentials |
| **Current implementation** | **None** |
| **Status** | **Missing** |
| **Evidence** | Grep empty |
| **Minimum change** | Propose first-party event table or single privacy-safe provider **after** York decision; distinguish QA vs real |
| **Phase** | **4** (after decision) |

---

## 2. Already satisfied — do NOT rewrite

Treat as keep/maintain (tests only unless regression):

1. **E4 membership hardening** — no client UPDATE; owner RPCs for role/remove/leave  
2. **Normalized schema** — households, members, templates, occurrences, comments, events, glossary, consents  
3. **Invite token RPCs** (hash-at-rest pattern per docs)  
4. **`create_tasks_from_presets` idempotency + in-tx notifications** architecture  
5. **Comment read receipts** RPC/summary model (DB verified)  
6. **Today classification / section redesign** (unit verified)  
7. **Preset library + Quick Add + batch UX** (unit verified)  
8. **Scoped edit + pause** RPCs and EditTaskModal wiring  
9. **Translate edge function** privacy posture (JWT, no ids to MyMemory)  
10. **In-app notification centre** data model + mark read APIs  
11. **Bilingual STATUS_LABELS / HELPER_ACTIONS** including clarification requiring comment  
12. **Cross-household RLS isolation** (UI smoke E + DB smoke)  
13. **Security headers / CSP** on Pages  

---

## 3. Proposed phases (smallest plan)

### Phase 1 — Critical reliability (unblocks MVP loop)

**Scope (implementation only after York approval):**

- Fix notification / `?task=` deep link for past, today, and future occurrences (fetch by id; calendar redirect or detail sheet; safe failure).  
- Make Calendar (and preferably History) rows open the existing task detail/comment sheet.  
- Sign-out / account-switch: clear preview + active-household keys; clear or hard-scope offline queue so User B cannot flush User A mutations.  
- Offline reconnect: refetch memberships (and notifications count) on `online` without requiring full reload.  
- Re-run E4 + comment-read smoke scripts (no schema change expected).  

**Why before Phase 2:** Without opening non-today tasks, employer↔helper clarification and notification→task cannot be validated.

**Out of scope:** Recurrence redesign, analytics, push, deletion automation, unrelated refactors.

### Phase 2 — Task, translation, recurrence gaps

- Recurrence apply-on-date / no-duplicate tests; clarify stop vs pause vs end_date per product decision.  
- Translation failure / save false-success audit; TTS smoke.  
- Assignment + one-time vs recurring create UI smoke with seeded today.  
- Only then consider status-set simplification if York requests.

### Phase 3 — Collaboration, views, notifications polish

- Comment unread badges / mark-read UX after Phase 1 unlock.  
- Notification centre reconnect/count edge cases.  
- Privacy export completeness + deletion-request operator notes.  
- Optional calendar `?date=` / `?task=` parity.

### Phase 4 — Release validation & beta readiness

- Full DB/RPC matrix + E4 + production UI smoke (both roles, two households, mobile).  
- Light analytics **after** approach approval.  
- Language review list; short user guide; known limitations; deploy/rollback sheet.  
- **No QA cleanup** until separate approval.

**Dependency note:** Items moved — Calendar/History open moved from “views (3)” into **Phase 1** because they gate deep link and comment verification.

---

## 4. Open product decisions (cannot safely infer)

1. **Deep link UX:** Stay on Today with fetched off-today sheet, **or** navigate to Calendar for that `task_date`?  
2. **Stop series:** Dedicated Stop control vs pause + end_date only for MVP?  
3. **Helper statuses:** Keep `in_progress` / `delayed` / `cannot_complete` in MVP UI, or reduce to understood / question / completed?  
4. **OS Web Push** required for closed beta, or in-app bell sufficient?  
5. **Employer cancel:** Must employers cancel from UI, or only helpers complete + employers edit/delete?  
6. **Analytics:** First-party `analytics_events` table vs third-party (Plausible-like); how to tag QA households?  
7. **Account deletion SLA:** Manual email process OK for invite-only beta?  
8. **History:** Must past completed tasks reopen comments for “review history,” or is Calendar enough?  
9. **Multi-member:** Keep owner role-management UI as-is for beta, or hide employer/helper role swaps in UI while RPC remains?

---

## 5. Tests actually available vs this Phase 0

| Artifact | Result | Used as |
|----------|--------|---------|
| `e4-results.json` | 18 PASS / 0 FAIL | Verified E4 |
| `smoke-results.json` / `smoke-report.md` | 27 PASS / 0 FAIL | Verified comment-read + post-E4 DB matrix |
| `ui-smoke-report.md` | 17 PASS / 1 FAIL / 3 N/A | Verified UI roles/isolation; Defective deep link |
| `unit-*.log` | All listed unit suites passed | Verified pure unit helpers |
| Phase 0 browser re-run | **Not run** (by instruction) | — |
| Live invite expiry/reuse matrix | **Not run** | Not verified |
| Live recurrence generation matrix | **Not run** | Not verified |
| Live translation failure | **Not run** | Not verified |

Read-only SQL confirmed: `household_members` policies SELECT-only; no authenticated UPDATE grant; RPCs listed including `change_household_member_role`, `create_tasks_from_presets`, comment/notification helpers, pause/scoped edit.

---

## 6. Inspection blockers

- No approval to re-auth production UI or create tasks for “today” — comment UI remains historically N/A.  
- MCP `execute_sql` returns one result set when multiple statements batched — queries were split; some multi-statement calls truncated to last set (grants). Core policies/RPCs still retrieved.  
- QA `manifest.json` passwords **not** read/printed.  
- No access claimed to Cloudflare deploy logs or Supabase auth email logs in this audit.  
- CI pipeline absent from repo tree — deploy process partially documented in README/docs only.

---

## 7. Stop here

**Phase 0 complete.** Awaiting York approval before any Phase 1 implementation, migration, or deploy.

Suggested approval reply: approve Phase 1 scope as listed (or amend deep-link UX choice from §4.1 first).

---

## 8. Product decisions recorded (York, 2026-10-20) — implement later except H in Phase 1

| ID | Decision | Phase 1 action |
|----|----------|----------------|
| **A** | Pause = temporary; resume does **not** backfill all paused dates; **Stop** ends future recurrence, preserve history; reuse `end_date`; document effect on already-generated future occurrences before later impl. | **Record only** (Phase 2+) |
| **B** | Keep internal helper statuses; user-facing: Pending ack / Understood / Question / Completed; Cancelled separate; reading notif or opening task ≠ acknowledge; no mandatory In progress. | **Record only** |
| **C** | Web Push out of MVP; in-app only; no permission prompt. | **Record only** |
| **D** | Employer cancel UI later unless already working; prefer cancel over delete; preserve history + notify. | **Record only** |
| **E** | Analytics not Phase 1; later minimal first-party; no third-party without approval; no content in analytics. | **Record only** |
| **F** | Manual deletion OK for beta; provisional: ack 3 business days, complete 30 calendar days after identity/scope verify; not a legal claim; document process before publishing; don't auto-delete other members' records. | **Record only** |
| **G** | History comments accessible via TaskDetail; new comments on completed/cancelled follow **existing** permissions; report current behaviour. | **Phase 1:** History opens TaskDetail (done). Current: sheet shows comments/read flow; Edit shown for employer-side when `canEditTasks` regardless of status (server still enforces). |
| **H** | Hide technical/debug role-changing controls in beta UI; helper preview only if read-only + labelled; hiding ≠ auth; do **not** rewrite E4. | **Phase 1:** role `<select>` hidden; preview kept (labelled read-only); remove-member kept; E4 RPCs unchanged. |

**Deep-link UX (approved):** Shared TaskDetail by occurrence ID — Today sheet/modal; not Calendar navigation redesign.

---

## 9. Phase 1 implementation status (code on branch `phase1-reliability`)

**Date:** 2026-10-20 (Asia/Hong_Kong, UTC+8)  
**Authorization:** Local/branch code + unit/E4 scripts only. **No** production Pages deploy (main untouched). **No** schema migration applied.

| Defect | Status after Phase 1 | Notes |
|--------|----------------------|-------|
| **DL-1** | **Fixed in code** (unit-tested; browser on production **NOT RUN** — branch not on main) | `fetchTaskOccurrenceById` + `useTaskOccurrenceDetail`; Today deep link no longer limited to `todayHK()` list; close clears `task`/`n`/`comment`; AuthCallback preserves pending deep link |
| **CAL-1** | **Fixed in code** | Calendar real occurrences clickable → TaskDetail |
| **HIST-1** | **Fixed in code** | History rows → TaskDetail (instructions/status/comments/read) |
| **AUTH-ISO-1** | **Fixed in code** | Sign-out clears active-household + preview + user/legacy offline queue (confirm if pending); membership restore validates against active rows |
| **OFF-1** | **Fixed in code** | `online` / visibility refetch memberships + Household members; flush revalidates auth user |
| **H (UI)** | **Done** | Role select hidden |

### Multi-household deep link behaviour (unchanged product rule)

If RLS returns an occurrence whose `household_id` ≠ active household, the client **does not** switch household and treats the link as unavailable (same safe message as missing/unauthorized). Choosing another household remains the existing Settings/membership picker behaviour — not changed in Phase 1.

### Projected recurrence (Calendar `?template=`)

Still **read-only schedule preview** — does not fabricate occurrence IDs or create tasks on open.

### Tests executed

| Suite | Result |
|-------|--------|
| `npm run test:phase1` | PASS |
| `test:today` / `comment-reads` / `presets` / `notifications` | PASS |
| `scripts/e4-rls-regression.mjs` | **18 PASS / 0 FAIL** (after restoring QA employer-a left `removed` by a prior destructive E4-16; script now non-destructive) |
| Production UI browser checklist 1–20 | **NOT RUN** (requires deploy/preview + computerUse) |
| Cloudflare Pages production (`main`) | **Not deployed** |

### Remaining / follow-ups

- Browser validation of deep links on a **preview** deployment.  
- QA employer restore was a one-time ops fix (approved SQL); keep E4-16 non-destructive.  
- Phase 2+ for decisions A–F, cancel UI, analytics, etc.

**Stop:** Await approval before merging to `main` (Pages production auto-deploys from `main`), cleanup, or Phase 2.
