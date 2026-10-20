/**
 * Phase 1 isolation regression — AUTOMATED SIMULATIONS ONLY.
 * No network. No Supabase. Not browser tests.
 */
import assert from 'node:assert/strict'
import {
  bumpSessionEpoch,
  getSessionEpoch,
  captureEpoch,
  subscribeSessionEpoch,
} from '../src/lib/sessionEpoch.js'
import {
  enqueueMutation,
  peekQueue,
  flushQueue,
  clearEntireQueue,
  countPendingForUser,
  countQuarantined,
  discardQuarantined,
  discardQueueOnSignOut,
  listQuarantined,
  pendingTaskIds,
  isTrustedScope,
  isQuarantined,
} from '../src/lib/offlineQueue.js'

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
}

function simulateLoader() {
  let gen = 0
  let userId = null
  let householdId = null
  let items = []
  return {
    get items() {
      return items
    },
    setSession(uid, hh) {
      userId = uid
      householdId = hh
      gen += 1
      items = []
      return gen
    },
    clear() {
      gen += 1
      items = []
      return gen
    },
    async refresh(fetchFn) {
      const myGen = ++gen
      const expectedUser = userId
      const expectedHh = householdId
      const snap = captureEpoch()
      const rows = await fetchFn()
      if (myGen !== gen) return { applied: false, reason: 'gen' }
      if (userId !== expectedUser) return { applied: false, reason: 'user' }
      if (householdId !== expectedHh) return { applied: false, reason: 'hh' }
      if (!snap.isCurrent()) return { applied: false, reason: 'epoch' }
      items = rows
      return { applied: true }
    },
  }
}

let passed = 0
function ok(name) {
  passed += 1
  console.log(`  PASS ${name}`)
}

console.log('phase1-isolation-unit (automated simulations, no network)')

// --- Epoch basics ---
{
  const a = getSessionEpoch()
  const b = bumpSessionEpoch('test')
  assert.equal(b, a + 1)
  assert.equal(getSessionEpoch(), b)
  ok('epoch bumps monotonically')
}

// 1) Old notifications response arrives after logout → ignored
{
  const loader = simulateLoader()
  loader.setSession('user-a', 'hh-a')
  let resolveFetch
  const pending = new Promise((r) => {
    resolveFetch = r
  })
  const p = loader.refresh(() => pending)
  // logout
  bumpSessionEpoch('logout')
  loader.clear()
  resolveFetch([{ id: 'n1', title: 'SECRET_A' }])
  const res = await p
  assert.equal(res.applied, false)
  assert.deepEqual(loader.items, [])
  ok('stale notifications after logout ignored')
}

// 2) Old response arrives after another user signs in → ignored
{
  const loader = simulateLoader()
  loader.setSession('user-a', 'hh-a')
  let resolveFetch
  const pending = new Promise((r) => {
    resolveFetch = r
  })
  const p = loader.refresh(() => pending)
  loader.setSession('user-b', 'hh-b')
  bumpSessionEpoch('user_switch')
  resolveFetch([{ id: 'n-a', body: 'from-a' }])
  const res = await p
  assert.equal(res.applied, false)
  assert.deepEqual(loader.items, [])
  ok('stale response after user switch ignored')
}

// 3) Household switch while request pending → ignored
{
  const loader = simulateLoader()
  loader.setSession('user-a', 'hh-a')
  let resolveFetch
  const pending = new Promise((r) => {
    resolveFetch = r
  })
  const p = loader.refresh(() => pending)
  loader.setSession('user-a', 'hh-b')
  bumpSessionEpoch('household_switch')
  resolveFetch([{ id: 't-a' }])
  const res = await p
  assert.equal(res.applied, false)
  assert.deepEqual(loader.items, [])
  ok('stale response after household switch ignored')
}

// 4) Calendar/History cleared; stale cannot repopulate
{
  const cal = simulateLoader()
  cal.setSession('user-a', 'hh-a')
  await cal.refresh(async () => [{ id: 'c1' }])
  assert.equal(cal.items.length, 1)
  let resolveFetch
  const pending = new Promise((r) => {
    resolveFetch = r
  })
  const p = cal.refresh(() => pending)
  // simulate sign-out via epoch + clear
  bumpSessionEpoch('SIGNED_OUT')
  cal.clear()
  resolveFetch([{ id: 'LEAK' }])
  const res = await p
  assert.equal(res.applied, false)
  assert.deepEqual(cal.items, [])
  ok('calendar/history stale cannot repopulate after clear')
}

// Subscribe fires on bump
{
  let seen = 0
  const unsub = subscribeSessionEpoch(() => {
    seen += 1
  })
  bumpSessionEpoch('sub-test')
  assert.equal(seen, 1)
  unsub()
  bumpSessionEpoch('sub-test-2')
  assert.equal(seen, 1)
  ok('epoch subscribe/unsubscribe')
}

clearEntireQueue()

// 5) Legacy queue without ownership is blocked
{
  enqueueMutation({
    type: 'update_task',
    payload: { id: 'legacy', version: 1, patch: { status: 'completed' }, household_id: 'hh-a' },
  })
  assert.equal(countQuarantined(), 1)
  assert.equal(isQuarantined(listQuarantined()[0]), true)
  assert.equal(peekQueue({ userId: 'user-a', householdId: 'hh-a' }).length, 0)
  let ran = 0
  const result = await flushQueue(async () => {
    ran += 1
  }, { userId: 'user-a', householdId: 'hh-a' })
  assert.equal(ran, 0)
  assert.equal(result.skippedQuarantined, 1)
  assert.equal(countQuarantined(), 1)
  // Do not expose sensitive payload via pendingTaskIds
  assert.equal(pendingTaskIds({ userId: 'user-a', householdId: 'hh-a' }).size, 0)
  ok('legacy queue blocked from flush/peek/pendingTaskIds')
}

