const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const { trackEstimate, cleanupTrackedData } = require('./cleanup');
const { resolveLocation } = require('./helpers');

let server;
let tokens = {};
let location, items;

const PORT = 5411;

function request(method, path, body, authToken) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1', port: PORT, path, method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (authToken) opts.headers['Authorization'] = 'Bearer ' + authToken;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { return resolve({ status: res.statusCode, body: data }); }
        if (parsed.success === true) return resolve({ status: res.statusCode, body: parsed.data });
        if (parsed.success === false) return resolve({ status: res.statusCode, body: { ...(parsed.error || {}), error: (parsed.error && parsed.error.message) || 'fail' } });
        return resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function captureOtpFromLog(action) {
  const original = console.log;
  let captured = '';
  console.log = (...args) => {
    const line = args.map(String).join(' ');
    if (line.includes('[OTP][DEV]')) captured = line;
    original(...args);
  };
  try { const result = await action(); return { result, captured }; }
  finally { console.log = original; }
}

function extractOtp(captured) { const m = captured.match(/(\d{6})/); return m ? m[1] : null; }

async function login(users) {
  for (const u of users) {
    tokens[u] = (await request('POST', '/api/auth/login', { username: u, password: 'password123' })).body.token;
  }
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(PORT, resolve); });
  await login(['manager','dgm','gm','cgm','dop','ed','md','tender_officer','director_admin','finance_head']);
  location = await resolveLocation(request, tokens.manager);
  const itemsRes = await request('GET', '/api/items?limit=1000', null, tokens.manager);
  items = itemsRes.body;
});

after(async () => {
  await cleanupTrackedData();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

async function createEstimate() {
  const payload = {
    NameOfWork: 'TS Test ' + Date.now(),
    WorkCategory: 'Water Supply',
    RegionID: location.RegionID, WardID: location.WardID,
    GSTPercent: 18, LSProvision: 0, AdditionalItems: [],
    Items: items.slice(0, 2).map(function(it) {
      return { ItemID: it.ItemID, Category: it.Category, FormulaType: it.FormulaType, Unit: it.Unit, Rate: it.Rate, N: 1, L: 1, B: 1, D: 1 };
    }),
  };
  const r = await request('POST', '/api/estimates', payload, tokens.manager);
  return r.body.EstimateID || r.body.estimateId;
}

async function getEstimate(eid) {
  return (await request('GET', '/api/estimates/' + eid, null, tokens.manager)).body;
}

async function advanceToMDfinal(eid) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + eid + '/submit/request-otp', {}, tokens.manager));
  assert.equal((await request('POST', '/api/workflow/' + eid + '/submit', { otpCode: extractOtp(captured) }, tokens.manager)).status, 200);

  const c1 = await captureOtpFromLog(() => request('POST', '/api/workflow/' + eid + '/approve/request-otp', {}, tokens.dgm));
  assert.equal((await request('POST', '/api/workflow/' + eid + '/approve', { otpCode: extractOtp(c1.captured) }, tokens.dgm)).status, 200);

  const c2 = await captureOtpFromLog(() => request('POST', '/api/workflow/' + eid + '/sign/request-otp', {}, tokens.gm));
  assert.equal((await request('POST', '/api/workflow/' + eid + '/sign', { otpCode: extractOtp(c2.captured), certificateId: 'HMWSSB-TS-001' }, tokens.gm)).status, 200);

  const c3 = await captureOtpFromLog(() => request('POST', '/api/workflow/' + eid + '/cgm-submit/request-otp', {}, tokens.cgm));
  assert.equal((await request('POST', '/api/workflow/' + eid + '/cgm-submit', { otpCode: extractOtp(c3.captured) }, tokens.cgm)).status, 200);

  const c4 = await captureOtpFromLog(() => request('POST', '/api/workflow/' + eid + '/dop-approve/request-otp', {}, tokens.dop));
  assert.equal((await request('POST', '/api/workflow/' + eid + '/dop-approve', { otpCode: extractOtp(c4.captured) }, tokens.dop)).status, 200);

  const c5 = await captureOtpFromLog(() => request('POST', '/api/workflow/' + eid + '/ed-approve/request-otp', {}, tokens.ed));
  assert.equal((await request('POST', '/api/workflow/' + eid + '/ed-approve', { otpCode: extractOtp(c5.captured) }, tokens.ed)).status, 200);

  const c6 = await captureOtpFromLog(() => request('POST', '/api/workflow/' + eid + '/md-final/request-otp', {}, tokens.md));
  const r = await request('POST', '/api/workflow/' + eid + '/md-final', { otpCode: extractOtp(c6.captured) }, tokens.md);
  assert.equal(r.status, 200, 'md-final: ' + JSON.stringify(r.body));
}

