// Regression tests for the audit fixes (C1/C2/C3 edit & submit authorization,
// H3 OTP single-use + one-tender-per-estimate). These cover the negative paths
// the golden E2E suite does not: out-of-scope / unauthorized edits, non-creator
// submits, recalc on a Signed estimate, and the OTP double-verification race.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const db = require('../config/db');
const { resolveLocation } = require('./helpers');
const { cleanupTrackedData, trackEstimate, trackUser } = require('./cleanup');

const PORT = 5199;
let server;
let items;
let managerToken, dgmToken, gmToken, adminToken, manager2Token, tenderOfficerToken, directorAdminToken, siteEngineerToken;
const tokens = {};
let location;

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

function nItem() {
  return items.find((i) => i.FormulaType === 'N');
}

async function createEstimate(token, name) {
  const item = nItem();
  assert.ok(item, 'an N-formula item must be seeded');
  const res = await request('POST', '/api/estimates', {
    NameOfWork: name || `Regression ${Date.now()}`,
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
  }, token);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  trackEstimate(res.body.EstimateID);
  return res.body;
}

// Drives a draft estimate to DGM_Approved and returns the OTP code (from the
// dev server log) without consuming it, so the caller can test the recommend step.
async function readyToSign(estimateID) {
  const { captured: submitCap } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateID}/submit/request-otp`, {}, managerToken));
  const submitM = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(submitCap);
  assert.ok(submitM, 'submit OTP should be captured from the dev log');
  const sub = await request('POST', `/api/workflow/${estimateID}/submit`, { otpCode: submitM[1] }, managerToken);
  assert.equal(sub.status, 200, `submit: ${JSON.stringify(sub.body)}`);
  // DGM approval is OTP-gated (workflowController.verifyDgmApprove).
  const { captured: apprCap } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateID}/approve/request-otp`, {}, dgmToken));
  const apprM = /\[OTP\]\[DEV\] DGM Approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(apprCap);
  assert.ok(apprM, 'dgm approve OTP should be captured from the dev log');
  const appr = await request('POST', `/api/workflow/${estimateID}/approve`, { otpCode: apprM[1] }, dgmToken);
  assert.equal(appr.status, 200, `approve: ${JSON.stringify(appr.body)}`);
  const { result, captured } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateID}/sign/request-otp`, {}, gmToken));
  assert.equal(result.status, 200, `request-otp: ${JSON.stringify(result.body)}`);
  const m = /\[OTP\]\[DEV\] Signature OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
  assert.ok(m, 'OTP should be captured from the dev log');
  return m[1];
}

// Drive GM to recommend (uses readyToSign + sign endpoint).
async function gmRecommend(estimateID) {
  const code = await readyToSign(estimateID);
  const sign = await request('POST', `/api/workflow/${estimateID}/sign`,
    { otpCode: code, certificateId: 'HMWSSB-DSC-GM' }, gmToken);
  assert.equal(sign.status, 200, `gm recommend: ${JSON.stringify(sign.body)}`);
}

// CGM submits to DOP via OTP.
async function cgmSubmit(estimateID) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateID}/cgm-submit/request-otp`, {}, tokens.cgm));
  const m = /\[OTP\]\[DEV\] cgm_submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
  assert.ok(m, 'cgm submit OTP should be captured');
  const res = await request('POST', `/api/workflow/${estimateID}/cgm-submit`, { otpCode: m[1] }, tokens.cgm);
  assert.equal(res.status, 200, `cgm submit: ${JSON.stringify(res.body)}`);
}

