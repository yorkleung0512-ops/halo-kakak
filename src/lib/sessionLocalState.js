import { discardQueueOnSignOut, countPendingForUser } from './offlineQueue'

export const STORAGE_ACTIVE_HOUSEHOLD = 'halo-kakak-active-household'
export const STORAGE_PREVIEW_HELPER = 'halo-kakak-preview-helper'

export function clearHouseholdLocalPrefs() {
  try {
    localStorage.removeItem(STORAGE_ACTIVE_HOUSEHOLD)
    localStorage.removeItem(STORAGE_PREVIEW_HELPER)
  } catch {
    /* ignore */
  }
}

/**
 * Clear user/household-scoped client state on sign-out.
 * Does not wipe Cache Storage / service-worker assets.
 */
export function clearSessionLocalState(userId, { discardQueue = true } = {}) {
  const pendingBefore = discardQueue ? countPendingForUser(userId) : 0
  if (discardQueue) discardQueueOnSignOut(userId)
  clearHouseholdLocalPrefs()
  return { pendingDiscarded: pendingBefore }
}

export { countPendingForUser, discardQueueOnSignOut }
