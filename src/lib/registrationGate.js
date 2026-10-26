/**
 * Soft → harder registration / household-create gates.
 *
 * Default (production-safe): open magic-link signup remains available so
 * legitimate employers are not locked out.
 *
 * Harder opt-in: set VITE_REQUIRE_INVITE=true so new accounts can only be
 * created when a plausible invite token is present (helpers). Existing users
 * can still sign in without an invite.
 *
 * Creating a household (employer path) always requires the abuse-aware
 * confirmation flow in CreateHousehold; helpers should use invite instead.
 */

export function requireInviteToCreateUser(
  env = typeof import.meta !== 'undefined' ? import.meta.env : {},
) {
  const raw = env?.VITE_REQUIRE_INVITE
  if (raw === true || raw === 'true' || raw === '1') return true
  return false
}

/**
 * Whether OTP may create a brand-new auth user.
 * @param {{ inviteOk?: boolean, env?: Record<string, unknown> }} opts
 */
export function shouldCreateUserOnMagicLink({
  inviteOk = false,
  env = typeof import.meta !== 'undefined' ? import.meta.env : {},
} = {}) {
  if (!requireInviteToCreateUser(env)) return true
  return Boolean(inviteOk)
}

const CREATE_HH_COOLDOWN_MS = 60_000
const CREATE_HH_STORAGE_KEY = 'halo-kakak:create-hh-last'

/** Client-side cooldown between household create attempts (abuse-aware MVP). */
export function getCreateHouseholdCooldownMs(
  now = Date.now(),
  storage = typeof localStorage !== 'undefined' ? localStorage : null,
) {
  if (!storage) return 0
  try {
    const last = Number(storage.getItem(CREATE_HH_STORAGE_KEY) || 0)
    if (!last) return 0
    const left = CREATE_HH_COOLDOWN_MS - (now - last)
    return left > 0 ? left : 0
  } catch {
    return 0
  }
}

export function markCreateHouseholdAttempt(
  now = Date.now(),
  storage = typeof localStorage !== 'undefined' ? localStorage : null,
) {
  if (!storage) return
  try {
    storage.setItem(CREATE_HH_STORAGE_KEY, String(now))
  } catch {
    /* ignore quota / private mode */
  }
}

export { CREATE_HH_COOLDOWN_MS, CREATE_HH_STORAGE_KEY }
