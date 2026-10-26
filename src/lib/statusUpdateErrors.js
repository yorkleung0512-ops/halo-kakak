/**
 * Classify task status update failures so we only offline-queue real network issues.
 */

/**
 * @param {unknown} err
 * @param {boolean} [online]
 */
export function isLikelyOfflineError(
  err,
  online = typeof navigator !== 'undefined' ? navigator.onLine : true,
) {
  if (!online) return true
  const msg =
    err && typeof err === 'object'
      ? String(err.message || '')
      : String(err || '')
  if (msg === 'offline') return true
  if (
    /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(
      msg,
    )
  ) {
    return true
  }
  return false
}

/**
 * Supabase RPC raises exception 'version conflict' with errcode 40001.
 * @param {unknown} err
 */
export function isVersionConflictError(err) {
  if (!err || typeof err !== 'object') {
    return /version conflict/i.test(String(err || ''))
  }
  const code = err.code || err.errcode
  if (code === '40001') return true
  return /version conflict/i.test(String(err.message || ''))
}
