const QUEUE_KEY = 'halo-kakak-offline-queue-v1'

export function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveQueue(items) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
}

export function enqueueMutation(mutation) {
  const q = loadQueue()
  q.push({ ...mutation, id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, queuedAt: new Date().toISOString() })
  saveQueue(q)
  return q.length
}

export function peekQueue() {
  return loadQueue()
}

export function clearQueueItem(id) {
  saveQueue(loadQueue().filter((m) => m.id !== id))
}

/**
 * Process offline mutations. handler(mutation) should throw on failure.
 */
export async function flushQueue(handler) {
  const q = loadQueue()
  const remaining = []
  for (const m of q) {
    try {
      await handler(m)
    } catch {
      remaining.push(m)
    }
  }
  saveQueue(remaining)
  return { flushed: q.length - remaining.length, remaining: remaining.length }
}
