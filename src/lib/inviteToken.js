/**
 * Invite tokens are 32-byte hex (64 chars) from create_household_invite.
 * Backend also rejects length < 16. Client soft-gate skips junk like ?invite=test.
 */
export function isPlausibleInviteToken(token) {
  if (typeof token !== 'string') return false
  const t = token.trim()
  if (t.length < 16) return false
  // Prefer exact production shape; still accept longer opaque tokens if ever rotated.
  if (/^[a-f0-9]{64}$/i.test(t)) return true
  return t.length >= 16 && t.length <= 128 && !/[\s/?#]/.test(t)
}

/** Pull invite token from a pasted URL or raw token string. */
export function parseInviteToken(raw) {
  const s = (raw || '').trim()
  if (!s) return ''
  try {
    if (s.includes('/invite/')) {
      const u = new URL(s, typeof window !== 'undefined' ? window.location.origin : 'http://local')
      const parts = u.pathname.split('/').filter(Boolean)
      const i = parts.indexOf('invite')
      if (i >= 0 && parts[i + 1]) return decodeURIComponent(parts[i + 1])
    }
  } catch {
    /* fall through */
  }
  const m = s.match(/invite\/([^/?#\s]+)/i)
  if (m) return decodeURIComponent(m[1])
  return s.replace(/^\/+/, '')
}
