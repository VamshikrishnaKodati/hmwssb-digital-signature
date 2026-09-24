// Regression tests for dashboard fix 6.3: modules.worksInProgress must be driven
// by the authoritative EstimateHeader status ('WorkStarted'), never by whether a
// progress row is below 100%. A completed work that keeps stale sub-100% progress
// rows must not be counted.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const db = require('../config/db');
const { resolveLocation } = require('./helpers');
const { cleanupTrackedData, trackEstimate } = require('./cleanup');

const PORT = 5399;
let server;
let items;
let location;
const tokens = {};

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
    NameOfWork: name || `Dashboard ${Date.now()}`,
    WorkCategory: 'Water Supply',
    RegionID: location.RegionID,
    WardID: location.WardID,
    GSTPercent: 18,
    LSProvision: 0,
    AdditionalItems: [],
    Items: [{
      ItemID: item.ItemID, Category: item.Category, FormulaType: 'N', Unit: item.Unit,
      Rate: item.Rate, N: 2, L: null, B: null, D: null,
    }],
  }, tokens.manager);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  trackEstimate(res.body.EstimateID);
  return res.body;
}

// Drives a draft estimate through the whole workflow to WorkStarted.
async function driveToStarted(estimateID) {
  const { captured: submitCap } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateID}/submit/request-otp`, {}, tokens.manager));
  const submitM = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(submitCap);
  assert.ok(submitM, 'submit OTP should be captured from the dev log');
  const sub = await request('POST', `/api/workflow/${estimateID}/submit`, { otpCode: submitM[1] }, tokens.manager);
  assert.equal(sub.status, 200, `submit: ${JSON.stringify(sub.body)}`);

  // DGM approval is OTP-gated (workflowController.verifyDgmApprove).
  const { captured: apprCap } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateID}/approve/request-otp`, {}, tokens.dgm));
  const apprM = /\[OTP\]\[DEV\] DGM Approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(apprCap);
  assert.ok(apprM, 'dgm approve OTP should be captured from the dev log');
  const appr = await request('POST', `/api/workflow/${estimateID}/approve`, { otpCode: apprM[1] }, tokens.dgm);
  assert.equal(appr.status, 200, `approve: ${JSON.stringify(appr.body)}`);

  const { result, captured } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + estimateID + '/sign/request-otp', {}, tokens.gm));
  assert.equal(result.status, 200, `request-otp: ${JSON.stringify(result.body)}`);
  const m = /\[OTP\]\[DEV\] Signature OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
  assert.ok(m, 'OTP should be captured from the dev log');
  const sign = await request('POST', `/api/workflow/${estimateID}/sign`,
    { otpCode: m[1], certificateId: `HMWSSB-DSC-DASH-${estimateID}` }, tokens.gm);
  assert.equal(sign.status, 200, `sign: ${JSON.stringify(sign.body)}`);

  const { captured: cgmCap } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateID}/cgm-submit/request-otp`, {}, tokens.cgm));
  const cgmM = /\[OTP\]\[DEV\] cgm_submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(cgmCap);
  assert.ok(cgmM, 'CGM submit OTP should be captured');
  const cgm = await request('POST', `/api/workflow/${estimateID}/cgm-submit`, { otpCode: cgmM[1] }, tokens.cgm);
  assert.equal(cgm.status, 200, `cgm-submit: ${JSON.stringify(cgm.body)}`);

  const { captured: dopCap } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + estimateID + '/dop-approve/request-otp', {}, tokens.dop));
  const dopM = /\[OTP\]\[DEV\] dop_approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(dopCap);
  assert.ok(dopM, 'DOP approve OTP should be captured');
  const dop = await request('POST', `/api/workflow/${estimateID}/dop-approve`, { otpCode: dopM[1] }, tokens.dop);
  assert.equal(dop.status, 200, `dop-approve: ${JSON.stringify(dop.body)}`);

  const { captured: edCap } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + estimateID + '/ed-approve/request-otp', {}, tokens.ed));
  const edM = /\[OTP\]\[DEV\] ed_approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(edCap);
  assert.ok(edM, 'ED approve OTP should be captured');
  const ed = await request('POST', `/api/workflow/${estimateID}/ed-approve`, { otpCode: edM[1] }, tokens.ed);
  assert.equal(ed.status, 200, `ed-approve: ${JSON.stringify(ed.body)}`);

  const { captured: mdCap } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateID}/md-final/request-otp`, {}, tokens.md));
  const mdM = /\[OTP\]\[DEV\] md_final OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(mdCap);
  assert.ok(mdM, 'MD final OTP should be captured');
  const md = await request('POST', `/api/workflow/${estimateID}/md-final`, { otpCode: mdM[1] }, tokens.md);
  assert.equal(md.status, 200, `md-final: ${JSON.stringify(md.body)}`);

  const fcn = await request('POST', `/api/workflow/${estimateID}/generate-fcn`, {}, tokens.director_admin);
  assert.equal(fcn.status, 200, `generate-fcn: ${JSON.stringify(fcn.body)}`);

  const sanction = await request('POST', `/api/workflow/${estimateID}/generate-admin-sanction`, { sanctionNo: `AS-DASH-${estimateID}` }, tokens.director_admin);
  assert.equal(sanction.status, 200, `generate-sanction: ${JSON.stringify(sanction.body)}`);

  const assign = await request('POST', `/api/workflow/${estimateID}/assign-ts-authority`, { AuthorityRole: 'GM' }, tokens.director_admin);
  assert.equal(assign.status, 200, `assign-ts-authority: ${JSON.stringify(assign.body)}`);

  const approve = await request('POST', `/api/workflow/${estimateID}/approve-ts`, { remarks: 'TS approved' }, tokens.gm);
  assert.equal(approve.status, 200, `approve-ts: ${JSON.stringify(approve.body)}`);

  const publish = await request('POST', `/api/workflow/${estimateID}/publish-tender`, {}, tokens.tender_officer);
  assert.equal(publish.status, 200, `publish-tender: ${JSON.stringify(publish.body)}`);

  const agency = await request('POST', '/api/agency', {
    EstimateID: estimateID,
    AgencyName: `Dash Agency ${estimateID}`,
    AgencyCode: `AGY-DASH-${estimateID}`,
    AgreementNo: `AGT-DASH-${estimateID}`,
    AgreementDate: new Date().toISOString().slice(0, 10),
    TenderValue: 1000000,
    CompletionPeriod: '6 months',
    SecurityDeposit: 50000,
    PerformanceGuarantee: 100000,
    ContractorName: 'Dash Contractor',
    ContactDetails: 'dash@test',
    WorkOrderNo: 'WO-DASH-001', WorkOrderDate: new Date().toISOString().slice(0, 10),
  }, tokens.director_admin);
  assert.equal(agency.status, 201, `agency: ${JSON.stringify(agency.body)}`);

  const select = await request('POST', `/api/workflow/${estimateID}/select-agency`, {}, tokens.director_admin);
  assert.equal(select.status, 200, `select-agency: ${JSON.stringify(select.body)}`);

  const start = await request('POST', `/api/workflow/${estimateID}/start-work`, {}, tokens.site_engineer);
  assert.equal(start.status, 200, `start-work: ${JSON.stringify(start.body)}`);
}