clearEntireQueue()

// 6) User A queue cannot execute as User B
{
  enqueueMutation(
    { type: 'update_task', payload: { id: 't-a', version: 1, patch: {} } },
    { userId: 'user-a', householdId: 'hh-a' },
  )
  let ran = []
  await flushQueue(async (m) => {
    ran.push(m.userId)
  }, { userId: 'user-b', householdId: 'hh-a' })
  assert.deepEqual(ran, [])
  assert.equal(peekQueue({ userId: 'user-a', householdId: 'hh-a' }).length, 1)
  ok('user A queue cannot flush as user B')
}

clearEntireQueue()

// 7 + 8) Removed / failed membership blocks replay (mock gate before flush)
{
  enqueueMutation(
    { type: 'update_task', payload: { id: 't1', version: 1, patch: {} } },
    { userId: 'user-a', householdId: 'hh-a' },
  )

  async function flushWithMembershipCheck(membershipResult) {
    if (!membershipResult?.ok) {
      return { flushed: 0, blocked: true, reason: membershipResult?.reason }
    }
    return flushQueue(async () => {}, {
      userId: 'user-a',
      householdId: 'hh-a',
    })
  }

  const removed = await flushWithMembershipCheck({
    ok: false,
    reason: 'not_active_member',
  })
  assert.equal(removed.blocked, true)
  assert.equal(peekQueue({ userId: 'user-a', householdId: 'hh-a' }).length, 1)

  const failed = await flushWithMembershipCheck({
    ok: false,
    reason: 'membership_query_failed',
  })
  assert.equal(failed.blocked, true)
  assert.equal(peekQueue({ userId: 'user-a', householdId: 'hh-a' }).length, 1)

  const okMem = await flushWithMembershipCheck({ ok: true })
  assert.equal(okMem.flushed, 1)
  assert.equal(peekQueue({ userId: 'user-a', householdId: 'hh-a' }).length, 0)
  ok('removed/failed membership blocks replay; ok membership allows')
}

clearEntireQueue()

// 9) Properly scoped authorized retries remain deduplicated by id identity
{
  enqueueMutation(
    { type: 'update_task', payload: { id: 't-dup', version: 1, patch: { a: 1 } } },
    { userId: 'user-a', householdId: 'hh-a' },
  )
  enqueueMutation(
    { type: 'update_task', payload: { id: 't-dup', version: 1, patch: { a: 2 } } },
    { userId: 'user-a', householdId: 'hh-a' },
  )
  const q = peekQueue({ userId: 'user-a', householdId: 'hh-a' })
  assert.equal(q.length, 2)
  const ids = new Set(q.map((m) => m.id))
  assert.equal(ids.size, 2) // distinct queue ids (existing enqueue behavior)
  let calls = 0
  await flushQueue(async () => {
    calls += 1
  }, { userId: 'user-a', householdId: 'hh-a' })
  assert.equal(calls, 2)
  assert.equal(peekQueue({ userId: 'user-a', householdId: 'hh-a' }).length, 0)
  ok('scoped retries keep distinct ids; both flush once each')
}

// payload.household_id alone is NOT trusted ownership
{
  clearEntireQueue()
  // Simulate corrupted stamp: only payload hh
  const raw = [
    {
      type: 'update_task',
      payload: { id: 'x', household_id: 'hh-a', version: 1, patch: {} },
      userId: null,
      householdId: null,
      id: 'm_bad',
      queuedAt: new Date().toISOString(),
    },
  ]
  localStorage.setItem('halo-kakak-offline-queue-v2', JSON.stringify(raw))
  assert.equal(isTrustedScope(raw[0]), false)
  assert.equal(countQuarantined(), 1)
  let ran = 0
  await flushQueue(async () => {
    ran += 1
  }, { userId: 'anyone', householdId: 'hh-a' })
  assert.equal(ran, 0)
  discardQuarantined()
  ok('payload.household_id alone is not ownership trust')
}

// discardQueueOnSignOut keeps quarantined; does not replay under next user
{
  clearEntireQueue()
  enqueueMutation(
    { type: 'update_task', payload: { id: 'ta', version: 1, patch: {} } },
    { userId: 'user-a', householdId: 'hh-a' },
  )
  enqueueMutation({
    type: 'update_task',
    payload: { id: 'legacy', version: 1, patch: { secret: 'no-leak' } },
  })
  discardQueueOnSignOut('user-a')
  assert.equal(countPendingForUser('user-b'), 0)
  assert.equal(countQuarantined(), 1)
  let ran = 0
  await flushQueue(async () => {
    ran += 1
  }, { userId: 'user-b', householdId: 'hh-b' })
  assert.equal(ran, 0)
  // Explicit discard only
  assert.equal(discardQuarantined(), 1)
  ok('sign-out keeps quarantined; next user cannot flush it')
}

clearEntireQueue()
console.log(`phase1-isolation-unit: PASS (${passed} checks)`)
