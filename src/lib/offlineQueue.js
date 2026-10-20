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
 * Ownership trust requires BOTH non-empty userId and householdId stamps
 * on the queue entry itself. payload.household_id alone is NOT enough.
 */
export function isTrustedScope(m) {
  return !!(
    m &&
    typeof m.userId === 'string' &&
    m.userId.length > 0 &&
    typeof m.householdId === 'string' &&
    m.householdId.length > 0
  )
}

export function isQuarantined(m) {
  return !isTrustedScope(m)
}

/**
 * @param {object} mutation
 * @param {{ userId?: string, householdId?: string }} [scope]
 */
export function enqueueMutation(mutation, scope = {}) {
  const userId = scope.userId || mutation.userId || null
  // Prefer explicit scope / stamp; do not treat payload.household_id as ownership trust.
  const householdId = scope.householdId || mutation.householdId || null
  const q = loadAll()
  q.push({
    ...mutation,
    userId,
    householdId,
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
  })
  saveAll(q)
  return q.length
}

/**
 * Peek flushable queue items for a scope.
 * Only trusted entries that match userId + householdId are returned.
 * Quarantined (legacy / incomplete ownership) are never included.
 */
export function peekQueue(scope = null) {
  const q = loadAll().filter(isTrustedScope)
  if (!scope?.userId && !scope?.householdId) return q
  return q.filter((m) => {
    if (scope.userId && m.userId !== scope.userId) return false
    if (scope.householdId && m.householdId !== scope.householdId) return false
    return true
  })
}

/**
 * Quarantined entries (missing trustworthy userId and/or householdId).
 * Do not render sensitive payload contents from these in UI badges.
 */
export function listQuarantined() {
  return loadAll().filter(isQuarantined)
}

export function countQuarantined() {
  return listQuarantined().length
}

/**
 * Explicit discard of quarantined legacy items. Never called by flush.
 */
export function discardQuarantined() {
  const all = loadAll()
  const kept = all.filter(isTrustedScope)
  const removed = all.length - kept.length
  saveAll(kept)
  return removed
}

export function clearQueueItem(id) {
  saveAll(loadAll().filter((m) => m.id !== id))
}

/**
 * Task ids with pending offline mutations (trusted scoped only).
 */
export function pendingTaskIds(scope = null) {
  const set = new Set()
  for (const m of peekQueue(scope)) {
    if (m.type === 'update_task' && m.payload?.id) set.add(m.payload.id)
  }
  return set
}

/**
 * Process offline mutations. Quarantined items are never passed to handler;
 * they remain in storage until explicit discardQuarantined().
 * @param {(m: object) => Promise<void>} handler
 * @param {{ userId?: string, householdId?: string }} [scope]
 */
export async function flushQueue(handler, scope = null) {
  const all = loadAll()
  const remaining = []
  let flushed = 0
  let skippedQuarantined = 0
  for (const m of all) {
    if (!isTrustedScope(m)) {
      remaining.push(m)
      skippedQuarantined += 1
      continue
    }
    if (scope?.userId && m.userId !== scope.userId) {
      remaining.push(m)
      continue
    }
    if (scope?.householdId && m.householdId !== scope.householdId) {
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
  return { flushed, remaining: remaining.length, skippedQuarantined }
}

export function loadQueue() {
  return loadAll()
}

/**
 * Count trusted items owned by this user (flushable for them).
 * Quarantined legacy is NOT counted as flushable for any user.
 */
export function countPendingForUser(userId) {
  const all = loadAll()
  if (!userId) return all.filter(isTrustedScope).length
  return all.filter((m) => isTrustedScope(m) && m.userId === userId).length
}

/**
 * On sign-out: drop this user's trusted items.
 * Quarantined legacy remains until explicit discard (do not silently discard
 * pending work) but cannot replay under another account (flush skips them).
 */
export function discardQueueOnSignOut(userId) {
  const all = loadAll()
  if (!userId) {
    // Keep quarantined; drop all trusted (no owner to attribute).
    const kept = all.filter(isQuarantined)
    saveAll(kept)
    return all.length - kept.length
  }
  const kept = all.filter(
    (m) => isQuarantined(m) || (isTrustedScope(m) && m.userId !== userId),
  )
  saveAll(kept)
  return all.length - kept.length
}

/**
 * Drop every queue item (tests / hard reset).
 */
export function clearEntireQueue() {
  saveAll([])
}
