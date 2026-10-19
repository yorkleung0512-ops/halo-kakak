# Phase 1B — Notification Centre (in-app only)

**Status:** Shipped on `main`. **No** Today redesign / Web Push / `Notification.requestPermission`.

## What shipped

| Piece | Detail |
|--------|--------|
| Bell + badge | Header; badge `1–99` / `99+`; aria-label includes unread count |
| Centre | Modal: 全部/未讀 · mark read/unread · mark all · open |
| Toast | Realtime INSERT only (not initial load); View/Dismiss; `role="status"`; pause on hover/focus |
| Deep links | `/?task=<occurrenceId>&n=<notifId>` · `/calendar?template=<id>&n=…`; validates existence; safe fail |
| Unread | Always from `get_unread_notification_count()` (DB), not local-only trust |
| Offline | Amber banner in Centre when offline / fetch error |
| a11y | Escape closes Modal (returns focus to bell); 44px targets; `lang` |

## Realtime

1. Migration `20261019210000_phase1b_notifications_realtime.sql` adds `public.notifications` to `supabase_realtime` and sets `REPLICA IDENTITY FULL`.
2. Client: one channel `hola-kakak-notif-<userId>` with `postgres_changes` **INSERT** (+ UPDATE) filtered by `recipient_user_id=eq.<uid>`.
3. RLS still applies; users only receive their rows.
4. Cleanup: `removeChannel` on unmount / user change / sign-out (`isAuthenticated` false clears state).
5. No duplicate subs: single `channelRef`; recreated only when user id changes.
6. On INSERT after initial load → toast + optimistic list + delayed unread RPC reconcile.
7. `visibilitychange` / `online` → refetch list + unread from DB.

## Files

- `src/lib/notificationUtils.js` — badge, copy, deep links, labels
- `src/lib/notifications.js` — Supabase API helpers
- `src/lib/notificationsContext.jsx` — provider / realtime / state
- `src/components/notifications/NotificationBell.jsx`
- `src/components/notifications/NotificationCentre.jsx`
- `src/components/notifications/NotificationToast.jsx`
- `src/components/notifications/NotificationDeepLink.jsx`
- `src/App.jsx` — header bell + provider
- `src/pages/Today.jsx` / `Calendar.jsx` — deep-link highlight
- `src/components/TaskCard.jsx` — `id="task-…"`
- `supabase/migrations/20261019210000_phase1b_notifications_realtime.sql`

## Tests

```bash
npm run test:notifications   # badge / copy / deep-link
npm run test:presets
npm run build
```

## Rollback

1. Redeploy previous frontend (bell unused if tables remain).
2. Optional: `alter publication supabase_realtime drop table public.notifications;`

## STOPPED

Today-page summary redesign and schedule-management redesign are **not** started.
