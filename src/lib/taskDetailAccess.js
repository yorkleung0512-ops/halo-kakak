const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isTaskOccurrenceId(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim())
}

/**
 * Fetch one occurrence by id via RLS. Unauthorized / missing / deleted
 * all look the same to the client (null) — no existence leak.
 * @param {string} id
 * @returns {Promise<{ task: object|null, error: Error|null }>}
 */
export async function fetchTaskOccurrenceById(id) {
  if (!isTaskOccurrenceId(id)) {
    return { task: null, error: null }
  }
  const { supabase } = await import('./supabase.js')
  const { data, error } = await supabase
    .from('task_occurrences')
    .select('*')
    .eq('id', id.trim())
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return { task: null, error }
  return { task: data || null, error: null }
}

/**
 * Resolve a deep-linked occurrence for the active household.
 * Does NOT switch household when the row belongs elsewhere.
 */
export function resolveDeepLinkTask(task, activeHouseholdId) {
  if (!task) return { ok: false, reason: 'unavailable' }
  if (
    activeHouseholdId &&
    task.household_id &&
    task.household_id !== activeHouseholdId
  ) {
    return { ok: false, reason: 'other_household' }
  }
  return { ok: true, task }
}

/** Keys used for task deep links in the URL. */
export const DEEP_LINK_PARAM_KEYS = ['task', 'n', 'comment']

/**
 * Remove task / notification / comment query params (pure).
 * @param {URLSearchParams|string} params
 * @returns {URLSearchParams}
 */
export function clearDeepLinkParams(params) {
  const next = new URLSearchParams(
    typeof params === 'string' ? params : params?.toString?.() || '',
  )
  for (const key of DEEP_LINK_PARAM_KEYS) next.delete(key)
  return next
}

/**
 * Today deep-link effect: once deepTaskId was handled, do not call open
 * again while the same query param is still present. closeDetail() clears
 * detailTask before React Router may have flushed the cleared search
 * params; requiring detailTask to still match caused a reopen race (A8).
 * @param {string|null|undefined} deepTaskId
 * @param {string|null|undefined} deepHandledId
 * @returns {boolean}
 */
export function shouldSkipDeepLinkReopen(deepTaskId, deepHandledId) {
  if (!deepTaskId) return true
  return deepHandledId === deepTaskId
}

export const PENDING_DEEP_LINK_KEY = 'halo-kakak-pending-deep-link'

export function storePendingDeepLink(pathWithSearch) {
  try {
    if (!pathWithSearch || pathWithSearch === '/') {
      sessionStorage.removeItem(PENDING_DEEP_LINK_KEY)
      return
    }
    sessionStorage.setItem(PENDING_DEEP_LINK_KEY, pathWithSearch)
  } catch {
    /* ignore */
  }
}

export function consumePendingDeepLink() {
  try {
    const v = sessionStorage.getItem(PENDING_DEEP_LINK_KEY)
    sessionStorage.removeItem(PENDING_DEEP_LINK_KEY)
    return v || null
  } catch {
    return null
  }
}

/**
 * Build a safe in-app path after auth (must start with /).
 */
export function sanitizeInternalPath(path) {
  if (!path || typeof path !== 'string') return '/'
  const trimmed = path.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/'
  return trimmed
}
