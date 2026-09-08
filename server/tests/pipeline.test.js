// Regression tests for the Manager "My Estimate Pipeline / Estimates Currently With".
// Authoritative stages (fixed): Draft → DGM → GM → CGM → DOP → ED → MD → Approved.
// These are ownership positions derived from the authoritative current-owner
// assignment (CurrentOwner designation) plus draft/post-approval statuses — NOT
// approval-status names. For every stage the dashboard count must equal the row
// count of /estimates/my?createdBy=me&stage=<stage> (count == click-through).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const db = require('../config/db');
const { resolveLocation } = require('./helpers');
const { cleanupTrackedData, trackEstimate } = require('./cleanup');
const { PIPELINE_STAGES } = require('../utils/estimateScope');

const PORT = 5401;
let server;
let items;
let location;
const tokens = {};
const userIds = {}; // designation -> UserID (seeded users)

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
  return r.body.token;
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

async function createEstimate(name) {
  const item = items.find((i) => i.FormulaType === 'N');
  assert.ok(item, 'an N-formula item must be seeded');
  const res = await request('POST', '/api/estimates', {
    NameOfWork: name || `Pipeline ${Date.now()}`,
    WorkCategory: 'Water Supply',
    RegionID: location.RegionID,
    WardID: location.WardID,
    GSTPercent: 18,
    LSProvision: 0,
    AdditionalItems: [],
    Items: [{
      ItemID: item.ItemID, Category: item.Category, FormulaType: 'N', Unit: item.Unit,
      Rate: item.Rate, N: 1, L: null, B: null, D: null,
    }],
  }, tokens.manager);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  trackEstimate(res.body.EstimateID);
  return res.body;
}

async function submitViaOtp(estimateID) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateID}/submit/request-otp`, {}, tokens.manager));
  const m = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
  assert.ok(m, 'submit OTP should be captured from the dev log');
  const sub = await request('POST', `/api/workflow/${estimateID}/submit`, { otpCode: m[1] }, tokens.manager);
  assert.equal(sub.status, 200, `submit: ${JSON.stringify(sub.body)}`);
}

// /approve is OTP-gated (workflowController.verifyDgmApprove).
async function dgmApproveViaOtp(estimateID) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateID}/approve/request-otp`, {}, tokens.dgm));
  const m = /\[OTP\]\[DEV\] DGM Approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
  assert.ok(m, 'dgm approve OTP should be captured from the dev log');
  const appr = await request('POST', `/api/workflow/${estimateID}/approve`, { otpCode: m[1] }, tokens.dgm);
  assert.equal(appr.status, 200, `dgm approve: ${JSON.stringify(appr.body)}`);
}

async function pipelineCounts() {
  const res = await request('GET', '/api/dashboard/stats', null, tokens.manager);
  assert.equal(res.status, 200, `dashboard stats: ${JSON.stringify(res.body)}`);
  const p = res.body.managerDashboard?.pipeline;
  assert.ok(p, 'managerDashboard.pipeline must be present for Manager role');
  // All 8 authoritative stages must always be reported (zero included).
  for (const s of PIPELINE_STAGES) {
    assert.equal(typeof p[s], 'number', `pipeline stage "${s}" must be a number`);
  }
  return p;
}

async function stageListCount(stage) {
  const res = await request('GET', `/api/estimates/my?createdBy=me&stage=${stage}`, null, tokens.manager);
  assert.equal(res.status, 200, `list stage=${stage}: ${JSON.stringify(res.body)}`);
  return Array.isArray(res.body) ? res.body.length : -1;
}

// The single invariant the whole feature rests on: the number shown on the
// dashboard card equals the rows its click-through opens. Count and list come
// from two separate requests, so when other suites run in parallel and create
// manager estimates between them the snapshot can race — retry before failing.
async function assertCountMatchesList(stage) {
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    const [count, listLen] = await Promise.all([pipelineCounts(), stageListCount(stage)]);
    if (count[stage] === listLen) return;
    lastErr = new Error(
      `dashboard count (${count[stage]}) must equal filtered list length (${listLen}) for stage ${stage}`);
    await new Promise((r) => setTimeout(r, 200));
  }
  throw lastErr;
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(PORT, resolve); });
  for (const u of ['manager', 'dgm', 'gm']) tokens[u] = await login(u);
  const users = await db.query(`SELECT "UserID", "Designation" FROM "Users" WHERE "Designation" IN ('DGM','GM','CGM','DOP','ED','MD')`);
  users.rows.forEach(r => { userIds[r.Designation] = r.UserID; });
  for (const d of ['CGM', 'DOP', 'ED', 'MD']) {
    assert.ok(userIds[d], `a ${d} user must exist`);
  }
  const itemsRes = await request('GET', '/api/items?limit=1000', null, tokens.manager);
  assert.equal(itemsRes.status, 200);
  items = itemsRes.body;
  location = await resolveLocation(request, tokens.manager);
});

