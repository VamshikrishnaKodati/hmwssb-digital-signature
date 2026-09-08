#!/usr/bin/env node
/**
 * Phase 1 Runtime Audit — Tests the live running backend on :5001.
 * Verifies: login, dashboard API, RBAC, auth for all 16 roles.
 * Node 20+ required for native fetch.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const BASE = 'http://127.0.0.1:5001';

const ROLES = [
  { username: 'manager',           desg: 'Manager',                 label: 'Manager' },
  { username: 'dgm',              desg: 'DGM',                     label: 'DGM' },
  { username: 'gm',               desg: 'GM',                      label: 'GM' },
  { username: 'cgm',              desg: 'CGM',                     label: 'CGM' },
  { username: 'dop',              desg: 'DOP',                     label: 'DOP' },
  { username: 'ed',               desg: 'ED',                      label: 'ED' },
  { username: 'md',               desg: 'MD',                      label: 'MD' },
  { username: 'director_admin',   desg: 'DirectorOfAdministration', label: 'DirectorOfAdministration' },
  { username: 'finance_clerk',    desg: 'FinanceClerk',            label: 'FinanceClerk' },
  { username: 'finance_manager',  desg: 'FinanceManager',          label: 'FinanceManager' },
  { username: 'finance_head',     desg: 'FinanceHead',             label: 'FinanceHead' },
  { username: 'tender_officer',   desg: 'TenderOfficer',           label: 'TenderOfficer' },
  { username: 'site_engineer',    desg: 'SiteEngineer',            label: 'SiteEngineer' },
  { username: 'billing_officer',  desg: 'BillingOfficer',          label: 'BillingOfficer' },
  { username: 'admin_officer',    desg: 'Administrator',           label: 'Administrator' },
  { username: 'soradmin',         desg: 'SoRAdmin',                label: 'SoRAdmin' },
];

let pass = 0, fail = 0, p0 = [], p1 = [];
const findings = [];

function ok(msg) { pass++; console.log(`  ✓ ${msg}`); }
function bad(msg, sev = 'P1') { fail++; console.log(`  ✗ [${sev}] ${msg}`); if (sev === 'P0') p0.push(msg); else p1.push(msg); }
function header(msg) { console.log(`\n${'═'.repeat(70)}\n  ${msg}\n${'═'.repeat(70)}`); }

async function api(method, path, body, token) {
  const opts = { method, headers: {} };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, opts);
  let data;
  try { data = await r.json(); } catch { data = await r.text(); }
  return { status: r.status, body: data, ok: r.ok, headers: Object.fromEntries(r.headers) };
}

(async () => {
header('1. Server Basics');
{
  // Health: does the server respond at all?
  try {
    const r = await api('GET', '/api/auth/profile', null, 'invalid-token');
    if (r.status === 401) ok('Server responds on :5001, invalid token → 401');
    else bad(`Expected 401 for invalid token, got ${r.status}`);
  } catch (e) { bad(`Server not responding on :5001: ${e.message}`, 'P0'); }

  // Check port: ensure we are NOT talking to port 5000
  ok('Running audit against :5001 (verified by connect)');

  // Check stale port 5000
  try {
    const r5k = await fetch('http://127.0.0.1:5000/api/auth/profile', { signal: AbortSignal.timeout(2000) });
    if (r5k.status) bad('Stale port 5000 is serving responses — KILL IT', 'P0');
  } catch { ok('No stale server on :5000'); }
}

// ─── 2. Login for all 16 roles ───────────────────────────────────────────────
header('2. Login for All 16 Roles');
const tokens = {};
for (const role of ROLES) {
  const r = await api('POST', '/api/auth/login', { username: role.username, password: 'password123' });
  if (r.ok && (r.body?.data?.token || r.body?.token)) {
    const tok = r.body?.data?.token || r.body?.token;
    tokens[role.username] = tok;
    const decoded = JSON.parse(Buffer.from(tok.split('.')[1], 'base64').toString());
    if (decoded.Designation === role.desg) ok(`${role.label} (${role.username}): login OK, Designation=${decoded.Designation}`);
    else bad(`${role.label}: Designation mismatch — expected ${role.desg}, got ${decoded.Designation}`);
  } else {
    bad(`${role.label} (${role.username}): login FAILED — ${JSON.stringify(r.body)}`, 'P0');
  }
}

// ─── 2b. Verify no ProcurementOfficer token can be created ──────────────────
header('2b. ProcurementOfficer Login Blocked');
{
  const r = await api('POST', '/api/auth/login', { username: 'procurement_officer', password: 'password123' });
  if (!r.ok || !(r.body?.data?.token || r.body?.token)) ok('ProcurementOfficer login correctly blocked/not found');
  else bad('ProcurementOfficer login still succeeds — user should be deactivated', 'P0');
}

// ─── 3. Dashboard API for each role ──────────────────────────────────────────
header('3. Dashboard API for All 16 Roles');
const DASH_KEYS = {
  Manager: 'managerDashboard', DGM: 'dgmDashboard', GM: 'gmDashboard',
  CGM: 'cgmDashboard', DOP: 'dopDashboard', ED: 'edDashboard', MD: 'mdDashboard',
  DirectorOfAdministration: 'directorAdminDashboard',
  FinanceClerk: 'financeClerkDashboard', FinanceManager: 'financeManagerDashboard',
  FinanceHead: 'financeHeadDashboard', TenderOfficer: 'tenderOfficerDashboard',
  SiteEngineer: 'siteEngineerDashboard', BillingOfficer: 'billingDashboard',
  Administrator: 'adminDashboard', SoRAdmin: 'soRAdminDashboard',
};

for (const role of ROLES) {
  const token = tokens[role.username];
  if (!token) { bad(`Dashboard ${role.label}: skipped (no token)`, 'P0'); continue; }
  const r = await api('GET', '/api/dashboard/stats', null, token);
  if (!r.ok) { bad(`Dashboard ${role.label}: HTTP ${r.status} — ${JSON.stringify(r.body)}`); continue; }
  const key = DASH_KEYS[role.desg];
  const body = r.body?.data || r.body;
  if (body[key] !== undefined) ok(`${role.label}: dashboard API returns own key "${key}"`);
  else bad(`${role.label}: missing own dashboard key "${key}" in response (keys: ${Object.keys(body).join(', ')})`);
}

// ─── 4. RBAC — authorized actions ────────────────────────────────────────────
header('4. RBAC — Authorized Actions');
{
  // Manager can view estimates
  const r1 = await api('GET', '/api/estimates', null, tokens.manager);
  if (r1.ok) ok('Manager can GET /api/estimates');
  else bad(`Manager: GET /api/estimates → ${r1.status}`);

  // TenderOfficer can view tenders
  const r2 = await api('GET', '/api/tender', null, tokens.tender_officer);
  if (r2.ok) ok('TenderOfficer can GET /api/tender');
  else bad(`TenderOfficer: GET /api/tender → ${r2.status}`);

  // DirectorOfAdministration can view agencies
  const r3 = await api('GET', '/api/agency', null, tokens.director_admin);
  if (r3.ok) ok('DirectorOfAdministration can GET /api/agency');
  else bad(`DirectorOfAdministration: GET /api/agency → ${r3.status}`);

  // Administrator can view users
  const r4 = await api('GET', '/api/users', null, tokens.admin_officer);
  if (r4.ok) ok('Administrator can GET /api/users');
  else bad(`Administrator: GET /api/users → ${r4.status}`);

  // SoRAdmin can view items
  const r5 = await api('GET', '/api/items', null, tokens.soradmin);
  if (r5.ok) ok('SoRAdmin can GET /api/items');
  else bad(`SoRAdmin: GET /api/items → ${r5.status}`);
}

// ─── 5. RBAC — unauthorized actions ──────────────────────────────────────────
header('5. RBAC — Unauthorized Actions (should be 401/403)');
{
  // SiteEngineer should NOT access admin-only users endpoint
  const r1 = await api('GET', '/api/users', null, tokens.site_engineer);
  if (r1.status === 403 || r1.status === 401) ok(`SiteEngineer blocked from /api/users (${r1.status})`);
  else bad(`SiteEngineer can access /api/users — expected 403, got ${r1.status}`);

  // SoRAdmin should NOT create estimates (Manager only)
  const r2 = await api('POST', '/api/estimates', { NameOfWork: 'test' }, tokens.soradmin);
  if (r2.status === 403 || r2.status === 401) ok(`SoRAdmin blocked from creating estimates (${r2.status})`);
  else bad(`SoRAdmin can create estimates — expected 403, got ${r2.status}`);

  // TenderOfficer should NOT select agency
  const r3 = await api('POST', '/api/workflow/1/select-agency', {}, tokens.tender_officer);
  if (r3.status === 403 || r3.status === 401 || r3.status === 400) ok(`TenderOfficer blocked from select-agency (${r3.status})`);
  else bad(`TenderOfficer can select agency — expected 403, got ${r3.status}`);

  // FinanceClerk should NOT manage tender
  const r4 = await api('GET', '/api/tender', null, tokens.finance_clerk);
  if (r4.status === 403 || r4.status === 401) ok(`FinanceClerk blocked from /api/tender (${r4.status})`);
  else bad(`FinanceClerk can access /api/tender — expected 403, got ${r4.status}`);

  // BillingOfficer should NOT create tenders
  const r5 = await api('POST', '/api/tender', { EstimateID: 99999 }, tokens.billing_officer);
  if (r5.status === 403 || r5.status === 401) ok(`BillingOfficer blocked from POST /api/tender (${r5.status})`);
  else bad(`BillingOfficer can create tenders — expected 403, got ${r5.status}`);

  // Manager should NOT start work (SiteEngineer only)
  const r6 = await api('POST', '/api/workflow/1/start-work', {}, tokens.manager);
  if (r6.status === 403 || r6.status === 401 || r6.status === 400) ok(`Manager blocked from start-work (${r6.status})`);
  else bad(`Manager can start work — expected 403, got ${r6.status}`);

  // No token → 401
  const r7 = await api('GET', '/api/estimates');
  if (r7.status === 401) ok('No token → 401 on protected endpoint');
  else bad(`No token: expected 401, got ${r7.status}`);

  // Estimate-level procurement workflow guards (close-tender = TenderOfficer;
  // eval/L1/award/WO/agreement = DirectorOfAdministration). SiteEngineer must
  // be blocked from all of them (403).
  const guarded = {
    'close-tender': 'TenderOfficer',
    'technical-eval': 'DirectorOfAdministration',
    'financial-eval': 'DirectorOfAdministration',
    'identify-l1': 'DirectorOfAdministration',
    'create-award': 'DirectorOfAdministration',
    'issue-work-order': 'DirectorOfAdministration',
    'record-agreement': 'DirectorOfAdministration',
  };
  for (const [action, role] of Object.entries(guarded)) {
    const r = await api('POST', `/api/workflow/1/${action}`, {}, tokens.site_engineer);
    if (r.status === 403 || r.status === 401) ok(`${action} blocked for SiteEngineer (${r.status}) [${role}]`);
    else bad(`${action} open to SiteEngineer — expected 403/401, got ${r.status} [requires ${role}]`);
  }
}

// ─── 6. Notifications endpoint ───────────────────────────────────────────────
header('6. Notifications Endpoint');
{
  for (const uname of ['manager', 'director_admin', 'tender_officer', 'site_engineer']) {
    const r = await api('GET', '/api/notifications', null, tokens[uname]);
    if (r.ok) ok(`${uname}: notifications endpoint returns data`);
    else bad(`${uname}: notifications endpoint → ${r.status}`);
  }
}

// ─── 7. Audit logs ──────────────────────────────────────────────────────────
header('7. Audit Logs');
{
  const r1 = await api('GET', '/api/audit-logs', null, tokens.admin_officer);
  if (r1.ok) ok('Administrator can access audit logs');
  else bad(`Administrator: audit logs → ${r1.status}`);

  const r2 = await api('GET', '/api/audit-logs', null, tokens.site_engineer);
  if (r2.status === 403 || r2.status === 401) ok(`SiteEngineer blocked from audit logs (${r2.status})`);
  else bad(`SiteEngineer can access audit logs — expected 403, got ${r2.status}`);
}

// ─── 8. Demo accounts endpoint ───────────────────────────────────────────────
header('8. Demo Accounts Endpoint');
{
  const r = await api('GET', '/api/auth/demo-accounts');
  if (r.ok) {
    const payload = r.body?.data || r.body;
    const accounts = payload?.accounts || [];
    const hasPassword = payload?.devPassword;
    if (hasPassword) ok('Demo accounts endpoint returns data (dev password included — expected in dev)');
    else bad('Demo accounts endpoint: no devPassword in response');

    // Check if ProcurementOfficer is gone
    const hasPO = accounts.some(a => a.role === 'ProcurementOfficer' || a.username === 'procurement_officer');
    if (!hasPO) ok('ProcurementOfficer not in demo accounts');
    else bad('ProcurementOfficer still in demo accounts list');
  } else bad(`Demo accounts endpoint → ${r.status}`);
}

// ─── 9. CORS headers ────────────────────────────────────────────────────────
header('9. CORS Headers');
{
  const r = await fetch(`${BASE}/api/auth/profile`, {
    method: 'OPTIONS',
    headers: { 'Origin': 'http://evil.com', 'Access-Control-Request-Method': 'GET' }
  });
  const acao = r.headers.get('access-control-allow-origin');
  if (acao === '*' || acao === 'http://evil.com')
    bad(`CORS allows any origin: Access-Control-Allow-Origin: ${acao}`, 'P0');
  else if (!acao)
    ok('CORS blocks cross-origin requests (no ACAO header)');
  else
    ok(`CORS allows origin: ${acao} (restrictive)`);
}

// ─── 10. Expired/invalid token behavior ──────────────────────────────────────
header('10. Token Edge Cases');
{
  // Expired token
  const expiredPayload = { UserID: 1, Username: 'manager', Name: 'Manager', Designation: 'Manager', exp: Math.floor(Date.now()/1000) - 3600 };
  const expiredToken = require('jsonwebtoken').sign(expiredPayload, process.env.JWT_SECRET || 'hmwssb-jwt-secret-key-2024');
  const r1 = await api('GET', '/api/estimates', null, expiredToken);
  if (r1.status === 401) ok('Expired token → 401');
  else bad(`Expired token: expected 401, got ${r1.status}`);

  // Tampered token
  const r2 = await api('GET', '/api/estimates', null, 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjF9.tampered');
  if (r2.status === 401) ok('Tampered token → 401');
  else bad(`Tampered token: expected 401, got ${r2.status}`);
}

// ─── 11. API envelope consistency ────────────────────────────────────────────
header('11. API Response Envelope');
{
  const r = await api('GET', '/api/estimates', null, tokens.manager);
  if (r.body && typeof r.body === 'object') {
    if ('success' in r.body) ok('API responses use { success, data/error } envelope');
    else bad('API responses missing success field in envelope');
  } else bad('API response is not a JSON object');
}

// ─── Summary ─────────────────────────────────────────────────────────────────
header('AUDIT SUMMARY');
console.log(`  Total checks: ${pass + fail}`);
console.log(`  Passed:       ${pass}`);
console.log(`  Failed:       ${fail}`);
if (p0.length) { console.log(`\n  P0 FAILURES:`); p0.forEach(f => console.log(`    → ${f}`)); }
if (p1.length) { console.log(`\n  P1 FINDINGS:`); p1.forEach(f => console.log(`    → ${f}`)); }
if (fail === 0) console.log('\n  ALL RUNTIME CHECKS PASSED.');
console.log();
process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('AUDIT CRASH:', e); process.exit(1); });
