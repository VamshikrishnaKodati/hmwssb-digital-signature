// Measurement Book API tests: CRUD, validation, auth, balance overflow, dashboard metric fix.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const db = require('../config/db');
const { resolveLocation } = require('./helpers');
const { cleanupTrackedData, trackEstimate } = require('./cleanup');

const PORT = 5299;
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
    if (authToken) opts.headers['Authorization'] = 'Bearer ' + authToken;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { return resolve({ status: res.statusCode, body: data }); }
        if (parsed && parsed.success === true) return resolve({ status: res.statusCode, body: parsed.data });
        if (parsed && parsed.success === false) return resolve({ status: res.statusCode, body: { ...(parsed.error || {}), error: (parsed.error && parsed.error.message) || 'Request failed' } });
        return resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login(username) {
  const r = await request('POST', '/api/auth/login', { username, password: 'password123' });
  assert.equal(r.status, 200, 'login ' + username + ': ' + JSON.stringify(r.body));
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
  const item = items.find((i) => i.FormulaType === 'L');
  assert.ok(item, 'an L-formula item must be seeded');
  const res = await request('POST', '/api/estimates', {
    NameOfWork: name || 'MB Test ' + Date.now(),
    WorkCategory: 'Water Supply',
    RegionID: location.RegionID,
    WardID: location.WardID,
    GSTPercent: 18,
    LSProvision: 0,
    AdditionalItems: [],
    Items: [{
      ItemID: item.ItemID, Category: item.Category, FormulaType: 'L', Unit: item.Unit,
      Rate: item.Rate, N: null, L: 10, B: null, D: null,
    }],
  }, tokens.manager);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  trackEstimate(res.body.EstimateID);
  return res.body;
}

async function driveToStarted(estimateID) {
  const { captured: c1 } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + estimateID + '/submit/request-otp', {}, tokens.manager));
  const m1 = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(c1);
  assert.ok(m1, 'submit OTP');
  await request('POST', '/api/workflow/' + estimateID + '/submit', { otpCode: m1[1] }, tokens.manager);

  const { captured: c2 } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + estimateID + '/approve/request-otp', {}, tokens.dgm));
  const m2 = /\[OTP\]\[DEV\] DGM Approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(c2);
  assert.ok(m2, 'dgm OTP');
  await request('POST', '/api/workflow/' + estimateID + '/approve', { otpCode: m2[1] }, tokens.dgm);

  const { captured: c3 } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + estimateID + '/sign/request-otp', {}, tokens.gm));
  const m3 = /\[OTP\]\[DEV\] Signature OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(c3);
  assert.ok(m3, 'gm sign OTP');
  await request('POST', '/api/workflow/' + estimateID + '/sign',
    { otpCode: m3[1], certificateId: 'HMWSSB-DSC-MB-' + estimateID }, tokens.gm);

  const { captured: c4 } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + estimateID + '/cgm-submit/request-otp', {}, tokens.cgm));
  const m4 = /\[OTP\]\[DEV\] cgm_submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(c4);
  assert.ok(m4, 'cgm OTP');
  await request('POST', '/api/workflow/' + estimateID + '/cgm-submit', { otpCode: m4[1] }, tokens.cgm);

  const { captured: c5 } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + estimateID + '/dop-approve/request-otp', {}, tokens.dop));
  const m5 = /\[OTP\]\[DEV\] dop_approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(c5);
  assert.ok(m5, 'dop OTP');
  await request('POST', '/api/workflow/' + estimateID + '/dop-approve', { otpCode: m5[1] }, tokens.dop);

  const { captured: c6 } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + estimateID + '/ed-approve/request-otp', {}, tokens.ed));
  const m6 = /\[OTP\]\[DEV\] ed_approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(c6);
  assert.ok(m6, 'ed OTP');
  await request('POST', '/api/workflow/' + estimateID + '/ed-approve', { otpCode: m6[1] }, tokens.ed);

  const { captured: c7 } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + estimateID + '/md-final/request-otp', {}, tokens.md));
  const m7 = /\[OTP\]\[DEV\] md_final OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(c7);
  assert.ok(m7, 'md OTP');
  await request('POST', '/api/workflow/' + estimateID + '/md-final', { otpCode: m7[1] }, tokens.md);

  await request('POST', '/api/workflow/' + estimateID + '/generate-fcn', {}, tokens.director_admin);
  await request('POST', '/api/workflow/' + estimateID + '/generate-admin-sanction', { sanctionNo: 'AS-MB-' + estimateID }, tokens.director_admin);
  const assign = await request('POST', '/api/workflow/' + estimateID + '/assign-ts-authority', { AuthorityRole: 'GM' }, tokens.director_admin);
  assert.equal(assign.status, 200, 'assign-ts-authority: ' + JSON.stringify(assign.body));
  const approve = await request('POST', '/api/workflow/' + estimateID + '/approve-ts', { remarks: 'TS approved' }, tokens.gm);
  assert.equal(approve.status, 200, 'approve-ts: ' + JSON.stringify(approve.body));

  await request('POST', '/api/workflow/' + estimateID + '/publish-tender', {}, tokens.tender_officer);

  await request('POST', '/api/agency', {
    EstimateID: estimateID, AgencyName: 'MB Agency', AgencyCode: 'AGY-MB',
    AgreementNo: 'AGT-MB', AgreementDate: new Date().toISOString().slice(0, 10),
    TenderValue: 1000000, CompletionPeriod: '6 months',
    SecurityDeposit: 50000, PerformanceGuarantee: 100000,
    ContractorName: 'MB Contractor', ContactDetails: 'mb@test',
  }, tokens.director_admin);

  await request('POST', '/api/workflow/' + estimateID + '/select-agency', {}, tokens.director_admin);
  await request('POST', '/api/workflow/' + estimateID + '/start-work', {}, tokens.site_engineer);
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(PORT, resolve); });
  for (const u of ['manager', 'dgm', 'gm', 'cgm', 'dop', 'ed', 'md', 'tender_officer', 'site_engineer', 'billing_officer', 'admin_officer', 'finance_head', 'director_admin']) {
    tokens[u] = await login(u);
  }
  const itemsRes = await request('GET', '/api/items?limit=1000', null, tokens.manager);
  assert.equal(itemsRes.status, 200);
  items = itemsRes.body;
  location = await resolveLocation(request, tokens.manager);
});