async function addProgress(estimateID, percentage, stage) {
  const res = await request('POST', '/api/progress', {
    EstimateID: estimateID,
    Stage: stage || `Stage ${percentage}`,
    Percentage: percentage,
    Remarks: `dashboard test ${percentage}%`,
  }, tokens.site_engineer);
  assert.equal(res.status, 201, `progress: ${JSON.stringify(res.body)}`);
}

async function worksInProgress() {
  const res = await request('GET', '/api/dashboard/stats', null, tokens.admin_officer);
  assert.equal(res.status, 200, `dashboard: ${JSON.stringify(res.body)}`);
  return res.body.modules.worksInProgress;
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(PORT, resolve); });
  for (const u of ['manager', 'dgm', 'gm', 'cgm', 'dop', 'ed', 'md', 'tender_officer', 'site_engineer', 'admin_officer', 'finance_head', 'director_admin']) {
    tokens[u] = await login(u);
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

describe('Dashboard: worksInProgress honours header status (6.3)', () => {
  it('counts an active work with a 50% progress row', async () => {
    const before = await worksInProgress();
    const est = await createEstimate('6.3 Active 50%');
    await driveToStarted(est.EstimateID);
    await addProgress(est.EstimateID, 50, 'Foundation');
    const after = await worksInProgress();
    assert.ok(after >= before + 1,
      `active work must be counted (before=${before}, after=${after})`);
  });

  it('still counts the active work after its progress reaches 100%', async () => {
    const before = await worksInProgress();
    const est = await createEstimate('6.3 Active 100%');
    await driveToStarted(est.EstimateID);
    await addProgress(est.EstimateID, 100, 'Commissioning');
    const after = await worksInProgress();
    assert.ok(after >= before + 1,
      `100% progress alone must not leave the work queue (before=${before}, after=${after})`);
  });

  it('does not count a completed work even with a 100% progress row', async () => {
    const before = await worksInProgress();
    const est = await createEstimate('6.3 Completed 100%');
    await driveToStarted(est.EstimateID);
    await addProgress(est.EstimateID, 100, 'Testing');
    await request('POST', `/api/workflow/${est.EstimateID}/complete-work`, {}, tokens.site_engineer);
    const after = await worksInProgress();
    assert.ok(after <= before,
      `WorkCompleted estimate must leave the queue (before=${before}, after=${after})`);
  });

  it('does not count a completed work that keeps stale sub-100% progress rows', async () => {
    const est = await createEstimate('6.3 Defect: stale 50%');
    await driveToStarted(est.EstimateID);
    await addProgress(est.EstimateID, 50, 'Foundation');
    const mid = await worksInProgress();
    assert.ok(mid >= 1, 'work is in progress at this point');
    await request('POST', `/api/workflow/${est.EstimateID}/complete-work`, {}, tokens.site_engineer);
    const end = await worksInProgress();
    assert.ok(end < mid,
      `completing the work must drop it from the queue (mid=${mid}, end=${end})`);
  });

  it('counts a work once even with multiple progress records', async () => {
    const before = await worksInProgress();
    const est = await createEstimate('6.3 Multi progress');
    await driveToStarted(est.EstimateID);
    await addProgress(est.EstimateID, 25, 'Excavation');
    await addProgress(est.EstimateID, 50, 'Masonry');
    await addProgress(est.EstimateID, 75, 'Piping');
    const after = await worksInProgress();
    assert.ok(after >= before + 1,
      `work must be counted exactly once regardless of progress rows (before=${before}, after=${after})`);
  });

  it('dashboard value always equals the authoritative WorkStarted header count', async () => {
    const viaApi = await worksInProgress();
    const { rows } = await db.query(
      'SELECT COUNT(*)::int AS n FROM "EstimateHeader" WHERE "Status" = \'WorkStarted\''
    );
    assert.equal(viaApi, rows[0].n,
      `modules.worksInProgress (${viaApi}) must match WorkStarted headers (${rows[0].n})`);
  });
});
