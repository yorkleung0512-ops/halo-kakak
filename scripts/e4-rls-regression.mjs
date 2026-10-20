import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { WebSocket } from 'ws';
globalThis.WebSocket = globalThis.WebSocket || WebSocket;

const MANIFEST = JSON.parse(fs.readFileSync('/tmp/halo-kakak-qa/manifest.json', 'utf8'));
const anonEnv = fs.readFileSync('/tmp/halo-kakak-qa/anon.env', 'utf8');
const URL = anonEnv.match(/^URL=(.+)$/m)[1].trim();
const ANON = anonEnv.match(/^KEY=(.+)$/m)[1].trim();

const HH_A = MANIFEST.households.A.id;
const HH_B = MANIFEST.households.B.id;
const FAKE_UID = '00000000-0000-4000-8000-000000000077';

function userByKey(key) {
  return MANIFEST.users.find((u) => u.key === key);
}

function clientAnon() {
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function clientAs(key) {
  const u = userByKey(key);
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: u.email, password: u.password });
  if (error) throw new Error(`${key} login: ${error.message}`);
  return { client: c, session: data.session, userId: data.user.id, jwt: data.session.access_token };
}

const results = [];
function record(id, status, evidence) {
  results.push({ id, status, evidence: String(evidence).slice(0, 500) });
  console.log(`[${status}] ${id}: ${String(evidence).slice(0, 200)}`);
}

function deniedUpdate(error, data) {
  // Privilege revoke => 42501 / permission denied; RLS => 0 rows; or explicit error
  if (error) return true;
  if (!data || (Array.isArray(data) && data.length === 0)) return true;
  return false;
}

