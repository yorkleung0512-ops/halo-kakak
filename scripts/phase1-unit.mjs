import assert from 'node:assert/strict'
import {
  isTaskOccurrenceId,
  resolveDeepLinkTask,
  clearDeepLinkParams,
  sanitizeInternalPath,
} from '../src/lib/taskDetailAccess.js'
import {
  enqueueMutation,
  peekQueue,
  discardQueueOnSignOut,
  countPendingForUser,
  clearEntireQueue,
  flushQueue,
  listQuarantined,
  countQuarantined,
  discardQuarantined,
  isTrustedScope,
} from '../src/lib/offlineQueue.js'

// mock localStorage for node
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
}

// UUID validation
assert.equal(
  isTaskOccurrenceId('550e8400-e29b-41d4-a716-446655440000'),
  true,
)
assert.equal(isTaskOccurrenceId('not-a-uuid'), false)
assert.equal(isTaskOccurrenceId(''), false)
assert.equal(isTaskOccurrenceId(null), false)

// Other-household must not open / switch
{
  const task = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    household_id: 'hh-b',
  }
  const r = resolveDeepLinkTask(task, 'hh-a')
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'other_household')
}
{
  const task = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    household_id: 'hh-a',
  }
  const r = resolveDeepLinkTask(task, 'hh-a')
  assert.equal(r.ok, true)
}
assert.equal(resolveDeepLinkTask(null, 'hh-a').ok, false)

// Clear params — closed detail must not reopen on refresh
{
  const next = clearDeepLinkParams('task=abc&n=notif&comment=c1&foo=1')
  assert.equal(next.get('task'), null)
  assert.equal(next.get('n'), null)
  assert.equal(next.get('comment'), null)
  assert.equal(next.get('foo'), '1')
}

// Path sanitization (open redirect guard)
assert.equal(sanitizeInternalPath('/?task=x'), '/?task=x')
assert.equal(sanitizeInternalPath('https://evil.example'), '/')
assert.equal(sanitizeInternalPath('//evil.example'), '/')
assert.equal(sanitizeInternalPath('/calendar?task=1'), '/calendar?task=1')

clearEntireQueue()
enqueueMutation(
  { type: 'update_task', payload: { id: 't1', version: 1, patch: {} } },
  { userId: 'user-a', householdId: 'hh-a' },
)
enqueueMutation(
  { type: 'update_task', payload: { id: 't2', version: 1, patch: {} } },
  { userId: 'user-b', householdId: 'hh-b' },
)
// legacy unscoped — quarantined, never flushable / peekable for replay
enqueueMutation({
  type: 'update_task',
  payload: { id: 't3', version: 1, patch: {}, household_id: 'hh-b' },
})

assert.equal(isTrustedScope(peekQueue({ userId: 'user-a', householdId: 'hh-a' })[0]), true)
assert.equal(countPendingForUser('user-a'), 1) // trusted owned only
assert.equal(countQuarantined(), 1)
assert.equal(peekQueue({ userId: 'user-b', householdId: 'hh-b' }).length, 1)
assert.equal(listQuarantined().length, 1)

const dropped = discardQueueOnSignOut('user-a')
assert.equal(dropped, 1) // only user-a's trusted item
assert.equal(peekQueue({ userId: 'user-b', householdId: 'hh-b' }).length, 1)
assert.equal(countQuarantined(), 1) // legacy kept until explicit discard
assert.equal(countPendingForUser('user-a'), 0)

let ran = []
await flushQueue(async (m) => {
  ran.push(m.userId)
}, { userId: 'user-b', householdId: 'hh-b' })
assert.deepEqual(ran, ['user-b'])
assert.equal(countQuarantined(), 1) // still quarantined after flush
assert.equal(discardQuarantined(), 1)
assert.equal(countQuarantined(), 0)
assert.equal(peekQueue().length, 0)

clearEntireQueue()
console.log('phase1-unit: PASS')
