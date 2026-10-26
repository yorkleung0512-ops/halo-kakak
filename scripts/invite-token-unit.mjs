import assert from 'node:assert/strict'
import {
  isPlausibleInviteToken,
  parseInviteToken,
} from '../src/lib/inviteToken.js'

const realish = 'a'.repeat(64)
assert.equal(isPlausibleInviteToken(realish), true)
assert.equal(isPlausibleInviteToken('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'), true)

assert.equal(isPlausibleInviteToken('test'), false)
assert.equal(isPlausibleInviteToken(''), false)
assert.equal(isPlausibleInviteToken(null), false)
assert.equal(isPlausibleInviteToken('short'), false)
assert.equal(isPlausibleInviteToken('a'.repeat(15)), false)
assert.equal(isPlausibleInviteToken('ok-token-16chars'), true)

assert.equal(
  parseInviteToken('https://halo-kakak.pages.dev/invite/abc123def4567890'),
  'abc123def4567890',
)
assert.equal(parseInviteToken('/invite/tokentoken12345'), 'tokentoken12345')
assert.equal(parseInviteToken('  rawtokenrawtoken  '), 'rawtokenrawtoken')

console.log('invite-token-unit: all passed')
