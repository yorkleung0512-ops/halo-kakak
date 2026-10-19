const QUEUE_KEY_V1 = 'halo-kakak-offline-queue-v1'
const QUEUE_KEY_V2 = 'halo-kakak-offline-queue-v2'

function migrateV1() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY_V1)
    if (!raw) return
    const legacy = JSON.parse(raw)
    if (!Array.isArray(legacy) || !legacy.length) {
      localStorage.removeItem(QUEUE_KEY_V1)
      return
    }
    const current = loadAll()
    const merged = [...current]
    for (const m of legacy) {
      if (!merged.some((x) => x.id === m.id)) merged.push(m)
    }
    localStorage.setItem(QUEUE_KEY_V2, JSON.stringify(merged))
    localStorage.removeItem(QUEUE_KEY_V1)
  } catch {
    /* ignore */
  }
}

function loadAll() {
  try {
    migrateV1()
    const raw = localStorage.getItem(QUEUE_KEY_V2)
    if (raw) return JSON.parse(raw)
    // fallback read v1 without migrate race
    const v1 = localStorage.getItem(QUEUE_KEY_V1)
    return v1 ? JSON.parse(v1) : []
  } catch {
    return []
  }
}

function saveAll(items) {
  localStorage.setItem(QUEUE_KEY_V2, JSON.stringify(items))
  try {
    localStorage.removeItem(QUEUE_KEY_V1)
  } catch {
    /* ignore */
  }
}

/**
 * @param {object} mutation
 * @param {{ userId?: string, householdId?: string }} [scope]
 */
export function enqueueMutation(mutation, scope = {}) {
  const q = loadAll()
  q.push({
    ...mutation,
    userId: scope.userId || mutation.userId || null,
    householdId:
      scope.householdId ||
      mutation.householdId ||
      mutation.payload?.household_id ||
      null,
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
  })
  saveAll(q)
  return q.length
}

/**
 * Peek queue, optionally scoped to user + household.
 * Unscoped items (legacy) are included when scope matches household on payload.
 */
export function peekQueue(scope = null) {
  const q = loadAll()
  if (!scope?.userId && !scope?.householdId) return q
  return q.filter((m) => {
    if (scope.userId && m.userId && m.userId !== scope.userId) return false
    const hh =
      m.householdId || m.payload?.household_id || null
    if (scope.householdId && hh && hh !== scope.householdId) return false
    // Legacy items without userId: include if household matches or unknown
    if (scope.userId && m.userId && m.userId !== scope.userId) return false
    return true
  })
}

export function clearQueueItem(id) {
  saveAll(loadAll().filter((m) => m.id !== id))
}

/**
 * Task ids with pending offline mutations (for UI badges).
 */
export function pendingTaskIds(scope = null) {
  const set = new Set()
  for (const m of peekQueue(scope)) {
    if (m.type === 'update_task' && m.payload?.id) set.add(m.payload.id)
  }
  return set
}

/**
 * Process offline mutations. handler(mutation) should throw on failure.
 * @param {(m: object) => Promise<void>} handler
 * @param {{ userId?: string, householdId?: string }} [scope] — if set, only flush matching
 */
export async function flushQueue(handler, scope = null) {
  const all = loadAll()
  const remaining = []
  let flushed = 0
  for (const m of all) {
    if (scope?.userId && m.userId && m.userId !== scope.userId) {
      remaining.push(m)
      continue
    }
    const hh = m.householdId || m.payload?.household_id || null
    if (scope?.householdId && hh && hh !== scope.householdId) {
      remaining.push(m)
      continue
    }
    try {
      await handler(m)
      flushed += 1
    } catch {
      remaining.push(m)
    }
  }
  saveAll(remaining)
  return { flushed, remaining: remaining.length }
}

export function loadQueue() {
  return loadAll()
}
