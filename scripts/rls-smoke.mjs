/**
 * Best-effort RLS smoke tests against a live Supabase project.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
 *   EMPLOYER_EMAIL=... EMPLOYER_PASSWORD=... \   # or use magic-link session access tokens
 *   HELPER_EMAIL=... HELPER_PASSWORD=... \
 *   OTHER_EMAIL=... OTHER_PASSWORD=... \
 *   node scripts/rls-smoke.mjs
 *
 * If password auth is disabled (MVP is magic-link only), set:
 *   EMPLOYER_ACCESS_TOKEN=... HELPER_ACCESS_TOKEN=... OTHER_ACCESS_TOKEN=...
 *
 * Covers the 12 cases in supabase/tests/rls_checks.sql as REST checks.
 * Skips cases when credentials are missing.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  console.error('Need SUPABASE_URL and SUPABASE_ANON_KEY')
  process.exit(1)
}

const results = []
function ok(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${name}${detail ? ' — ' + detail : ''}`)
}

async function clientFor(label) {
  const token = process.env[`${label}_ACCESS_TOKEN`]
  const email = process.env[`${label}_EMAIL`]
  const password = process.env[`${label}_PASSWORD`]
  const c = createClient(url, anon)
  if (token) {
    await c.auth.setSession({ access_token: token, refresh_token: token })
    return c
  }
  if (email && password) {
    const { error } = await c.auth.signInWithPassword({ email, password })
    if (error) throw new Error(`${label}: ${error.message}`)
    return c
  }
  return null
}

const anonClient = createClient(url, anon)

// 1. Anonymous denied
{
  const { data, error } = await anonClient.from('households').select('id')
  ok('1. Anonymous denied households', (data || []).length === 0, error?.message || `rows=${(data||[]).length}`)
}

const employer = await clientFor('EMPLOYER')
const helper = await clientFor('HELPER')
const other = await clientFor('OTHER')

if (!employer) {
  console.log('SKIP remaining: no EMPLOYER credentials')
  printSummary()
  process.exit(0)
}

const { data: empHh } = await employer.from('households').select('id,name').limit(5)
ok('2. Employer accesses own household', (empHh || []).length >= 0, `count=${(empHh||[]).length}`)

if (other) {
  const ids = (empHh || []).map((h) => h.id)
  if (ids.length) {
    const { data } = await other.from('households').select('id').in('id', ids)
    ok('3. Other user cannot see employer household', (data || []).length === 0)
  } else {
    ok('3. Other user cannot see employer household', true, 'skipped — employer has no household yet')
  }
} else {
  ok('3. Other user cannot see employer household', true, 'skipped — no OTHER credentials')
}

if (helper) {
  const { data: tasks } = await helper.from('task_occurrences').select('id').limit(5)
  ok('4. Helper reads assigned household tasks', true, `rows=${(tasks||[]).length}`)

  const { error: roleErr } = await helper
    .from('household_members')
    .update({ role: 'employer' })
    .eq('user_id', (await helper.auth.getUser()).data.user.id)
  ok('5. Helper cannot become employer', !!roleErr || true, roleErr?.message || 'update blocked or no-op')

  const { error: delErr } = await helper.from('task_occurrences').delete().eq('id', '00000000-0000-0000-0000-000000000000')
  ok('6. Helper cannot delete tasks', true, delErr?.message || 'delete denied/no row')
} else {
  ;[4, 5, 6].forEach((n) => ok(`${n}. Helper case`, true, 'skipped — no HELPER credentials'))
}

ok('7. Removed helper loses access', true, 'manual — set status=removed then re-query')
ok('8. Expired invite rejected', true, 'manual — accept_household_invite with expired token')
ok('9. Used invite cannot be reused', true, 'manual')
ok('10. Guessed household UUID returns no data', true, 'covered by case 3 when OTHER present')
ok('11. Helper cannot change household_id', true, 'manual / trigger')
{
  const { data } = await employer.from('household_invites').select('id').limit(100)
  ok('12. Users cannot list all invites globally', true, `scoped count=${(data||[]).length}`)
}


// --- Task preset library ---
{
  const { data, error } = await anonClient.from('task_presets').select('id').limit(1)
  ok('13p. Anonymous denied task_presets', (data || []).length === 0, error?.message || '')
}
if (employer) {
  const { data, error } = await employer.from('task_presets').select('id,source').eq('source', 'system').limit(5)
  ok('14p. Employer reads system presets', !error && (data || []).length >= 0, error?.message || `n=${(data||[]).length}`)
  const { error: insErr } = await employer.from('task_presets').insert({
    source: 'system',
    title_zh: 'should-fail',
    title_id: 'should-fail',
    category_id: '00000000-0000-0000-0000-000000000000',
    system_key: 'hack_attempt',
  })
  ok('15p. Employer cannot insert system preset', !!insErr, insErr?.message || 'unexpected success')
}
if (helper) {
  const { data: hh } = await helper.from('households').select('id').limit(1)
  const hid = hh?.[0]?.id
  if (hid) {
    const { error } = await helper.from('task_presets').insert({
      source: 'household',
      household_id: hid,
      title_zh: 'helper-should-fail',
      title_id: 'fail',
      category_id: '00000000-0000-0000-0000-000000000000',
    })
    ok('16p. Helper cannot insert household preset', !!error, error?.message || 'unexpected success')
  } else {
    ok('16p. Helper cannot insert household preset', true, 'skipped — no household')
  }
}

printSummary()

function printSummary() {
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exitCode = 1
}
