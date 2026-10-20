/**
 * Monotonic session/household epoch.
 * Bump on SIGNED_OUT, user id change, or active household change so
 * in-flight loaders and Realtime handlers can ignore stale results.
 * Abort alone is not sufficient — always compare epochs before setState.
 */

let epoch = 0
const listeners = new Set()

export function getSessionEpoch() {
  return epoch
}

export function bumpSessionEpoch(reason = 'unspecified') {
  epoch += 1
  for (const fn of listeners) {
    try {
      fn(epoch, reason)
    } catch {
      /* ignore listener errors */
    }
  }
  return epoch
}

/** Subscribe to epoch bumps. Returns unsubscribe. */
export function subscribeSessionEpoch(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Snapshot helper for async work:
 *   const snap = captureEpoch()
 *   ...await...
 *   if (!snap.isCurrent()) return
 */
export function captureEpoch() {
  const at = epoch
  return {
    at,
    isCurrent: () => at === epoch,
  }
}
