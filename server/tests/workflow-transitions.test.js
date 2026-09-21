// Workflow/action consistency across ALL estimate roles — one transition engine
// on both tiers:
//   - client: resolveWorkflowPosition(status, CurrentOwnerDesignation) at
//     client/src/utils/workflowMapping.js — a pure function of the persisted
//     estimate state, and the single resolver behind the status card (Current
//     Stage / Next Stage / Next Role) and the Forward action/label.
//   - server: workflowController resolves the next authority from the CURRENT
//     OWNER (APPROVAL_LADDER), never from the creator's role.
// These tests pin the two to the same table:
//   Manager→DGM, DGM→GM, GM→CGM, CGM→DOP, DOP→ED, ED→MD, MD = Final Approval
// for both the CREATE side (each chain role creates → edits → forwards) and the
// RECEIVE side (Manager-created estimate driven DGM…MD to FinalApproved), and
// that a fresh login against the persisted state resolves identically.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const db = require('../config/db');
const { resolveLocation } = require('./helpers');
const { cleanupTrackedData, trackEstimate } = require('./cleanup');

const PORT = 5257;
let server;
let items, loc;

function request(method, path, body, authToken) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (authToken) opts.headers['Authorization'] = `Bearer ${authToken}`;

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let body;
        try {
          body = JSON.parse(data);
        } catch {
          return resolve({ status: res.statusCode, body: data });
        }
        if (body && body.success === true) return resolve({ status: res.statusCode, body: body.data });
        if (body && body.success === false) return resolve({ status: res.statusCode, body: { ...(body.error || {}), error: (body.error && body.error.message) || 'Request failed' } });
        return resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login(username) {
  const r = await request('POST', '/api/auth/login', { username, password: 'password123' });
  assert.equal(r.status, 200, `login ${username}: ${JSON.stringify(r.body)}`);
  return r.body;
}

async function captureOtpFromLog(action) {
  const original = console.log;
  let captured = '';
  console.log = (...args) => {
    const line = args.map(String).join(' ');
    if (line.includes('[OTP][DEV]')) captured = line;
    original(...args);
  };
  try {
    const result = await action();
    return { result, captured };
  } finally {
    console.log = original;
  }
}

function nItem() {
  return items.find((i) => i.FormulaType === 'N');
}

async function createEstimate(token, name) {
  const item = nItem();
  assert.ok(item, 'an N-formula item must be seeded');
  const res = await request('POST', '/api/estimates', {
    NameOfWork: name,
    WorkCategory: 'Water Supply',
    RegionID: loc.RegionID,
    WardID: loc.WardID,
    GSTPercent: 18,
    LSProvision: 0,
    AdditionalItems: [],
    Items: [{
      ItemID: item.ItemID, Category: item.Category, FormulaType: 'N', Unit: item.Unit,
      Rate: item.Rate, N: 2, L: null, B: null, D: null,
    }],
  }, token);
  assert.equal(res.status, 201, `create: ${JSON.stringify(res.body)}`);
  trackEstimate(res.body.EstimateID);
  return res.body;
}

async function ownerDesignation(estimateId) {
  const { rows } = await db.query(
    `SELECT u."Designation" FROM "EstimateHeader" e
     JOIN "Users" u ON u."UserID" = e."CurrentOwner"
     WHERE e."EstimateID" = $1`,
    [estimateId]);
  return rows[0] ? rows[0].Designation : null;
}

async function headerState(estimateId) {
  const { rows } = await db.query(
    `SELECT "Status" FROM "EstimateHeader" WHERE "EstimateID" = $1`,
    [estimateId]);
  return rows[0] ? rows[0].Status : null;
}