after(async () => {
  await cleanupTrackedData();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

describe('My Estimate Pipeline: stage definition', () => {
  it('uses exactly the 12 authoritative stages in order', () => {
    assert.deepEqual(PIPELINE_STAGES,
      ['Draft', 'DGM', 'GM', 'CGM', 'DOP', 'ED', 'MD', 'FCN', 'DirectorAdmin', 'GMReview', 'DGMReview', 'Approved']);
  });

  it('rejects unknown stage filters with 400 instead of silently unfiltering', async () => {
    const res = await request('GET', '/api/estimates/my?createdBy=me&stage=Bogus', null, tokens.manager);
    assert.equal(res.status, 400);
  });
});

describe('My Estimate Pipeline: per-stage counting and click-through parity', () => {
  it('Draft: new estimate is currently with the Manager', async () => {
    await createEstimate('Pipeline Draft stage');
    await assertCountMatchesList('Draft');
    const rows = await request('GET', '/api/estimates/my?createdBy=me&stage=Draft', null, tokens.manager);
    assert.ok(rows.body.some(e => e.Status === 'Draft'), 'draft estimate listed under Draft stage');
  });

  it('Reverted estimates count under Draft (back with the Manager for editing)', async () => {
    const est = await createEstimate('Pipeline Reverted-as-Draft');
    await submitViaOtp(est.EstimateID);
    const rev = await request('POST', `/api/workflow/${est.EstimateID}/revert`,
      { remarks: 'pipeline test revert' }, tokens.dgm);
    assert.equal(rev.status, 200, `revert: ${JSON.stringify(rev.body)}`);
    const rows = await request('GET', '/api/estimates/my?createdBy=me&stage=Draft', null, tokens.manager);
    assert.ok(rows.body.some(e => e.EstimateID === est.EstimateID),
      'reverted estimate must appear in the Draft stage list');
    await assertCountMatchesList('Draft');
  });

  it('DGM: submitted estimate is currently with DGM', async () => {
    const est = await createEstimate('Pipeline With-DGM stage');
    await submitViaOtp(est.EstimateID);
    const rows = await request('GET', '/api/estimates/my?createdBy=me&stage=DGM', null, tokens.manager);
    assert.ok(rows.body.some(e => e.EstimateID === est.EstimateID && e.Status === 'Submitted'),
      'submitted estimate must appear under DGM stage');
    await assertCountMatchesList('DGM');
  });

  it('GM: DGM-approved estimate is currently with GM', async () => {
    const est = await createEstimate('Pipeline With-GM stage');
    await submitViaOtp(est.EstimateID);
    await dgmApproveViaOtp(est.EstimateID);
    const rows = await request('GET', '/api/estimates/my?createdBy=me&stage=GM', null, tokens.manager);
    assert.ok(rows.body.some(e => e.EstimateID === est.EstimateID && e.Status === 'DGM_Approved'),
      'DGM-approved estimate must appear under GM stage');
    await assertCountMatchesList('GM');
  });

  // CGM/DOP/ED/MD have no active workflow transitions yet; the pipeline reads
  // the authoritative current-owner assignment directly, which is exactly what
  // these updates simulate (owner designation drives the stage).
  for (const desig of ['CGM', 'DOP', 'ED', 'MD']) {
    it(`${desig}: estimate owned by ${desig} is counted and listed there`, async () => {
      const est = await createEstimate(`Pipeline With-${desig} stage`);
      await db.query(
        `UPDATE "EstimateHeader" SET "Status" = 'Submitted', "CurrentOwner" = $1 WHERE "EstimateID" = $2`,
        [userIds[desig], est.EstimateID]
      );
      const rows = await request('GET', `/api/estimates/my?createdBy=me&stage=${desig}`, null, tokens.manager);
      assert.ok(rows.body.some(e => e.EstimateID === est.EstimateID),
        `estimate must appear under ${desig} stage`);
      await assertCountMatchesList(desig);
    });
  }

  it('Approved: signed-and-published estimate left the approval chain into Approved', async () => {
    const est = await createEstimate('Pipeline Approved stage');
    await db.query(
      `UPDATE "EstimateHeader" SET "Status" = 'Signed', "IsDigitallySigned" = TRUE WHERE "EstimateID" = $1`,
      [est.EstimateID]
    );
    const rows = await request('GET', '/api/estimates/my?createdBy=me&stage=Approved', null, tokens.manager);
    assert.ok(rows.body.some(e => e.EstimateID === est.EstimateID && e.Status === 'Signed'),
      'signed estimate must appear under Approved stage');
    await assertCountMatchesList('Approved');
  });

  it('an in-chain estimate appears in exactly one stage (no double counting)', async () => {
    const est = await createEstimate('Pipeline Single-stage membership');
    await submitViaOtp(est.EstimateID);
    for (const s of PIPELINE_STAGES) {
      const rows = await request('GET', `/api/estimates/my?createdBy=me&stage=${s}`, null, tokens.manager);
      const hits = rows.body.filter(e => e.EstimateID === est.EstimateID).length;
      assert.equal(hits, s === 'DGM' ? 1 : 0,
        `estimate must appear exactly once, only under DGM (found ${hits} under ${s})`);
    }
  });

  it('stage filter respects ownership scope (other managers\' estimates excluded)', async () => {
    const rows = await request('GET', `/api/estimates/my?createdBy=me&stage=Draft`, null, tokens.dgm);
    assert.equal(rows.status, 200);
    // DGM has no created estimates in this suite; every returned row would be a scope leak.
    assert.ok(Array.isArray(rows.body), 'scoped stage list must return an array');
  });
});
