import assert from 'node:assert/strict'
import { shouldSkipDeepLinkReopen } from '../src/lib/taskDetailAccess.js'

/**
 * Pure simulation of Today deepHandled + hook closingDeepLinkRef + gen bump.
 * Mirrors src/pages/Today.jsx deep-link effect and
 * src/hooks/useTaskOccurrenceDetail.js closeDetail / openTaskById.
 *
 * Calendar / History do not use shouldSkipDeepLinkReopen; they rely on
 * closingDeepLinkRef inside openTaskById (same hook). That is enough for
 * the close race while ?task= is still present.
 */

function createCloseGuardMachine() {
  let deepTaskId = null
  let deepHandled = null
  let closingDeepLinkRef = null
  let gen = 0
  let detailTaskId = null
  const opens = []

  function syncUrlCleared() {
    // Product: when ?task= becomes null, deepHandled clears (Today effect)
    // and closingDeepLinkRef clears (hook effect).
    if (!deepTaskId) {
      deepHandled = null
      closingDeepLinkRef = null
    }
  }

  function setDeepTaskId(id) {
    deepTaskId = id
    syncUrlCleared()
  }

  function wouldSkipDeepLinkEffect() {
    return shouldSkipDeepLinkReopen(deepTaskId, deepHandled)
  }

  function tryDeepLinkOpen() {
    if (wouldSkipDeepLinkEffect()) {
      return { opened: false, reason: 'skip_handled' }
    }
    return tryOpenTaskById(deepTaskId, { force: false })
  }

  function tryOpenTaskById(id, { force = false } = {}) {
    if (
      !force &&
      id &&
      closingDeepLinkRef === id &&
      deepTaskId === id
    ) {
      return { opened: false, reason: 'closing' }
    }
    if (force) closingDeepLinkRef = null

    const myGen = ++gen
    // Simulate successful open completing at this gen.
    if (myGen !== gen) {
      return { opened: false, reason: 'stale' }
    }
    detailTaskId = id
    if (deepTaskId === id) deepHandled = id
    opens.push({ id, gen: myGen, force })
    return { opened: true, gen: myGen }
  }

  function closeDetail() {
    if (deepTaskId) closingDeepLinkRef = deepTaskId
    gen += 1 // bump so in-flight opens become stale
    detailTaskId = null
    // URL clear is async in the app; caller decides when setDeepTaskId(null).
  }

  /** In-flight open that started before close finishes after gen bump. */
  function applyStaleFetch(startedGen, id) {
    if (startedGen !== gen) {
      return { applied: false, reason: 'stale' }
    }
    detailTaskId = id
    return { applied: true }
  }

  return {
    get state() {
      return {
        deepTaskId,
        deepHandled,
        closingDeepLinkRef,
        gen,
        detailTaskId,
        opens: [...opens],
      }
    },
    setDeepTaskId,
    tryDeepLinkOpen,
    tryOpenTaskById,
    closeDetail,
    applyStaleFetch,
    wouldSkipDeepLinkEffect,
  }
}

const TASK_A = 'a1111111-1111-4111-8111-111111111101'
const TASK_B = 'a1111111-1111-4111-8111-111111111190'

// --- Helper pure cases ---
assert.equal(shouldSkipDeepLinkReopen(null, TASK_A), true)
assert.equal(shouldSkipDeepLinkReopen(TASK_A, null), false, 'initial deep link must NOT skip')
assert.equal(shouldSkipDeepLinkReopen(TASK_A, TASK_A), true)
assert.equal(shouldSkipDeepLinkReopen(TASK_A, TASK_B), false)

// 1) One close action does not reopen the same task
{
  const m = createCloseGuardMachine()
  m.setDeepTaskId(TASK_A)
  assert.equal(m.tryDeepLinkOpen().opened, true)
  assert.equal(m.state.deepHandled, TASK_A)
  assert.equal(m.state.detailTaskId, TASK_A)

  m.closeDetail()
  // URL still has ?task= (Router lag)
  assert.equal(m.state.closingDeepLinkRef, TASK_A)
  assert.equal(m.state.detailTaskId, null)

  // Today effect: shouldSkip because deepHandled === deepTaskId
  assert.equal(m.wouldSkipDeepLinkEffect(), true)
  assert.equal(m.tryDeepLinkOpen().opened, false)
  assert.equal(m.tryDeepLinkOpen().reason, 'skip_handled')

  // Hook path (Calendar/History): blocked by closingDeepLinkRef
  const blocked = m.tryOpenTaskById(TASK_A, { force: false })
  assert.equal(blocked.opened, false)
  assert.equal(blocked.reason, 'closing')
  assert.equal(m.state.detailTaskId, null)
}