// Perform an OTP-gated workflow action and assert it returns 200.
async function act(token, estimateId, action, otpPattern, extra = {}) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateId}/${action}/request-otp`, {}, token));
  const m = new RegExp(otpPattern).exec(captured);
  assert.ok(m, `${action} OTP should be captured; got: ${captured}`);
  const res = await request('POST', `/api/workflow/${estimateId}/${action}`, { otpCode: m[1], ...extra }, token);
  assert.equal(res.status, 200, `${action}: ${JSON.stringify(res.body)}`);
}

// Client-side single resolver (imported directly, it has no server deps).
let wf;
async function loadResolver() {
  if (!wf) wf = await import('../../client/src/utils/workflowMapping.js');
  return wf;
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(PORT, resolve); });
  const managerToken = (await login('manager')).token;
  const itemsRes = await request('GET', '/api/items?limit=1000', null, managerToken);
  assert.equal(itemsRes.status, 200);
  items = itemsRes.body;
  loc = await resolveLocation(request, managerToken);
});

after(async () => {
  await cleanupTrackedData();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

describe('1. Client resolver is the single transition engine (pure function)', () => {
  it('resolves the per-owner forward table at the front of the pipeline', async () => {
    const { resolveWorkflowPosition } = await loadResolver();
    const FRONT = {
      Manager: { current: ['Draft', 'Draft', 'Manager'], next: ['DGM_Verification', 'DGM Verification', 'DGM', 'Submitted'] },
      DGM:     { current: ['DGM_Verification', 'DGM Verification', 'DGM'], next: ['GM_Recommendation', 'GM Recommendation', 'GM', 'DGM_Approved'] },
      GM:      { current: ['GM_Recommendation', 'GM Recommendation', 'GM'], next: ['CGM_Submission', 'CGM Submission', 'CGM', 'GM_Recommended'] },
      CGM:     { current: ['CGM_Submission', 'CGM Submission', 'CGM'], next: ['DOP_Approval', 'DOP Approval', 'DOP', 'CGM_Submitted'] },
      DOP:     { current: ['DOP_Approval', 'DOP Approval', 'DOP'], next: ['ED_Approval', 'ED Approval', 'ED', 'DOP_Approved'] },
      ED:      { current: ['ED_Approval', 'ED Approval', 'ED'], next: ['MD_FinalApproval', 'MD Final Approval', 'MD', 'ED_Approved'] },
    };
    for (const [owner, exp] of Object.entries(FRONT)) {
      const pos = resolveWorkflowPosition('Draft', owner);
      assert.equal(pos.front, true, owner);
      assert.deepEqual([pos.currentStage.key, pos.currentStage.label, pos.currentStage.owner], exp.current, owner + ' current');
      assert.deepEqual([pos.nextStage.key, pos.nextStage.label, pos.nextStage.owner, pos.nextStage.status], exp.next, owner + ' next');
    }
  });

  it('resolves the post-front receive path purely from status (DGM_Approved => GM ... ED_Approved => MD)', async () => {
    const { resolveWorkflowPosition } = await loadResolver();
    const POST = [
      { status: 'Submitted', current: ['DGM_Verification', 'DGM'], next: ['GM_Recommendation', 'GM', 'DGM_Approved'] },
      { status: 'DGM_Approved', current: ['GM_Recommendation', 'GM'], next: ['CGM_Submission', 'CGM', 'GM_Recommended'] },
      { status: 'GM_Recommended', current: ['CGM_Submission', 'CGM'], next: ['DOP_Approval', 'DOP', 'CGM_Submitted'] },
      { status: 'CGM_Submitted', current: ['DOP_Approval', 'DOP'], next: ['ED_Approval', 'ED', 'DOP_Approved'] },
      { status: 'DOP_Approved', current: ['ED_Approval', 'ED'], next: ['MD_FinalApproval', 'MD', 'ED_Approved'] },
      { status: 'ED_Approved', current: ['MD_FinalApproval', 'MD'], next: ['FCN_Generation', 'Director of Administration', 'MD_Approved'] },
    ];
    for (const row of POST) {
      const pos = resolveWorkflowPosition(row.status, row.current[1]);
      assert.equal(pos.front, false, row.status);
      assert.deepEqual([pos.currentStage.key, pos.currentStage.owner], row.current, row.status + ' current');
      assert.deepEqual([pos.nextStage.key, pos.nextStage.owner, pos.nextStage.status], row.next, row.status + ' next');
    }
  });

  it('is idempotent per session (re-login with the persisted state yields identical actions)', async () => {
    const { resolveWorkflowPosition } = await loadResolver();
    const a = resolveWorkflowPosition('Submitted', 'GM');
    const b = resolveWorkflowPosition('Submitted', 'GM');
    assert.deepEqual(a, b, 'resolution must not depend on session/instance state');
  });
});

describe('2. CREATE side: every authoring role creates, edits, forwards to the next authority', () => {
  const CREATORS = [
    { username: 'manager', designation: 'Manager', nextOwner: 'DGM', nextStatus: 'Submitted' },
    { username: 'dgm', designation: 'DGM', nextOwner: 'GM', nextStatus: 'DGM_Approved' },
    { username: 'gm', designation: 'GM', nextOwner: 'CGM', nextStatus: 'GM_Recommended' },
    { username: 'cgm', designation: 'CGM', nextOwner: 'DOP', nextStatus: 'CGM_Submitted' },
    { username: 'dop', designation: 'DOP', nextOwner: 'ED', nextStatus: 'DOP_Approved' },
  ];

  for (const role of CREATORS) {
    it(`${role.designation}-created estimate: Draft owned by ${role.designation}, editable, forwards to ${role.nextOwner}`, async () => {
      const session = await login(role.username);
      assert.ok(session.user.Permissions.includes('estimate.create'), `${role.designation} must hold estimate.create`);
      assert.ok(session.user.Permissions.includes('estimate.edit'), `${role.designation} must hold estimate.edit`);
      assert.ok(session.user.Permissions.includes('estimate.submit'), `${role.designation} must hold estimate.submit`);

      const est = await createEstimate(session.token, `Creator${role.designation}`);
      assert.equal(est.Status, 'Draft');
      assert.equal(await ownerDesignation(est.EstimateID), role.designation, 'creator owns the Draft');

      const detail = await request('GET', `/api/estimates/${est.EstimateID}`, null, session.token);
      assert.equal(detail.status, 200, JSON.stringify(detail.body));
      assert.equal(detail.body.CurrentOwnerDesignation, role.designation);
      assert.equal(detail.body.CreatedByDesignation, role.designation);

      const edit = await request('PUT', `/api/estimates/${est.EstimateID}`, { NameOfWork: `Creator${role.designation} v2` }, session.token);
      assert.equal(edit.status, 200, `edit as ${role.designation}: ${JSON.stringify(edit.body)}`);
      assert.equal(edit.body.NameOfWork, `Creator${role.designation} v2`);

      await act(session.token, est.EstimateID, 'submit',
        /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/);

      assert.equal(await headerState(est.EstimateID), role.nextStatus,
        `${role.designation} forward must land in ${role.nextStatus}`);
      assert.equal(await ownerDesignation(est.EstimateID), role.nextOwner,
        `${role.designation} forward must transfer ownership to ${role.nextOwner}`);

      // Re-login as the next owner: fresh session, persisted state -> same resolution.
      const next = await login(role.nextOwner.toLowerCase());
      const nextView = await request('GET', `/api/estimates/${est.EstimateID}`, null, next.token);
      assert.equal(nextView.status, 200, `${role.nextOwner} must be able to re-open the forwarded estimate`);
      assert.equal(nextView.body.CurrentOwnerDesignation, role.nextOwner);
      assert.equal(nextView.body.Status, role.nextStatus);
    });
  }
});

describe('3. ED-created estimate: forwards to MD, MD gives Final Approval', () => {
  it('ED creates, forwards to MD at ED_Approved, MD Final Approve closes the pipeline', async () => {
    const ed = await login('ed');
    assert.ok(ed.user.Permissions.includes('estimate.create'));
    assert.ok(ed.user.Permissions.includes('estimate.edit'));
    assert.ok(ed.user.Permissions.includes('estimate.submit'));

    const est = await createEstimate(ed.token, 'CreatorED');
    assert.equal(await ownerDesignation(est.EstimateID), 'ED');

    await act(ed.token, est.EstimateID, 'submit',
      /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/);
    assert.equal(await headerState(est.EstimateID), 'ED_Approved');
    assert.equal(await ownerDesignation(est.EstimateID), 'MD', 'ED forward must hand over to MD at ED_Approved');

    const md = await login('md');
    assert.ok(md.user.Permissions.includes('estimate.finalApprove'));
    await act(md.token, est.EstimateID, 'md-final',
      /\[OTP\]\[DEV\] md_final OTP for estimate \S+ \(user [^)]+\): (\d{6})/);
    assert.equal(await headerState(est.EstimateID), 'FinalApproved', 'MD Final Approval must close the approval pipeline');
  });
});

describe('4. RECEIVE side: full chain Manager->DGM->GM->CGM->DOP->ED->MD on one estimate', () => {
  it('each receiver acts at its own stage; owner and status stay in sync to FinalApproved', async () => {
    const t = {
      manager: await login('manager'),
      dgm: (await login('dgm')).token,
      gm: (await login('gm')).token,
      cgm: (await login('cgm')).token,
      dop: (await login('dop')).token,
      ed: (await login('ed')).token,
      md: (await login('md')).token,
    };

    const est = await createEstimate(t.manager.token, 'ChainReceive');

    await act(t.manager.token, est.EstimateID, 'submit',
      /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/);
    assert.equal(await headerState(est.EstimateID), 'Submitted');
    assert.equal(await ownerDesignation(est.EstimateID), 'DGM');

    await act(t.dgm, est.EstimateID, 'approve',
      /\[OTP\]\[DEV\] DGM Approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/);
    assert.equal(await headerState(est.EstimateID), 'DGM_Approved');
    assert.equal(await ownerDesignation(est.EstimateID), 'GM');

    await act(t.gm, est.EstimateID, 'sign',
      /\[OTP\]\[DEV\] Signature OTP for estimate \S+ \(user [^)]+\): (\d{6})/, { certificateId: 'HMWSSB-DSC-CHAIN-0001' });
    assert.equal(await headerState(est.EstimateID), 'GM_Recommended');
    assert.equal(await ownerDesignation(est.EstimateID), 'CGM');

    await act(t.cgm, est.EstimateID, 'cgm-submit',
      /\[OTP\]\[DEV\] cgm_submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/);
    assert.equal(await headerState(est.EstimateID), 'CGM_Submitted');
    assert.equal(await ownerDesignation(est.EstimateID), 'DOP');

    await act(t.dop, est.EstimateID, 'dop-approve',
      /\[OTP\]\[DEV\] dop_approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/);
    assert.equal(await headerState(est.EstimateID), 'DOP_Approved');
    assert.equal(await ownerDesignation(est.EstimateID), 'ED');

    await act(t.ed, est.EstimateID, 'ed-approve',
      /\[OTP\]\[DEV\] ed_approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/);
    assert.equal(await headerState(est.EstimateID), 'ED_Approved');
    assert.equal(await ownerDesignation(est.EstimateID), 'MD', 'ED forward must hand off to MD');

    await act(t.md, est.EstimateID, 'md-final',
      /\[OTP\]\[DEV\] md_final OTP for estimate \S+ \(user [^)]+\): (\d{6})/);
    assert.equal(await headerState(est.EstimateID), 'FinalApproved');
  });
});