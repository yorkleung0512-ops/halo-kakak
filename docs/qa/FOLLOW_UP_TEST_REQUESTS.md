# Follow-up test approval requests (NOT EXECUTED)

These are drafts for York approval only. No fixtures, browser writes, or Batch B under this document.

Target deployment for any future run must be confirmed at approval time. Immutable preview `e529aa43` (`689f8e1`) does **not** include A8/SW fixes; after an approved push of those fixes, use the **new** Cloudflare Preview URL, not `e529aa43`.

---

## Request A — genuine sign-in (deep link preserved)

**Goal:** Verify the **real** supported Magic Link journey for existing QA identity **qa-helper-a** (`1c921b48-02e4-4df5-9224-b1e995db2b34`, email `qa-helper-a@halokakak-qa.test`) with task deep link preserved:

`https://<approved-preview>/?task=a1111111-1111-4111-8111-111111111101`

**Do not** create another account.  
**Do not** ask York to paste a Magic Link, OTP, password, or token into chat.

### Proposed steps (executor + human inbox)

1. Clean browser context on the approved preview origin (no pending offline queue; if queue keys non-null → **stop** and report).
2. Ensure signed out.
3. Navigate to `/?task=a1111111-1111-4111-8111-111111111101` → expect redirect to `/signin` with React Router `state.from` preserving path+search (app stores pending deep link on submit via `storePendingDeepLink`).
4. On `/signin`, enter **only** `qa-helper-a@halokakak-qa.test` in the email field and submit **發送登入連結** / magic-link send (no password).
5. **York step (human):** Open the QA inbox for `qa-helper-a@halokakak-qa.test` on the normal mail client / provider UI that already receives Halo-Kakak OTP mail. Open the latest Halo-Kakak sign-in message and click the magic link **in that client** (or use the provider’s “open link” control). Do **not** copy the URL into chat or into the agent.
6. Expect browser to land on `/auth/callback` then navigate to `/?task=a1111111-1111-4111-8111-111111111101` with TaskDetail for that occurrence.
7. Narrow read-only before/after on that task status (must remain pending); no ack/complete clicks.

If the QA inbox is inaccessible to York, **stop** — do not fall back to session inject for this request; report blocked.

### Side effects to list at approval

**Authentication / session**

- Supabase `signInWithOtp` email send for the existing QA user.
- Session cookies / local Supabase auth storage on the preview origin after link open.
- Possible `auth/callback` session establishment; `consumePendingDeepLink` clears `sessionStorage` key `halo-kakak-pending-deep-link`.

**Application data (possible, existing behaviour)**

- Opening TaskDetail may auto-mark **other users’** comments as read (`task_comment_reads`) if any exist for this viewer — for helper opening `a111…101`, helper-authored threads typically do not self-mark; still snapshot receipts before/after.
- Must **not**: create tasks, change status/ack, membership, notification centre bulk-read, queue discard/replay, or touch Household B.

---

## Request B — Recipient comment-read test via deep link

**Label (exact):** Recipient comment-read test via deep link.

**Account:** qa-employer-a `d07c1d29-4e35-472d-85e3-c53cb63bbc6f`  
**Household:** `9aebc0cd-3388-4cc9-8630-530cc6e89185`  
**Task:** `a1111111-1111-4111-8111-111111111190` (pending — **does not appear in History**)  
**Helper-authored comment:** `c1111111-1111-4111-8111-111111111190`

**Does not validate the History entry point** (task is pending).

### Proposed steps

1. **Before snapshot (read-only):**  
   - Employer + helper `task_comment_reads` rows for `c111…190` (expect empty / unchanged helper).  
   - Task `a111…190` status / version / updated_at.  
   - Employer unread comment summary / count if the app exposes it for HH A.
2. Sign in as **qa-employer-a** only (method per separate approval; inject vs genuine sign-in).
3. Open deep link: `/?task=a1111111-1111-4111-8111-111111111190&comment=c1111111-1111-4111-8111-111111111190` (or `/?task=…` then confirm comment visible).
4. Employer must **actually view** the helper-authored comment in TaskDetail (scroll/focus OK; do **not** click “全部標為已讀” unless needed to distinguish auto-mark-on-view — prefer relying on normal auto-mark-after-render for others’ comments).
5. **After snapshot:**  
   - Employer receipt for `c111…190` updated via normal app flow.  
   - Helper receipt **unchanged**.  
   - Task status **unchanged**.  
   - Employer unread count decreases appropriately if it included this comment.

### Side effects to disclose before approval

- **Expected application writes:** `task_comment_reads` insert/upsert for **employer** on `c111…190` (and any other other-user comments on that task that render and auto-mark). Possible refresh of employer unread-comment summary.
- **Not expected / not allowed:** task status/ack changes; helper receipt changes due to employer action; new comments; notification centre opens that mark **notifications** read; membership changes; Household B access; fixture creation.
- **Notification read-state:** This deep link does **not** require opening the notification tray. If `?n=` is omitted, notification `read_at` should be unchanged. Do not pass `?n=` unless separately approved.
- Opening the sheet may still generate normal auth/session activity only.

### Explicit non-claims

- Does **not** claim History entry validation.
- Does **not** replace blocked A5 History path; it is a **revised recipient** check via deep link only.