// DOP approves via OTP.
async function dopApprove(estimateID) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateID}/dop-approve/request-otp`, {}, tokens.dop));
  const m = /\[OTP\]\[DEV\] dop_approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
  assert.ok(m, 'dop approve OTP should be captured');
  const res = await request('POST', `/api/workflow/${estimateID}/dop-approve`, { otpCode: m[1] }, tokens.dop);
  assert.equal(res.status, 200, `dop approve: ${JSON.stringify(res.body)}`);
}

// ED approves via OTP.
async function edApprove(estimateID) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateID}/ed-approve/request-otp`, {}, tokens.ed));
  const m = /\[OTP\]\[DEV\] ed_approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
  assert.ok(m, 'ed approve OTP should be captured');
  const res = await request('POST', `/api/workflow/${estimateID}/ed-approve`, { otpCode: m[1] }, tokens.ed);
  assert.equal(res.status, 200, `ed approve: ${JSON.stringify(res.body)}`);
}

// MD final approve via OTP (forwards to FinanceHead for FCN).
async function mdFinalApprove(estimateID) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateID}/md-final/request-otp`, {}, tokens.md));
  const m = /\[OTP\]\[DEV\] md_final OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
  assert.ok(m, 'md final OTP should be captured');
  const res = await request('POST', `/api/workflow/${estimateID}/md-final`, { otpCode: m[1] }, tokens.md);
  assert.equal(res.status, 200, `md final: ${JSON.stringify(res.body)}`);
}

// Drive through the full chain to TSApproved (after MD final, through FCN/sanction/TS).
async function driveToTSApproved(estimateID) {
  await gmRecommend(estimateID);
  await cgmSubmit(estimateID);
  await dopApprove(estimateID);
  await edApprove(estimateID);
  await mdFinalApprove(estimateID);

  const fcn = await request('POST', `/api/workflow/${estimateID}/generate-fcn`, {}, tokens.director_admin);
  assert.equal(fcn.status, 200, `generate-fcn: ${JSON.stringify(fcn.body)}`);

  const sanction = await request('POST', `/api/workflow/${estimateID}/generate-admin-sanction`, { sanctionNo: `AS-REG-${estimateID}` }, tokens.director_admin);
  assert.equal(sanction.status, 200, `generate-sanction: ${JSON.stringify(sanction.body)}`);

  const assign = await request('POST', `/api/workflow/${estimateID}/assign-ts-authority`, { AuthorityRole: 'GM' }, tokens.director_admin);
  assert.equal(assign.status, 200, `assign-ts-authority: ${JSON.stringify(assign.body)}`);

  const approve = await request('POST', `/api/workflow/${estimateID}/approve-ts`, { remarks: 'TS approved' }, gmToken);
  assert.equal(approve.status, 200, `approve-ts: ${JSON.stringify(approve.body)}`);
}

// Drive through the full chain to FinalApproved (post-approval chain complete).
async function driveToFinalApproved(estimateID) {
  await driveToTSApproved(estimateID);
}

// Drives a draft estimate through full chain + publish so it lands in TenderPublished.
async function toTenderPublished(estimateID) {
  await driveToFinalApproved(estimateID);
  const pub = await request('POST', `/api/workflow/${estimateID}/publish-tender`, {}, tenderOfficerToken);
  assert.equal(pub.status, 200, `publish: ${JSON.stringify(pub.body)}`);
}

// Creates the authoritative Agency record for an estimate (DirectorOfAdministration).
async function createAgency(estimateID) {
  const res = await request('POST', '/api/agency', {
    EstimateID: estimateID,
    AgencyName: 'Alpha Constructions Pvt Ltd',
    AgencyCode: `AGY-${String(estimateID).padStart(5, '0')}`,
    AgreementNo: `AGT-${estimateID}`,
    AgreementDate: new Date().toISOString().slice(0, 10),
    TenderValue: 1000000,
    CompletionPeriod: '6 months',
    SecurityDeposit: 50000,
    PerformanceGuarantee: 100000,
    ContractorName: 'Alpha Contractor',
    ContactDetails: 'alpha@contractor.test',
  }, directorAdminToken);
  assert.equal(res.status, 201, `agency: ${JSON.stringify(res.body)}`);
  return res.body;
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(PORT, resolve); });
  managerToken = await login('manager');
  dgmToken = await login('dgm');
  gmToken = await login('gm');
  adminToken = await login('admin_officer');
  tenderOfficerToken = await login('tender_officer');
  directorAdminToken = await login('director_admin');
  siteEngineerToken = await login('site_engineer');
  tokens.cgm = await login('cgm');
  tokens.dop = await login('dop');
  tokens.ed = await login('ed');
  tokens.md = await login('md');
  tokens.finance_head = await login('finance_head');
  tokens.director_admin = await login('director_admin');

  const itemsRes = await request('GET', '/api/items?limit=1000', null, managerToken);
  assert.equal(itemsRes.status, 200);
  items = itemsRes.body;
  location = await resolveLocation(request, managerToken);

  // Second Manager, so ownership (not just role) can be tested.
  const uniq = `manager2_${Date.now()}`;
  const created = await request('POST', '/api/users', {
    Username: uniq, Password: 'password123', Name: 'Second Manager', Designation: 'Manager',
    Email: `${uniq}@hmwssb.gov.in`, MobileNumber: '9000000001',
  }, adminToken);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  trackUser(created.body.UserID);
  manager2Token = await login(uniq);
});

after(async () => {
  await cleanupTrackedData();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

describe('Regression: edit & submit authorization (C2, C3)', () => {
  it('allows an in-scope DGM (estimate.edit holder) to correct a Manager draft, rejects an out-of-scope non-creator', async () => {
    const est = await createEstimate(managerToken, 'C2 Delegate');
    const byDgm = await request('PUT', `/api/estimates/${est.EstimateID}`, { NameOfWork: 'C2 fixed by DGM' }, dgmToken);
    assert.equal(byDgm.status, 200, JSON.stringify(byDgm.body));
    const byOtherManager = await request('PUT', `/api/estimates/${est.EstimateID}`, { NameOfWork: 'hacked' }, manager2Token);
    assert.equal(byOtherManager.status, 403, JSON.stringify(byOtherManager.body));
    const get = await request('GET', `/api/estimates/${est.EstimateID}`, null, managerToken);
    assert.equal(get.body.NameOfWork, 'C2 fixed by DGM', 'only the in-scope DGM edit must apply');
  });

  it('allows the creator to edit a draft estimate', async () => {
    const est = await createEstimate(managerToken, 'C2 Edit Ok');
    const res = await request('PUT', `/api/estimates/${est.EstimateID}`, { NameOfWork: 'C2 Edit Ok v2' }, managerToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.NameOfWork, 'C2 Edit Ok v2');
  });

  it('rejects submit by a non-creator Manager', async () => {
    const est = await createEstimate(managerToken, 'C3 NonOwner');
    const res = await request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, manager2Token);
    assert.equal(res.status, 403, JSON.stringify(res.body));
  });

  it('rejects submit by a non-Manager', async () => {
    const est = await createEstimate(managerToken, 'C3 NonManager');
    const res = await request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, gmToken);
    assert.equal(res.status, 403, JSON.stringify(res.body));
  });

  it('prevents a double submit (only one wins, one Workflow row)', async () => {
    const est = await createEstimate(managerToken, 'C3 DoubleSubmit');
    const { captured: capA } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, managerToken));
    const mA = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(capA);
    assert.ok(mA, 'OTP A captured');
    const otpA = mA[1];

    const [a, b] = await Promise.all([
      request('POST', `/api/workflow/${est.EstimateID}/submit`, { otpCode: otpA }, managerToken),
      request('POST', `/api/workflow/${est.EstimateID}/submit`, { otpCode: otpA }, managerToken),
    ]);
    const ok = [a, b].filter((r) => r.status === 200);
    assert.equal(ok.length, 1, `expected exactly one success (${a.status}/${b.status}: ${JSON.stringify(a.body)} / ${JSON.stringify(b.body)})`);
    const wf = await db.query(
      'SELECT COUNT(*)::int AS n FROM "Workflow" WHERE "EstimateID" = $1 AND "Action" = \'Submit\'',
      [est.EstimateID]
    );
    assert.equal(wf.rows[0].n, 1, 'exactly one Submit workflow row');
  });
});

describe('Regression: recalculateItem edit-guard (C1)', () => {
  it('allows an in-scope DGM to recalc, rejects an out-of-scope non-creator', async () => {
    const est = await createEstimate(managerToken, 'C1 Recalc Delegate');
    const detailId = est.Items[0].DetailID;
    const ok = await request('PUT', `/api/estimates/recalculate/${detailId}`, { N: 5 }, dgmToken);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const blocked = await request('PUT', `/api/estimates/recalculate/${detailId}`, { N: 9 }, manager2Token);
    assert.equal(blocked.status, 403, JSON.stringify(blocked.body));
  });

  it('allows owner recalc on a draft estimate', async () => {
    const est = await createEstimate(managerToken, 'C1 Recalc Ok');
    const detailId = est.Items[0].DetailID;
    const res = await request('PUT', `/api/estimates/recalculate/${detailId}`, { N: 5 }, managerToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(Number(res.body.Qty), 5);
  });

  it('rejects recalc of a GM-recommended estimate and leaves amounts unchanged', async () => {
    const est = await createEstimate(managerToken, 'C1 Recalc Signed');
    const code = await readyToSign(est.EstimateID);
    const sign = await request('POST', `/api/workflow/${est.EstimateID}/sign`,
      { otpCode: code, certificateId: 'HMWSSB-DSC-C1-0001' }, gmToken);
    assert.equal(sign.status, 200, JSON.stringify(sign.body));

    const before = await request('GET', `/api/estimates/${est.EstimateID}`, null, managerToken);
    const detailId = before.body.Items[0].DetailID;
    const amountBefore = Number(before.body.Items[0].Amount);
    const grandBefore = Number(before.body.Abstract.GrandTotal);

    const recalc = await request('PUT', `/api/estimates/recalculate/${detailId}`, { N: 99 }, managerToken);
    assert.equal(recalc.status, 403, JSON.stringify(recalc.body));

    const after = await request('GET', `/api/estimates/${est.EstimateID}`, null, managerToken);
    assert.equal(Number(after.body.Items[0].Amount), amountBefore, 'item amount unchanged');
    assert.equal(Number(after.body.Abstract.GrandTotal), grandBefore, 'grand total unchanged');
  });
});

describe('Regression: OTP single-use + tender uniqueness (H3)', () => {
  it('rejects a wrong OTP', async () => {
    const est = await createEstimate(managerToken, 'H3 Wrong OTP');
    const code = await readyToSign(est.EstimateID);
    const res = await request('POST', `/api/workflow/${est.EstimateID}/sign`,
      { otpCode: '000000', certificateId: 'X' }, gmToken);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.ok(code, 'code captured');
  });

  it('rejects an expired OTP', async () => {
    const est = await createEstimate(managerToken, 'H3 Expired');
    const code = await readyToSign(est.EstimateID);
    await db.query(
      `UPDATE "SignatureOTP" SET "ExpiresAt" = now() - interval '1 minute'
       WHERE "EstimateID" = $1 AND "Verified" = FALSE`,
      [est.EstimateID]
    );
    const res = await request('POST', `/api/workflow/${est.EstimateID}/sign`,
      { otpCode: code, certificateId: 'X' }, gmToken);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.match(res.body.error, /expired/i);
  });

  it('rejects an already-verified OTP', async () => {
    const est = await createEstimate(managerToken, 'H3 Preverified');
    const code = await readyToSign(est.EstimateID);
    await db.query(
      'UPDATE "SignatureOTP" SET "Verified" = TRUE WHERE "EstimateID" = $1',
      [est.EstimateID]
    );
    const res = await request('POST', `/api/workflow/${est.EstimateID}/sign`,
      { otpCode: code, certificateId: 'X' }, gmToken);
    assert.equal(res.status, 400, JSON.stringify(res.body));
  });

  it('concurrent OTP verifications: exactly one wins, one recommend', async () => {
    const est = await createEstimate(managerToken, 'H3 Race');
    const code = await readyToSign(est.EstimateID);
    const [a, b] = await Promise.all([
      request('POST', `/api/workflow/${est.EstimateID}/sign`,
        { otpCode: code, certificateId: 'HMWSSB-DSC-RACE' }, gmToken),
      request('POST', `/api/workflow/${est.EstimateID}/sign`,
        { otpCode: code, certificateId: 'HMWSSB-DSC-RACE' }, gmToken),
    ]);
    const ok = [a, b].filter((r) => r.status === 200);
    const rejected = [a, b].filter((r) => r.status !== 200);
    assert.equal(ok.length, 1, `exactly one success (${a.status}/${b.status}: ${JSON.stringify(a.body)} / ${JSON.stringify(b.body)})`);
    assert.equal(rejected.length, 1, 'the loser must be rejected');

    const recommends = await db.query(
      'SELECT COUNT(*)::int AS n FROM "Workflow" WHERE "EstimateID" = $1 AND "Action" = \'Recommend\'',
      [est.EstimateID]
    );
    assert.equal(recommends.rows[0].n, 1, 'exactly one Recommend workflow row');
  });

  it('rejects reuse of a consumed OTP', async () => {
    const est = await createEstimate(managerToken, 'H3 Reuse');
    const code = await readyToSign(est.EstimateID);
    const first = await request('POST', `/api/workflow/${est.EstimateID}/sign`,
      { otpCode: code, certificateId: 'X' }, gmToken);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const second = await request('POST', `/api/workflow/${est.EstimateID}/sign`,
      { otpCode: code, certificateId: 'X' }, gmToken);
    assert.ok([400, 403, 409].includes(second.status),
      `second sign must be rejected (got ${second.status}: ${JSON.stringify(second.body)})`);
  });
});

describe('Regression: tender status advances with the workflow (6.2)', () => {
  it('marks the tender Awarded when an agency is selected (no bid-award step)', async () => {
    const est = await createEstimate(managerToken, '6.2 Tender Status');
    await driveToFinalApproved(est.EstimateID);
    const published = await request('POST', `/api/workflow/${est.EstimateID}/publish-tender`, {}, tenderOfficerToken);
    assert.equal(published.status, 200, `publish: ${JSON.stringify(published.body)}`);
    const afterPublish = await db.query('SELECT "Status" FROM "Tender" WHERE "EstimateID" = $1', [est.EstimateID]);
    assert.equal(afterPublish.rows[0].Status, 'Published', 'tender must be Published after publish');

    const selected = await request('POST', `/api/workflow/${est.EstimateID}/select-agency`, {}, directorAdminToken);
    assert.equal(selected.status, 200, `select-agency: ${JSON.stringify(selected.body)}`);

    const t = await db.query('SELECT "Status" FROM "Tender" WHERE "EstimateID" = $1', [est.EstimateID]);
    assert.equal(t.rows[0].Status, 'Awarded', 'tender must be Awarded after agency selection');

    const stats = await request('GET', '/api/dashboard/stats', null, managerToken);
    assert.equal(stats.status, 200, JSON.stringify(stats.body));
    assert.ok(stats.body.modules.awardedTenders >= 1, 'awardedTenders must count the selected tender');
  });
});

describe('Regression: Start Work agency validation (AgencySelected consistency)', () => {
  it('rejects start-work when the estimate never had an agency', async () => {
    const est = await createEstimate(managerToken, 'AGY NoAgency');
    await toTenderPublished(est.EstimateID);
    // The estimate sits in TenderPublished (no agency, no finalized record) and
    // is owned by the DirectorOfAdministration, so Start Work must be rejected — by
    // the owner guard (403) or, for an owner-SiteEngineer, the status guard (400).
    const res = await request('POST', `/api/workflow/${est.EstimateID}/start-work`, {}, siteEngineerToken);
    assert.ok([400, 403].includes(res.status),
      `must be rejected without a finalized agency (got ${res.status}: ${JSON.stringify(res.body)})`);
  });

  it('returns a data-consistency error when AgencySelected but the agency record is missing', async () => {
    const est = await createEstimate(managerToken, 'AGY Inconsistent');
    await toTenderPublished(est.EstimateID);
    const select = await request('POST', `/api/workflow/${est.EstimateID}/select-agency`, {}, directorAdminToken);
    assert.equal(select.status, 200, JSON.stringify(select.body));
    const start = await request('POST', `/api/workflow/${est.EstimateID}/start-work`, {}, siteEngineerToken);
    assert.equal(start.status, 400, JSON.stringify(start.body));
    assert.match(start.body.error, /incomplete/i, 'must name the inconsistent agency record');
    assert.doesNotMatch(start.body.error, /No agency\/contractor has been finalized/,
      'must not use the generic never-had-an-agency message');
  });

  it('starts work when a finalized agency record exists and sets status to WorkStarted', async () => {
    const est = await createEstimate(managerToken, 'AGY Start Ok');
    await toTenderPublished(est.EstimateID);
    await createAgency(est.EstimateID);
    const select = await request('POST', `/api/workflow/${est.EstimateID}/select-agency`, {}, directorAdminToken);
    assert.equal(select.status, 200, JSON.stringify(select.body));

    const start = await request('POST', `/api/workflow/${est.EstimateID}/start-work`, {}, siteEngineerToken);
    assert.equal(start.status, 200, JSON.stringify(start.body));

    const after = await request('GET', `/api/estimates/${est.EstimateID}`, null, siteEngineerToken);
    assert.equal(after.body.Status, 'WorkStarted', 'status must transition to WorkStarted');
  });

  it('reports the finalized agency name and ID from the estimate API (survives reload)', async () => {
    const est = await createEstimate(managerToken, 'AGY Status Card');
    await toTenderPublished(est.EstimateID);
    await createAgency(est.EstimateID);
    await request('POST', `/api/workflow/${est.EstimateID}/select-agency`, {}, directorAdminToken);

    // First fetch, then a fresh login + refetch to simulate a page reload. The
    // agency must come from the backend on every load, never from React state.
    const first = await request('GET', `/api/estimates/${est.EstimateID}`, null, siteEngineerToken);
    assert.equal(first.body.Status, 'AgencySelected');
    assert.ok(first.body.Agency, 'estimate response must carry the authoritative agency record');
    assert.equal(first.body.Agency.AgencyName, 'Alpha Constructions Pvt Ltd');
    assert.ok(first.body.Agency.AgencyCode, 'agency id must be present');

    const relogin = await request('POST', '/api/auth/login', { username: 'site_engineer', password: 'password123' });
    assert.equal(relogin.status, 200, JSON.stringify(relogin.body));
    const reload = await request('GET', `/api/estimates/${est.EstimateID}`, null, relogin.body.token);
    assert.deepEqual(reload.body.Agency, first.body.Agency, 'agency info must survive reload');
  });

  it('keeps the Start Work authorization rules (owner + SiteEngineer only)', async () => {
    const est = await createEstimate(managerToken, 'AGY Auth');
    await toTenderPublished(est.EstimateID);
    await createAgency(est.EstimateID);
    await request('POST', `/api/workflow/${est.EstimateID}/select-agency`, {}, directorAdminToken);

    // The estimate now belongs to the SiteEngineer; a DirectorOfAdministration (or any
    // non-owner, non-SiteEngineer) must still be rejected before the agency check.
    const wrongRole = await request('POST', `/api/workflow/${est.EstimateID}/start-work`, {}, directorAdminToken);
    assert.equal(wrongRole.status, 403, JSON.stringify(wrongRole.body));
  });
});

describe('Regression: Submit OTP verification', () => {
  it('allows manager submission with valid OTP', async () => {
    const est = await createEstimate(managerToken, 'OTP Submit OK');
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, managerToken));
    const m = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'submit OTP captured');
    const res = await request('POST', `/api/workflow/${est.EstimateID}/submit`, { otpCode: m[1] }, managerToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const check = await request('GET', `/api/estimates/${est.EstimateID}`, null, managerToken);
    assert.equal(check.body.Status, 'Submitted');
  });

  it('rejects wrong OTP on submit', async () => {
    const est = await createEstimate(managerToken, 'OTP Submit Wrong');
    await request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, managerToken);
    const res = await request('POST', `/api/workflow/${est.EstimateID}/submit`, { otpCode: '000000' }, managerToken);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    const check = await request('GET', `/api/estimates/${est.EstimateID}`, null, managerToken);
    assert.equal(check.body.Status, 'Draft');
  });

  it('rejects expired submit OTP', async () => {
    const est = await createEstimate(managerToken, 'OTP Submit Expired');
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, managerToken));
    const m = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'submit OTP captured');
    await db.query(
      `UPDATE "SignatureOTP" SET "ExpiresAt" = now() - interval '1 minute'
       WHERE "EstimateID" = $1 AND "Purpose" = 'submission' AND "Verified" = FALSE`,
      [est.EstimateID]
    );
    const res = await request('POST', `/api/workflow/${est.EstimateID}/submit`, { otpCode: m[1] }, managerToken);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.match(res.body.error, /expired/i);
  });

  it('rejects reused submit OTP', async () => {
    const est = await createEstimate(managerToken, 'OTP Submit Reuse');
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, managerToken));
    const m = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'submit OTP captured');
    const first = await request('POST', `/api/workflow/${est.EstimateID}/submit`, { otpCode: m[1] }, managerToken);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const second = await request('POST', `/api/workflow/${est.EstimateID}/submit`, { otpCode: m[1] }, managerToken);
    assert.ok([400, 409].includes(second.status),
      `second submit must be rejected (got ${second.status}: ${JSON.stringify(second.body)})`);
  });

  it('rejects submit without requesting OTP first', async () => {
    const est = await createEstimate(managerToken, 'OTP Submit No Request');
    const res = await request('POST', `/api/workflow/${est.EstimateID}/submit`, { otpCode: '123456' }, managerToken);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.match(res.body.error, /No OTP requested/i);
  });

  it('rejects submit without OTP code', async () => {
    const est = await createEstimate(managerToken, 'OTP Submit No Code');
    await request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, managerToken);
    const res = await request('POST', `/api/workflow/${est.EstimateID}/submit`, {}, managerToken);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.match(res.body.error, /OTP is required/i);
  });

  it('rejects submit OTP request by non-creator', async () => {
    const est = await createEstimate(managerToken, 'OTP Submit NonCreator');
    const res = await request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, manager2Token);
    assert.equal(res.status, 403, JSON.stringify(res.body));
  });

  it('rejects submit OTP request by non-Manager', async () => {
    const est = await createEstimate(managerToken, 'OTP Submit NonMgr');
    const res = await request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, gmToken);
    assert.equal(res.status, 403, JSON.stringify(res.body));
  });

  it('concurrent submit with same OTP: exactly one wins', async () => {
    const est = await createEstimate(managerToken, 'OTP Submit Race');
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, managerToken));
    const m = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'submit OTP captured');
    const otp = m[1];
    const [a, b] = await Promise.all([
      request('POST', `/api/workflow/${est.EstimateID}/submit`, { otpCode: otp }, managerToken),
      request('POST', `/api/workflow/${est.EstimateID}/submit`, { otpCode: otp }, managerToken),
    ]);
    const ok = [a, b].filter((r) => r.status === 200);
    assert.equal(ok.length, 1, `exactly one success (${a.status}/${b.status}: ${JSON.stringify(a.body)} / ${JSON.stringify(b.body)})`);
    const wf = await db.query(
      'SELECT COUNT(*)::int AS n FROM "Workflow" WHERE "EstimateID" = $1 AND "Action" = \'Submit\'',
      [est.EstimateID]
    );
    assert.equal(wf.rows[0].n, 1, 'exactly one Submit workflow row');
  });
});