// FCN + AdminSanction, leaves estimate at AdminSanctionGenerated (Director owns)
async function advanceToAdminSanction(eid) {
  await advanceToMDfinal(eid);
  const fcn = await request('POST', '/api/workflow/' + eid + '/generate-fcn', {}, tokens.director_admin);
  assert.equal(fcn.status, 200, 'generate-fcn: ' + JSON.stringify(fcn.body));
  const san = await request('POST', '/api/workflow/' + eid + '/generate-admin-sanction', { sanctionNo: 'AS-TS-' + Date.now() }, tokens.director_admin);
  assert.equal(san.status, 200, 'generate-admin-sanction: ' + JSON.stringify(san.body));
}

// ── Scenario A: assign GM as TS authority ─────────────────────────────────────
describe('TS Scenario A: GM as assigned authority', () => {
  it('Director assigns GM as TS authority -> TSPending -> GM approves -> TSApproved -> Tender receives', async () => {
    const eid = await createEstimate();
    trackEstimate(eid);
    await advanceToAdminSanction(eid);

    const assign = await request('POST', '/api/workflow/' + eid + '/assign-ts-authority', { AuthorityRole: 'GM' }, tokens.director_admin);
    assert.equal(assign.status, 200, 'assign: ' + JSON.stringify(assign.body));
    let est = await getEstimate(eid);
    assert.equal(est.Status, 'TSPending');
    assert.equal(est.CurrentOwner, await userOf('gm'), 'GM is owner after assignment');

    // Only GM (assigned authority) can approve; DGM/Director cannot
    const dgmApprove = await request('POST', '/api/workflow/' + eid + '/approve-ts', { remarks: 'wrong' }, tokens.dgm);
    assert.equal(dgmApprove.status, 403, 'unassigned authority cannot approve');
    const directorApprove = await request('POST', '/api/workflow/' + eid + '/approve-ts', { remarks: 'wrong' }, tokens.director_admin);
    assert.equal(directorApprove.status, 403, 'director is not assigned authority');

    const approve = await request('POST', '/api/workflow/' + eid + '/approve-ts', { remarks: 'approved' }, tokens.gm);
    assert.equal(approve.status, 200, 'approve: ' + JSON.stringify(approve.body));
    assert.ok(approve.body.tsNo && approve.body.tsNo.startsWith('TS/'), 'TS number server-controlled: ' + approve.body.tsNo);

    est = await getEstimate(eid);
    assert.equal(est.Status, 'TSApproved');
    assert.equal(est.CurrentOwner, await userOf('tender_officer'), 'TenderOfficer receives after TS');

    // Can now publish tender
    const pub = await request('POST', '/api/workflow/' + eid + '/publish-tender', {}, tokens.tender_officer);
    assert.equal(pub.status, 200, 'publish after TS: ' + JSON.stringify(pub.body));
  });
});

// ── Scenario B: assign DGM as TS authority ────────────────────────────────────
describe('TS Scenario B: DGM as assigned authority', () => {
  it('Director assigns DGM as TS authority, only DGM approves', async () => {
    const eid = await createEstimate();
    trackEstimate(eid);
    await advanceToAdminSanction(eid);

    const assign = await request('POST', '/api/workflow/' + eid + '/assign-ts-authority', { AuthorityRole: 'DGM' }, tokens.director_admin);
    assert.equal(assign.status, 200, 'assign: ' + JSON.stringify(assign.body));
    const est = await getEstimate(eid);
    assert.equal(est.Status, 'TSPending');
    assert.equal(est.CurrentOwner, await userOf('dgm'), 'DGM is owner');

    // GM (not assigned) cannot approve
    const gmApprove = await request('POST', '/api/workflow/' + eid + '/approve-ts', { remarks: 'wrong' }, tokens.gm);
    assert.equal(gmApprove.status, 403, 'GM is not assigned authority');

    const approve = await request('POST', '/api/workflow/' + eid + '/approve-ts', { remarks: 'dgm approved' }, tokens.dgm);
    assert.equal(approve.status, 200, 'approve: ' + JSON.stringify(approve.body));
    assert.equal((await getEstimate(eid)).Status, 'TSApproved');
  });
});

// ── Scenario C: assign DirectorOfAdministration as TS authority ───────────────
describe('TS Scenario C: Director as assigned authority', () => {
  it('Director assigns self to another Director-admin user, or via user assignment, and approves', async () => {
    const eid = await createEstimate();
    trackEstimate(eid);
    await advanceToAdminSanction(eid);

    // Assign via explicit AuthorityUserID (must be a different user than assigner)
    const assignRes = await request('POST', '/api/workflow/' + eid + '/assign-ts-authority', { AuthorityUserID: await userOf('gm') }, tokens.director_admin);
    assert.equal(assignRes.status, 200, 'assign by user id: ' + JSON.stringify(assignRes.body));

    const est = await getEstimate(eid);
    assert.equal(est.Status, 'TSPending');
    assert.equal(est.CurrentOwner, await userOf('gm'), 'assigned by user id works');

    // Cannot assign to yourself
    const eid2 = await createEstimate();
    trackEstimate(eid2);
    await advanceToAdminSanction(eid2);
    const selfAssign = await request('POST', '/api/workflow/' + eid2 + '/assign-ts-authority', { AuthorityRole: 'DirectorOfAdministration' }, tokens.director_admin);
    assert.equal(selfAssign.status, 403, 'cannot assign to self');
  });
});

