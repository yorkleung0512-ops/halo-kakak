import assert from 'node:assert/strict'
import {
  CREATE_HH_STORAGE_KEY,
  getCreateHouseholdCooldownMs,
  markCreateHouseholdAttempt,
  requireInviteToCreateUser,
  shouldCreateUserOnMagicLink,
} from '../src/lib/registrationGate.js'

assert.equal(requireInviteToCreateUser({}), false)
assert.equal(requireInviteToCreateUser({ VITE_REQUIRE_INVITE: 'false' }), false)
assert.equal(requireInviteToCreateUser({ VITE_REQUIRE_INVITE: 'true' }), true)
assert.equal(requireInviteToCreateUser({ VITE_REQUIRE_INVITE: '1' }), true)
assert.equal(requireInviteToCreateUser({ VITE_REQUIRE_INVITE: true }), true)

assert.equal(shouldCreateUserOnMagicLink({ inviteOk: false, env: {} }), true)
assert.equal(
  shouldCreateUserOnMagicLink({
    inviteOk: false,
    env: { VITE_REQUIRE_INVITE: 'true' },
  }),
  false,
)
assert.equal(
  shouldCreateUserOnMagicLink({
    inviteOk: true,
    env: { VITE_REQUIRE_INVITE: 'true' },
  }),
  true,
)

const mem = new Map()
const storage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
}

assert.equal(getCreateHouseholdCooldownMs(1_000_000, storage), 0)
markCreateHouseholdAttempt(1_000_000, storage)
assert.equal(storage.getItem(CREATE_HH_STORAGE_KEY), '1000000')
assert.ok(getCreateHouseholdCooldownMs(1_000_000 + 10_000, storage) > 0)
assert.equal(getCreateHouseholdCooldownMs(1_000_000 + 60_000, storage), 0)

console.log('registration-gate-unit: all passed')