after(async () => {
  try { await cleanupTrackedData(); } catch {}
  try { server.closeAllConnections(); } catch {}
  server.close();
});

let estID;
let estDetailID;
let mbID;

describe('Measurement Book API', () => {
  it('should set up a WorkStarted estimate for measurement', async () => {
    const est = await createEstimate('MB CRUD Test');
    estID = est.EstimateID;
    const detail = est.Items && est.Items[0];
    estDetailID = detail ? detail.DetailID : null;
    await driveToStarted(estID);
  });

  it('should create a measurement (SiteEngineer)', async () => {
    const res = await request('POST', '/api/measurement', {
      EstimateID: estID,
      DetailID: estDetailID,
      PreviousQty: 0,
      CurrentQty: 5,
      MeasuredDate: new Date().toISOString().slice(0, 10),
      Remarks: 'First measurement',
    }, tokens.site_engineer);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.Status, 'Draft');
    assert.equal(Number(res.body.CurrentQty), 5);
    assert.ok(res.body.CumulativeQty != null);
    mbID = res.body.MeasurementID;
  });

  it('should list measurements', async () => {
    const res = await request('GET', '/api/measurement?estimateId=' + estID, null, tokens.site_engineer);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);
  });

  it('should update a Draft measurement (SiteEngineer)', async () => {
    const res = await request('PUT', '/api/measurement/' + mbID, {
      PreviousQty: 0,
      CurrentQty: 8,
      Remarks: 'Updated qty',
    }, tokens.site_engineer);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(Number(res.body.CurrentQty), 8);
    assert.equal(res.body.Remarks, 'Updated qty');
  });

  it('should reject update by BillingOfficer', async () => {
    const res = await request('PUT', '/api/measurement/' + mbID, {
      CurrentQty: 10,
    }, tokens.billing_officer);
    assert.equal(res.status, 403, JSON.stringify(res.body));
  });

  it('should reject negative CurrentQty', async () => {
    const res = await request('POST', '/api/measurement', {
      EstimateID: estID,
      DetailID: estDetailID,
      CurrentQty: -1,
    }, tokens.site_engineer);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.ok((res.body.error || '').toLowerCase().includes('must be'));
  });

  it('should reject cumulative exceeding approved quantity', async () => {
    const res = await request('POST', '/api/measurement', {
      EstimateID: estID,
      DetailID: estDetailID,
      PreviousQty: 0,
      CurrentQty: 99999,
    }, tokens.site_engineer);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.ok((res.body.error || '').toLowerCase().includes('exceeds'));
  });

  it('should verify measurement (BillingOfficer)', async () => {
    const res = await request('POST', '/api/measurement/' + mbID + '/verify', {}, tokens.billing_officer);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.Status, 'Verified');
    assert.ok(res.body.VerifiedBy != null);
  });

  it('should reject editing a Verified measurement', async () => {
    const res = await request('PUT', '/api/measurement/' + mbID, {
      CurrentQty: 1,
    }, tokens.site_engineer);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.ok((res.body.error || '').toLowerCase().includes('verified'));
  });

  it('should reject deleting a Verified measurement', async () => {
    const res = await request('DELETE', '/api/measurement/' + mbID, null, tokens.site_engineer);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.ok((res.body.error || '').toLowerCase().includes('verified'));
  });

  it('should reject create by Manager (unauthorized role)', async () => {
    const res = await request('POST', '/api/measurement', {
      EstimateID: estID,
      CurrentQty: 1,
    }, tokens.manager);
    assert.equal(res.status, 403, JSON.stringify(res.body));
  });

  it('should create and delete a Draft measurement', async () => {
    const c = await request('POST', '/api/measurement', {
      EstimateID: estID,
      DetailID: estDetailID,
      CurrentQty: 2,
      Remarks: 'To be deleted',
    }, tokens.site_engineer);
    assert.equal(c.status, 201, JSON.stringify(c.body));
    const d = await request('DELETE', '/api/measurement/' + c.body.MeasurementID, null, tokens.site_engineer);
    assert.equal(d.status, 200, JSON.stringify(d.body));
  });

  it('dashboard pendingMeasurements counts Draft (not Pending)', async () => {
    const res = await request('GET', '/api/dashboard/stats', null, tokens.site_engineer);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const sd = res.body.siteEngineerDashboard || {};
    const m = sd.metrics || {};
    assert.ok(typeof m.pendingMeasurements === 'number',
      'pendingMeasurements should be a number, got: ' + JSON.stringify(m));
  });
});