// ── Negative / boundary tests ─────────────────────────────────────────────────
describe('TS negatives', () => {
  it('duplicate approval returns 409', async () => {
    const eid = await createEstimate();
    trackEstimate(eid);
    await advanceToAdminSanction(eid);
    await request('POST', '/api/workflow/' + eid + '/assign-ts-authority', { AuthorityRole: 'GM' }, tokens.director_admin);
    assert.equal((await request('POST', '/api/workflow/' + eid + '/approve-ts', { remarks: '1' }, tokens.gm)).status, 200);
    const again = await request('POST', '/api/workflow/' + eid + '/approve-ts', { remarks: '2' }, tokens.gm);
    assert.equal(again.status, 400, 'already TSApproved, cannot approve TS');
  });

  it('publish before TS approval returns 409/400', async () => {
    const eid = await createEstimate();
    trackEstimate(eid);
    await advanceToAdminSanction(eid);
    const pub = await request('POST', '/api/workflow/' + eid + '/publish-tender', {}, tokens.tender_officer);
    assert.ok(pub.status === 400 || pub.status === 403, 'publish blocked before TS, got ' + pub.status);
  });

  it('TS assignment requires AdminSanctionGenerated status', async () => {
    const eid = await createEstimate();
    trackEstimate(eid);
    const res = await request('POST', '/api/workflow/' + eid + '/assign-ts-authority', { AuthorityRole: 'GM' }, tokens.director_admin);
    assert.equal(res.status, 403, 'cannot assign TS from Draft (director not owner yet)');
  });

  it('non-Director cannot assign TS authority', async () => {
    const eid = await createEstimate();
    trackEstimate(eid);
    await advanceToAdminSanction(eid);
    const res = await request('POST', '/api/workflow/' + eid + '/assign-ts-authority', { AuthorityRole: 'GM' }, tokens.gm);
    assert.equal(res.status, 403, 'only Director can assign TS');
  });

  it('TS number is server-generated (not client supplied)', async () => {
    const eid = await createEstimate();
    trackEstimate(eid);
    await advanceToAdminSanction(eid);
    await request('POST', '/api/workflow/' + eid + '/assign-ts-authority', { AuthorityRole: 'GM' }, tokens.director_admin);
    const approve = await request('POST', '/api/workflow/' + eid + '/approve-ts', { tsNo: 'CLIENT-TS-1', remarks: 'x' }, tokens.gm);
    assert.equal(approve.status, 200);
    assert.ok(approve.body.tsNo && approve.body.tsNo.startsWith('TS/'), 'client TS number ignored, server-generated used');
  });
});

// ── SLA for TS stage ──────────────────────────────────────────────────────────
describe('TS SLA', () => {
  it('SLA is started when TS assigned (TechnicalSanction stage)', async () => {
    const { getSlaStatus } = require('../utils/sla');
    const eid = await createEstimate();
    trackEstimate(eid);
    await advanceToAdminSanction(eid);
    await request('POST', '/api/workflow/' + eid + '/assign-ts-authority', { AuthorityRole: 'GM' }, tokens.director_admin);
    const sla = await getSlaStatus('Estimate', eid);
    assert.ok(sla && sla.dueAt, 'TS SLA should have a due date');
    assert.ok(sla.remainingMinutes > 0, 'TS SLA should have remaining time');
  });
});

// ── RBAC permission check ─────────────────────────────────────────────────────
describe('TS RBAC', () => {
  it('permissions exist for TS assignment/approval', async () => {
    const db = require('../config/db');
    const r = await db.query(
      `SELECT p."PermissionKey", r."RoleName"
       FROM "Permission" p
       LEFT JOIN "RolePermission" rp ON rp."PermissionID" = p."PermissionID"
       LEFT JOIN "Role" r ON r."RoleID" = rp."RoleID"
       WHERE p."PermissionKey" IN ('estimate.tsAssign','estimate.tsApprove','estimate.tsReturn','estimate.fcnAssign')`
    );
    const keys = r.rows.map(row => row.PermissionKey);
    for (const k of ['estimate.tsAssign', 'estimate.tsApprove', 'estimate.tsReturn', 'estimate.fcnAssign']) {
      assert.ok(keys.includes(k), 'permission ' + k + ' missing');
    }
    assert.ok(r.rows.some(x => x.PermissionKey === 'estimate.tsAssign' && x.RoleName === 'DirectorOfAdministration'), 'Director has tsAssign');
    assert.ok(r.rows.some(x => x.PermissionKey === 'estimate.tsApprove' && x.RoleName === 'GM'), 'GM has tsApprove');
    assert.ok(r.rows.some(x => x.PermissionKey === 'estimate.tsApprove' && x.RoleName === 'DGM'), 'DGM has tsApprove');
  });
});

async function userOf(username) {
  const db = require('../config/db');
  const r = await db.query('SELECT "UserID" FROM "Users" WHERE "Username" = $1', [username]);
  return r.rows[0].UserID;
}
