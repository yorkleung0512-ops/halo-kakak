# Batch A subset — corrected acceptance (not 7/7 fully accepted)

**Target:** https://e529aa43.halo-kakak.pages.dev  
**Deployed commit:** `689f8e10bfc1f6e61d90e7f5b5bab8e4163331fa`  
**Isolation ancestor:** `f0fe64a92564d926a0fb4994ff347724a751572b`  
**Run window:** approx 2026-10-21 12:00–12:11 HKT (Asia/Hong_Kong)  
**HK date:** 2026-10-21  

**Classification rule:** Do **not** label this batch “7/7 fully accepted.” Successful scenarios are preserved; A7 / A8 / SW carry explicit caveats.

Evidence (no credentials in these files):
- Browser report: `/tmp/halo-kakak-qa/batch-a-browser-report.json`
- Before DB: `/tmp/halo-kakak-qa/batch-a-before.json`
- After DB: `/tmp/halo-kakak-qa/batch-a-after.json`
- Screenshots: `/tmp/halo-kakak-qa/batch-a-shots/`

Auth method used in the run: DevTools session inject for route handling (not Magic Link end-to-end). Tokens/JWTs/passwords are **not** recorded here.

---

## Corrected acceptance table

| ID | Status | Account | Task ID | Notes |
|----|--------|---------|---------|-------|
| A3 | **PASS** | qa-employer-a | `a1111111-1111-4111-8111-111111111101` | Calendar on 2026-10-19 → opened shared TaskDetail (任務詳情 / 待處理). Shot: `A3-task-detail.png` |
| A6 | **PASS** | qa-helper-a | `a1111111-1111-4111-8111-111111111101` | Deep link `/?task=` opened sheet; reload restored same task. Shot: `A6-task-detail-after-reload.png` |
| A7 | **PASS for injected-session callback/deep-link restoration; real user sign-in journey NOT RUN** | qa-helper-a | `a1111111-1111-4111-8111-111111111101` | Logged-out `/?task=` → `/signin`; pending deep-link key + inject → `/auth/callback` → sheet restored. Queue v1/v2 were null. Does **not** verify Magic Link email delivery/open/callback. Shots: `A7-deeplink-after-callback.png` |
| A8 | **PASS on refresh-does-not-reopen; UNRESOLVED FINDING on two-click Tutup** (single-action dismissal not clearly verified) | qa-helper-a | `a1111111-1111-4111-8111-111111111101` | After close, URL `/`; refresh did not reopen (shot `A8-after-refresh-no-sheet.png`). First Tutup cleared query but a dialog node was still counted ~700ms; second Tutup cleared it. See `a8-investigation.md`. |
| A9 | **PASS** | qa-helper-a | `00000000-0000-4000-8000-000000000099` | Safe failure toast; no task body leak; URL → `/`. Shot: `A9-invalid-task-toast.png` |
| A10 | **PASS** | qa-helper-a | `b2222222-2222-4222-8222-222222222201` | No HH B content; active household stayed QA Household A; same safe toast. Shots: `A10-b-task-still-household-a.png` |
| A12 | **PASS** | qa-helper-a | `a1111111-1111-4111-8111-111111111101` | Opened sheet only; no ack/complete; visible Status: Menunggu. Shots: `A12-open-sheet-status-menunggu.png` |

### Still blocked (not run)

A1, A2, A4, A5, A11 — fixture / completed-history / unread-notification prerequisites (unchanged).

---

## Unresolved diagnostic: service-worker TypeError

Observed during A3 (DevTools):  
`Uncaught (in promise) TypeError: Failed to convert value to 'Response' (sw.js)`, tied to a FetchEvent for a sign-in URL.

**Treated as an unresolved diagnostic finding — not automatically harmless.**  
See `/tmp/halo-kakak-qa/sw-investigation.md`. The immutable preview `e529aa43` does **not** contain any later SW fix.

Page console after interactions: 0 page errors; 1 deprecation warning (`apple-mobile-web-app-capable`).

---

## Before / after DB (narrow)

Task `a1111111-1111-4111-8111-111111111101`:

| Field | Before | After |
|-------|--------|-------|
| status | pending | pending |
| completed_at / completed_by | null | null |
| version | 1 | 1 |
| updated_at | 2026-10-19T15:01:34.946025+00:00 | unchanged |

No separate acknowledgment columns in schema; status / completed_* / version / updated_at used.  
Comment `c1111111-1111-4111-8111-111111111190` read receipts: helper and employer both empty after the run.

---

## Local follow-up (branch only; not on e529aa43)

Branch tip at investigation start: `689f8e1`. Narrow A8 close/deep-link reopen guard + SW `respondWith` Response fallback land on `phase1-reliability` after York-approved push; that push auto-publishes a **new** Cloudflare Preview. **Immutable preview `e529aa43` does not contain those fixes.**

Calendar / History deep-link effects call `openTaskById` from the shared hook and rely on `closingDeepLinkRef` (not `shouldSkipDeepLinkReopen`, which is Today-only). That is enough for the close-race while `?task=` is still present.

Regression: `npm run test:a8-close-guard`, `npm run test:sw-fallback`, `npm run test:phase1`.

---

See also: [FOLLOW_UP_TEST_REQUESTS.md](./FOLLOW_UP_TEST_REQUESTS.md) (Request A genuine sign-in; Request B recipient comment-read via deep link). Not executed.