// 2) Refresh after closing does not reopen (no deepTaskId → skip)
{
  const m = createCloseGuardMachine()
  m.setDeepTaskId(TASK_A)
  m.tryDeepLinkOpen()
  m.closeDetail()
  m.setDeepTaskId(null) // clearDeepLinkParams flushed; refresh lands on /
  assert.equal(m.state.deepHandled, null)
  assert.equal(m.state.closingDeepLinkRef, null)
  assert.equal(shouldSkipDeepLinkReopen(null, m.state.deepHandled), true)
  assert.equal(m.tryDeepLinkOpen().opened, false)
  assert.equal(m.state.detailTaskId, null)
}

// 3) User can intentionally reopen same task later (force / clear closing then open)
{
  const m = createCloseGuardMachine()
  m.setDeepTaskId(TASK_A)
  m.tryDeepLinkOpen()
  m.closeDetail()
  m.setDeepTaskId(null)

  // Intentional list/calendar row open uses force:true
  const again = m.tryOpenTaskById(TASK_A, { force: true })
  assert.equal(again.opened, true)
  assert.equal(m.state.detailTaskId, TASK_A)
  assert.equal(m.state.closingDeepLinkRef, null)

  // Or: navigate to ?task= again after close flushed (fresh deep link)
  const m2 = createCloseGuardMachine()
  m2.setDeepTaskId(TASK_A)
  m2.tryDeepLinkOpen()
  m2.closeDetail()
  m2.setDeepTaskId(null)
  m2.setDeepTaskId(TASK_A) // intentional navigation sets ?task= again
  assert.equal(m2.state.deepHandled, null, 'deepHandled cleared when URL lost ?task=')
  assert.equal(m2.tryDeepLinkOpen().opened, true)
}

// 4) A different task can open after closure
{
  const m = createCloseGuardMachine()
  m.setDeepTaskId(TASK_A)
  m.tryDeepLinkOpen()
  m.closeDetail()
  // Still lagging with TASK_A in URL — different id must not be blocked by closing ref
  const other = m.tryOpenTaskById(TASK_B, { force: false })
  assert.equal(other.opened, true)
  assert.equal(m.state.detailTaskId, TASK_B)

  // Or after URL cleared, deep link to B
  const m2 = createCloseGuardMachine()
  m2.setDeepTaskId(TASK_A)
  m2.tryDeepLinkOpen()
  m2.closeDetail()
  m2.setDeepTaskId(null)
  m2.setDeepTaskId(TASK_B)
  assert.equal(m2.tryDeepLinkOpen().opened, true)
  assert.equal(m2.state.detailTaskId, TASK_B)
}

// 5) Browser back/forward — document intended product behaviour:
// When deepTaskId becomes null, deepHandled clears. When the same id returns
// via history back (?task= restored), that is intentional navigation and
// SHOULD open again (deepHandled is null so shouldSkip is false).
{
  const m = createCloseGuardMachine()
  m.setDeepTaskId(TASK_A)
  assert.equal(m.tryDeepLinkOpen().opened, true)
  m.closeDetail()
  m.setDeepTaskId(null) // replace: clear params
  assert.equal(m.state.deepHandled, null)

  // History back restores ?task=TASK_A
  m.setDeepTaskId(TASK_A)
  assert.equal(m.wouldSkipDeepLinkEffect(), false)
  assert.equal(m.tryDeepLinkOpen().opened, true)
  assert.equal(m.state.detailTaskId, TASK_A)
}

// 6) An old fetch response cannot reopen a closed task (gen bump / stale)
{
  const m = createCloseGuardMachine()
  m.setDeepTaskId(TASK_A)
  const started = m.tryDeepLinkOpen()
  assert.equal(started.opened, true)
  const startedGen = started.gen

  m.closeDetail() // gen bumped
  assert.equal(m.state.gen, startedGen + 1)
  const stale = m.applyStaleFetch(startedGen, TASK_A)
  assert.equal(stale.applied, false)
  assert.equal(stale.reason, 'stale')
  assert.equal(m.state.detailTaskId, null)

  // Even if Today effect re-fires while URL lags, skip + closing block open
  assert.equal(m.tryDeepLinkOpen().opened, false)
  assert.equal(m.tryOpenTaskById(TASK_A).reason, 'closing')
}

// 7) Initial deep-link loading still works (deepHandled null → does NOT skip)
{
  const m = createCloseGuardMachine()
  m.setDeepTaskId(TASK_A)
  assert.equal(m.state.deepHandled, null)
  assert.equal(m.wouldSkipDeepLinkEffect(), false)
  assert.equal(m.tryDeepLinkOpen().opened, true)
  assert.equal(m.state.deepHandled, TASK_A)
}

console.log('a8-close-guard-unit: PASS')
