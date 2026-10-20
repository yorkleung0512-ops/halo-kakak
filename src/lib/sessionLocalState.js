import {
  discardQueueOnSignOut,
  countPendingForUser,
  countQuarantined,
  discardQuarantined,
  listQuarantined,
} from './offlineQueue'
import { bumpSessionEpoch } from './sessionEpoch'

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
 * Clear user/household-scoped client state on sign-out / session invalidation.
 * Does not wipe Cache Storage / service-worker assets.
 * Bumps session epoch so in-flight loaders ignore late responses.
 */
export function clearSessionLocalState(userId, { discardQueue = true } = {}) {
  const pendingBefore = discardQueue ? countPendingForUser(userId) : 0
  if (discardQueue) discardQueueOnSignOut(userId)
  clearHouseholdLocalPrefs()
  bumpSessionEpoch('clearSessionLocalState')
  return { pendingDiscarded: pendingBefore }
}

export {
  countPendingForUser,
  discardQueueOnSignOut,
  countQuarantined,
  discardQuarantined,
  listQuarantined,
}