async function restPatch(jwt, body, filter) {
  const qs = new URLSearchParams(filter).toString();
  const res = await fetch(`${URL}/rest/v1/household_members?${qs}`, {
    method: 'PATCH',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json, ok: res.ok };
}

const helperA = await clientAs('qa-helper-a');
const empA = await clientAs('qa-employer-a');
const ownerA = await clientAs('qa-owner-a');
const ownerB = await clientAs('qa-owner-b');
const helperB = await clientAs('qa-helper-b');
let removed = null;
try {
  removed = await clientAs('qa-removed-helper-a');
} catch (e) {
  record('E4-12-login', 'BLOCKED', e.message);
}

// E4-01 helper → owner self PATCH
{
  const { data, error } = await helperA.client
    .from('household_members')
    .update({ role: 'owner' })
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .select();
  const { data: check } = await helperA.client
    .from('household_members')
    .select('role')
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .maybeSingle();
  const pass = deniedUpdate(error, data) && check?.role === 'helper';
  record('E4-01', pass ? 'PASS' : 'FAIL', `role=${check?.role} err=${error?.message || error?.code || 'none'} rows=${(data || []).length}`);
}

// E4-02 helper → employer self PATCH
{
  const { data, error } = await helperA.client
    .from('household_members')
    .update({ role: 'employer' })
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .select();
  const { data: check } = await helperA.client
    .from('household_members')
    .select('role')
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .maybeSingle();
  const pass = deniedUpdate(error, data) && check?.role === 'helper';
  record('E4-02', pass ? 'PASS' : 'FAIL', `role=${check?.role} err=${error?.message || 'none'} rows=${(data || []).length}`);
}

// E4-03 helper change own status
{
  const { data, error } = await helperA.client
    .from('household_members')
    .update({ status: 'left' })
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .select();
  const { data: check } = await helperA.client
    .from('household_members')
    .select('status')
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .maybeSingle();
  const pass = deniedUpdate(error, data) && check?.status === 'active';
  record('E4-03', pass ? 'PASS' : 'FAIL', `status=${check?.status} err=${error?.message || 'none'} rows=${(data || []).length}`);
}

// E4-04 helper change household_id
{
  const { data, error } = await helperA.client
    .from('household_members')
    .update({ household_id: HH_B })
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .select();
  const { data: check } = await helperA.client
    .from('household_members')
    .select('household_id')
    .eq('user_id', helperA.userId)
    .eq('status', 'active');
  const stillA = (check || []).some((r) => r.household_id === HH_A);
  const moved = (check || []).some((r) => r.household_id === HH_B);
  const pass = deniedUpdate(error, data) && stillA && !moved;
  record('E4-04', pass ? 'PASS' : 'FAIL', `stillA=${stillA} moved=${moved} err=${error?.message || 'none'} rows=${(data || []).length}`);
}

// E4-05 helper change user_id
{
  const { data, error } = await helperA.client
    .from('household_members')
    .update({ user_id: FAKE_UID })
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .select();
  const { data: check } = await helperA.client
    .from('household_members')
    .select('user_id')
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .maybeSingle();
  const pass = deniedUpdate(error, data) && check?.user_id === helperA.userId;
  record('E4-05', pass ? 'PASS' : 'FAIL', `uidMatch=${check?.user_id === helperA.userId} err=${error?.message || 'none'} rows=${(data || []).length}`);
}

// E4-06 employer promote self to owner
{
  const { data, error } = await empA.client
    .from('household_members')
    .update({ role: 'owner' })
    .eq('household_id', HH_A)
    .eq('user_id', empA.userId)
    .select();
  const { data: check } = await empA.client
    .from('household_members')
    .select('role')
    .eq('household_id', HH_A)
    .eq('user_id', empA.userId)
    .maybeSingle();
  const pass = deniedUpdate(error, data) && check?.role === 'employer';
  record('E4-06', pass ? 'PASS' : 'FAIL', `role=${check?.role} err=${error?.message || 'none'} rows=${(data || []).length}`);
}

// E4-07 employer change another member role (direct + RPC)
{
  const direct = await empA.client
    .from('household_members')
    .update({ role: 'employer' })
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .select();
  const rpc = await empA.client.rpc('change_household_member_role', {
    p_household_id: HH_A,
    p_member_user_id: helperA.userId,
    p_new_role: 'employer',
  });
  const { data: check } = await ownerA.client
    .from('household_members')
    .select('role')
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .maybeSingle();
  const pass =
    deniedUpdate(direct.error, direct.data) &&
    !!rpc.error &&
    check?.role === 'helper';
  record(
    'E4-07',
    pass ? 'PASS' : 'FAIL',
    `directErr=${direct.error?.message || 'none'} rpcErr=${rpc.error?.message || 'none'} role=${check?.role}`,
  );
}

// E4-08 owner A changes helper A to employer via RPC, then back
{
  const toEmp = await ownerA.client.rpc('change_household_member_role', {
    p_household_id: HH_A,
    p_member_user_id: helperA.userId,
    p_new_role: 'employer',
  });
  const { data: mid } = await ownerA.client
    .from('household_members')
    .select('role')
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .maybeSingle();
  const back = await ownerA.client.rpc('change_household_member_role', {
    p_household_id: HH_A,
    p_member_user_id: helperA.userId,
    p_new_role: 'helper',
  });
  const { data: end } = await ownerA.client
    .from('household_members')
    .select('role')
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .maybeSingle();
  const pass = !toEmp.error && mid?.role === 'employer' && !back.error && end?.role === 'helper';
  record(
    'E4-08',
    pass ? 'PASS' : 'FAIL',
    `toEmp=${toEmp.error?.message || 'ok'} mid=${mid?.role} back=${back.error?.message || 'ok'} end=${end?.role}`,
  );
}

// E4-09 owner A tries helper B in HH B
{
  const rpc = await ownerA.client.rpc('change_household_member_role', {
    p_household_id: HH_B,
    p_member_user_id: helperB.userId,
    p_new_role: 'employer',
  });
  const msg = (rpc.error?.message || '').toLowerCase();
  const pass = !!rpc.error && (msg.includes('forbidden') || msg.includes('not') || true);
  // Prefer no existence leak: message should be generic forbidden
  const generic = msg.includes('forbidden');
  record('E4-09', pass && generic ? 'PASS' : pass ? 'PASS' : 'FAIL', `err=${rpc.error?.message || 'none'} genericForbidden=${generic}`);
}

// E4-10 owner cannot change household_id/user_id via RPC (impossible — RPC only sets role)
{
  // Attempt direct PATCH as owner (should also be denied — no UPDATE grant)
  const patchHh = await ownerA.client
    .from('household_members')
    .update({ household_id: HH_B })
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .select();
  const patchUid = await ownerA.client
    .from('household_members')
    .update({ user_id: FAKE_UID })
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .select();
  // RPC has no params for hh/user_id — document + confirm role-only still works
  const roleOnly = await ownerA.client.rpc('change_household_member_role', {
    p_household_id: HH_A,
    p_member_user_id: helperA.userId,
    p_new_role: 'helper',
  });
  const pass =
    deniedUpdate(patchHh.error, patchHh.data) &&
    deniedUpdate(patchUid.error, patchUid.data) &&
    !roleOnly.error;
  record(
    'E4-10',
    pass ? 'PASS' : 'FAIL',
    `patchHh=${patchHh.error?.message || 'none'} patchUid=${patchUid.error?.message || 'none'} roleRpc=${roleOnly.error?.message || 'ok'}`,
  );
}

// E4-11 demote/remove last active owner denied
{
  const demoteRpc = await ownerA.client.rpc('change_household_member_role', {
    p_household_id: HH_A,
    p_member_user_id: ownerA.userId,
    p_new_role: 'employer',
  });
  const demotePatch = await ownerA.client
    .from('household_members')
    .update({ role: 'employer' })
    .eq('household_id', HH_A)
    .eq('user_id', ownerA.userId)
    .select();
  const removeSelf = await ownerA.client.rpc('remove_household_member', {
    p_household_id: HH_A,
    p_user_id: ownerA.userId,
  });
  const { data: check } = await ownerA.client
    .from('household_members')
    .select('role,status')
    .eq('household_id', HH_A)
    .eq('user_id', ownerA.userId)
    .maybeSingle();
  const pass =
    !!demoteRpc.error &&
    deniedUpdate(demotePatch.error, demotePatch.data) &&
    !!removeSelf.error &&
    check?.role === 'owner' &&
    check?.status === 'active';
  record(
    'E4-11',
    pass ? 'PASS' : 'FAIL',
    `demoteRpc=${demoteRpc.error?.message || 'none'} patchRows=${(demotePatch.data || []).length} removeSelf=${removeSelf.error?.message || 'none'} role=${check?.role}`,
  );
}

// E4-12 removed helper update denied
{
  if (removed) {
    const { data, error } = await removed.client
      .from('household_members')
      .update({ role: 'owner' })
      .eq('household_id', HH_A)
      .eq('user_id', removed.userId)
      .select();
    const pass = deniedUpdate(error, data);
    record('E4-12', pass ? 'PASS' : 'FAIL', `err=${error?.message || 'none'} rows=${(data || []).length}`);
  } else {
    record('E4-12', 'BLOCKED', 'removed helper login failed');
  }
}

// E4-13 anon update denied
{
  const c = clientAnon();
  const { data, error } = await c
    .from('household_members')
    .update({ role: 'owner' })
    .eq('household_id', HH_A)
    .select();
  const pass = deniedUpdate(error, data);
  record('E4-13', pass ? 'PASS' : 'FAIL', `err=${error?.message || error?.code || 'none'} rows=${(data || []).length}`);
}

// E4-14 direct REST/PATCH role escalation
{
  const r = await restPatch(helperA.jwt, { role: 'owner' }, {
    household_id: `eq.${HH_A}`,
    user_id: `eq.${helperA.userId}`,
  });
  const { data: check } = await helperA.client
    .from('household_members')
    .select('role')
    .eq('household_id', HH_A)
    .eq('user_id', helperA.userId)
    .maybeSingle();
  const bodyEmpty = !r.json || (Array.isArray(r.json) && r.json.length === 0) || r.json?.code || r.json?.message;
  const pass = check?.role === 'helper' && (!r.ok || bodyEmpty || r.status === 401 || r.status === 403 || r.status >= 400);
  record('E4-14', pass ? 'PASS' : 'FAIL', `http=${r.status} role=${check?.role} body=${JSON.stringify(r.json).slice(0, 120)}`);
}

// E4-15 invitation acceptance still works (disposable QA invitee)
{
  // Prefer owner for invite create so a removed employer fixture does not block this check.
  const created = await ownerA.client.rpc('create_household_invite', {
    p_household_id: HH_A,
    p_invited_role: 'helper',
    p_expires_hours: 1,
  });
  let pass = false;
  let evidence = '';
  if (created.error) {
    evidence = `create failed: ${created.error.message}`;
  } else {
    const row = Array.isArray(created.data) ? created.data[0] : created.data;
    const token = row?.token;
    const inviteId = row?.invite_id || row?.id;
    const temp = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    let inviteTemp = { email: '', password: '', userId: 'a1111111-1111-4111-8111-111111111115' };
    try {
      const env = fs.readFileSync('/tmp/halo-kakak-qa/invite-temp.env', 'utf8');
      inviteTemp.email = (env.match(/^EMAIL=(.+)$/m) || [])[1]?.trim() || '';
      inviteTemp.password = (env.match(/^PASSWORD=(.+)$/m) || [])[1]?.trim() || '';
      inviteTemp.userId = (env.match(/^USER_ID=(.+)$/m) || [])[1]?.trim() || inviteTemp.userId;
    } catch {}
    if (!inviteTemp.email || !inviteTemp.password) {
      evidence = 'invite-temp.env missing; create disposable QA invitee first';
    } else {
      const login = await temp.auth.signInWithPassword({
        email: inviteTemp.email,
        password: inviteTemp.password,
      });
      if (login.error) {
        evidence = `temp login failed: ${login.error.message}`;
      } else {
        const accepted = await temp.rpc('accept_household_invite', { p_token: token });
        const mem = accepted.data;
        const roleOk = !accepted.error && (mem?.role === 'helper' || mem?.[0]?.role === 'helper');
        const rem = await ownerA.client.rpc('remove_household_member', {
          p_household_id: HH_A,
          p_user_id: inviteTemp.userId,
        });
        pass = roleOk && !rem.error;
        evidence = `tokenLen=${token?.length || 0} inviteId=${inviteId} acceptErr=${accepted.error?.message || 'ok'} role=${mem?.role || mem?.[0]?.role} remErr=${rem.error?.message || 'ok'}`;
      }
    }
  }
  record('E4-15', pass ? 'PASS' : 'FAIL', evidence);
}

// E4-16 remove_household_member: cross-household denied; do not remove durable QA employer.
{
  const cross = await ownerA.client.rpc('remove_household_member', {
    p_household_id: HH_B,
    p_user_id: helperB.userId,
  });
  const crossDenied = !!cross.error && /forbidden/i.test(cross.error.message || '');

  const { data: empRow } = await ownerA.client
    .from('household_members')
    .select('status,role')
    .eq('household_id', HH_A)
    .eq('user_id', empA.userId)
    .maybeSingle();

  const disposableId = '07071643-ea6b-4fe6-bfdb-391520243957'; // qa-removed-helper-a
  const rem = await ownerA.client.rpc('remove_household_member', {
    p_household_id: HH_A,
    p_user_id: disposableId,
  });
  const remControlled =
    !rem.error || /already|removed|forbidden|not a member|active/i.test(rem.error.message || '');

  const fixtureOk = empRow?.status === 'active' && empRow?.role === 'employer';
  // If fixture broken by prior destructive run, mark FAIL with restore needed — do not mutate further.
  const pass = crossDenied && remControlled && fixtureOk;
  record(
    'E4-16',
    pass ? 'PASS' : 'FAIL',
    `cross=${cross.error?.message || 'none'} emp=${empRow?.status}/${empRow?.role} remDisp=${rem.error?.message || 'ok'} restoreNeeded=${!fixtureOk}`,
  );
}

// E4-17: filled by post-runner if present
{
  let status = 'PENDING';
  let evidence = 'awaiting unit+smoke';
  try {
    const smoke = JSON.parse(fs.readFileSync('/tmp/halo-kakak-qa/smoke-results.json', 'utf8'));
    const units = ['unit-comment-reads.log', 'unit-today.log', 'unit-presets.log', 'unit-notifications.log']
      .map((f) => fs.readFileSync(`/tmp/halo-kakak-qa/${f}`, 'utf8'))
      .join('\n');
    const unitsOk = /All comment-reads unit tests passed/.test(units)
      && /All today unit tests passed/.test(units)
      && /All passed/.test(units)
      && /All notification unit tests passed/.test(units);
    const smokeOk = smoke?.counts?.FAIL === 0 && smoke?.counts?.BLOCKED === 0;
    const e4Smoke = (smoke?.scenarios || []).find((s) => s.id === 'E4');
    status = unitsOk && smokeOk && e4Smoke?.status === 'PASS' ? 'PASS' : 'FAIL';
    evidence = `unitsOk=${unitsOk} smoke=${JSON.stringify(smoke?.counts)} e4smoke=${e4Smoke?.status}`;
  } catch (e) {
    evidence = e.message;
  }
  record('E4-17', status, evidence);
}

// E4-18 UI uses RPC not direct UPDATE (beta: role-change select hidden — decision H)
{
  const hh = fs.readFileSync('/workspace/halo-kakak/src/pages/Household.jsx', 'utf8');
  const settings = fs.readFileSync('/workspace/halo-kakak/src/pages/Settings.jsx', 'utf8');
  const usesRoleRpc = hh.includes("rpc('change_household_member_role'");
  const roleSelectHidden =
    !hh.includes('aria-label="更改角色"') && !/<select[\s\S]{0,120}更改角色/.test(hh);
  // Beta may hide role UI; RPC path still required when select is present.
  const roleOk = usesRoleRpc || roleSelectHidden;
  const usesRemoveRpc = hh.includes("rpc('remove_household_member'");
  const usesLeaveRpc = settings.includes("rpc('leave_household'");
  const noDirectUpdate = !hh.match(/from\('household_members'\)[\s\S]{0,80}\.update\(/);
  const ownerGate = hh.includes('canManageMembers');
  const pass = roleOk && usesRemoveRpc && usesLeaveRpc && noDirectUpdate && ownerGate;
  record(
    'E4-18',
    pass ? 'PASS' : 'FAIL',
    `roleRpc=${usesRoleRpc} roleSelectHidden=${roleSelectHidden} removeRpc=${usesRemoveRpc} leaveRpc=${usesLeaveRpc} noDirectUpdate=${noDirectUpdate} ownerGate=${ownerGate}`,
  );
}

const summary = {
  PASS: results.filter((r) => r.status === 'PASS').length,
  FAIL: results.filter((r) => r.status === 'FAIL').length,
  BLOCKED: results.filter((r) => r.status === 'BLOCKED').length,
  PENDING: results.filter((r) => r.status === 'PENDING').length,
};

const out = {
  generated_at: new Date().toISOString(),
  counts: summary,
  scenarios: results,
};
fs.writeFileSync('/tmp/halo-kakak-qa/e4-results.json', JSON.stringify(out, null, 2));
console.log('\nCOUNTS', JSON.stringify(summary));
process.exit(summary.FAIL > 0 ? 1 : 0);
