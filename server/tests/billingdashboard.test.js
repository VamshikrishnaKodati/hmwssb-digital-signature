// Billing Officer dashboard: "Prepared Bills" must follow PreparedBy
// (Billing.SubmittedBy) independent of CurrentOwner, while "My Pending Action"
// follows CurrentOwner. Verifies count, drill-down list and the prepare ->
// forward transitions against the /api/dashboard/stats + /api/billing APIs.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const { resolveLocation } = require('./helpers');
const { cleanupTrackedData, trackEstimate } = require('./cleanup');

const PORT = 5561;
let server, items, location;
const tokens = {};

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
  try { const result = await action(); return { result, captured }; }
  finally { console.log = original; }
}

async function createEstimate(name) {
  const item = items.find((i) => i.FormulaType === 'L');
  assert.ok(item, 'an L-formula item must be seeded');
  const res = await request('POST', '/api/estimates', {
    NameOfWork: name || 'BillingDash ' + Date.now(),
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

async function driveToAgencySelected(estimateID) {
  const step = async (path, token) => {
    const { captured } = await captureOtpFromLog(() => request('POST', `/api/workflow/${estimateID}${path}/request-otp`, {}, token));
    const code = /\[OTP\]\[DEV\].*?: (\d{6})/.exec(captured);
    assert.ok(code, `OTP for ${path}: ${captured}`);
    const r = await request('POST', `/api/workflow/${estimateID}${path}`, { otpCode: code[1] }, token);
    assert.equal(r.status, 200, `${path} failed: ${JSON.stringify(r.body)}`);
  };

  await step('/submit', tokens.manager);
  await step('/approve', tokens.dgm);
  const sign = await captureOtpFromLog(() => request('POST', `/api/workflow/${estimateID}/sign/request-otp`, {}, tokens.gm));
  const signCode = /\[OTP\]\[DEV\].*?: (\d{6})/.exec(sign.captured);
  assert.ok(signCode, 'gm sign OTP');
  const sg = await request('POST', `/api/workflow/${estimateID}/sign`, { otpCode: signCode[1], certificateId: 'HMWSSB-DSC-BDASH-' + estimateID }, tokens.gm);
  assert.equal(sg.status, 200, 'gm sign failed');
  await step('/cgm-submit', tokens.cgm);
  await step('/dop-approve', tokens.dop);
  await step('/ed-approve', tokens.ed);
  await step('/md-final', tokens.md);
  await request('POST', `/api/workflow/${estimateID}/generate-fcn`, {}, tokens.director_admin);
  await request('POST', `/api/workflow/${estimateID}/generate-admin-sanction`, { sanctionNo: 'AS-BDASH-' + estimateID }, tokens.director_admin);
  const assign = await request('POST', `/api/workflow/${estimateID}/assign-ts-authority`, { AuthorityRole: 'GM' }, tokens.director_admin);
  assert.equal(assign.status, 200, 'assign-ts-authority: ' + JSON.stringify(assign.body));
  const approve = await request('POST', `/api/workflow/${estimateID}/approve-ts`, { remarks: 'TS ok' }, tokens.gm);
  assert.equal(approve.status, 200, 'approve-ts: ' + JSON.stringify(approve.body));
  await request('POST', `/api/workflow/${estimateID}/publish-tender`, {}, tokens.tender_officer);
  const agency = await request('POST', '/api/agency', {
    EstimateID: estimateID, AgencyName: 'Bdash Agency', AgencyCode: 'AGY-BDASH',
    AgreementNo: 'AGT-BDASH', AgreementDate: new Date().toISOString().slice(0, 10),
    TenderValue: 1000000, CompletionPeriod: '6 months',
    SecurityDeposit: 50000, PerformanceGuarantee: 100000,
    ContractorName: 'Bdash Contractor', ContactDetails: 'bdash@test',
    WorkOrderNo: 'WO-BDASH-001', WorkOrderDate: new Date().toISOString().slice(0, 10),
  }, tokens.director_admin);
  assert.equal(agency.status, 201, 'createAgency: ' + JSON.stringify(agency.body));
  const select = await request('POST', `/api/workflow/${estimateID}/select-agency`, {}, tokens.director_admin);
  assert.equal(select.status, 200, 'select-agency: ' + JSON.stringify(select.body));
}

async function boStats() {
  const res = await request('GET', '/api/dashboard/stats', null, tokens.billing_officer);
  assert.equal(res.status, 200, 'dashboard: ' + JSON.stringify(res.body));
  assert.ok(res.body.billingDashboard, 'billingDashboard must be returned');
  const m = res.body.billingDashboard.metrics;
  const queueBillIDs = (res.body.billingDashboard.queue || []).map((b) => b.BillID);
  return { m, queueBillIDs, statsBody: res.body };
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(PORT, resolve); });
  for (const u of ['manager', 'dgm', 'gm', 'cgm', 'dop', 'ed', 'md', 'tender_officer', 'site_engineer', 'billing_officer', 'director_admin']) {
    tokens[u] = await login(u);
  }
  const itemsRes = await request('GET', '/api/items?limit=1000', null, tokens.manager);
  items = itemsRes.body;
  location = await resolveLocation(request, tokens.manager);
});

after(async () => {
  try { await cleanupTrackedData(); } catch {}
  try { server.closeAllConnections(); } catch {}
  server.close();
});

describe('Billing Officer dashboard: Prepared Bills by PreparedBy, Pending Action by CurrentOwner', () => {
  it('tracks prepared bills through prepare -> forward while splitting pending action', async () => {
    const est = await createEstimate('Bdash ' + Date.now());
    const eid = est.EstimateID;
    await driveToAgencySelected(eid);
    await request('POST', `/api/workflow/${eid}/start-work`, { remarks: 'begin' }, tokens.site_engineer);
    const complete = await request('POST', `/api/workflow/${eid}/complete-work`, { remarks: 'done' }, tokens.site_engineer);
    assert.equal(complete.status, 200, JSON.stringify(complete.body));

    const before = await boStats();
    const basePrepared = before.m.preparedBills || 0;
    const basePending = before.m.pendingAction || 0;
    const baseDrafts = before.m.draftBills || 0;

    // prepare: bill persisted with the Billing Officer as SubmittedBy (PreparedBy)
    const billRes = await request('POST', '/api/billing', {
      EstimateID: eid, BillType: 'RA', BillNo: 'BDASH-RA',
      BillDate: new Date().toISOString().slice(0, 10), GST: 0, NetAmount: 1000,
    }, tokens.billing_officer);
    assert.equal(billRes.status, 201, JSON.stringify(billRes.body));
    const billID = billRes.body.bill.BillID;
    assert.ok(billRes.body.bill.SubmittedBy, 'prepare must persist the preparer (SubmittedBy)');
    assert.equal(billRes.body.bill.Status, 'Draft');

    const afterPrepare = await boStats();
    assert.equal(afterPrepare.m.preparedBills, basePrepared + 1, 'prepared bills +1 after prepare');
    assert.equal(afterPrepare.m.pendingAction, basePending + 1, 'pending action +1 on the draft');
    assert.ok(afterPrepare.queueBillIDs.includes(billID), 'prepared bill must appear in BO prepared queue');
    assert.equal(afterPrepare.m.draftBills, baseDrafts + 1, 'draft metric +1');

    const preparedList = await request('GET', '/api/billing?preparedBy=me', null, tokens.billing_officer);
    assert.equal(preparedList.status, 200);
    assert.ok(preparedList.body.some((b) => b.BillID === billID), 'preparedBy=me drill-down lists the bill');
    assert.ok(preparedList.body.every((b) => b.SubmittedBy != null && b.BillID === billID),
      'drill-down is scoped to bills prepared by me');

    // forward to Manager: prepared bill stays with BO, pending action moves to Manager
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/billing/${billID}/submit/request-otp`, {}, tokens.billing_officer));
    const m = /\[OTP\]\[DEV\] Bill Submit OTP for bill \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'bill submit OTP should be captured from the dev log');
    const submit = await request('POST', `/api/billing/${billID}/submit`, { otpCode: m[1] }, tokens.billing_officer);
    assert.equal(submit.status, 200, 'submit: ' + JSON.stringify(submit.body));
    assert.equal(submit.body.bill.CurrentOwner != null, true, 'bill handed to Manager');

    const afterForward = await boStats();
    assert.equal(afterForward.m.preparedBills, basePrepared + 1, 'prepared bills persist after forwarding');
    assert.equal(afterForward.m.pendingAction, basePending, 'pending action drops to zero for the BO');
    assert.ok(afterForward.queueBillIDs.includes(billID), 'forwarded bill stays in the prepared queue');

    const preparedAfter = await request('GET', '/api/billing?preparedBy=me', null, tokens.billing_officer);
    assert.ok(preparedAfter.body.some((b) => b.BillID === billID), 'drill-down still lists the forwarded bill');

    const ownerList = await request('GET', '/api/billing?owner=me', null, tokens.billing_officer);
    assert.ok(ownerList.body.every((b) => b.BillID !== billID), 'owner=me (pending action) no longer lists it');

    const detail = await request('GET', `/api/billing/${billID}`, null, tokens.billing_officer);
    assert.equal(detail.status, 200, 'bill still readable');
    assert.ok(detail.body.bill.SubmittedBy, 'SubmittedBy retained through the flow');
  });

  it('one bill end-to-end: prepared -> Manager queue -> DGM queue (dashboard + owner=me)', async () => {
    const est = await createEstimate('BdashE2E ' + Date.now());
    const eid = est.EstimateID;
    await driveToAgencySelected(eid);
    await request('POST', `/api/workflow/${eid}/start-work`, { remarks: 'begin' }, tokens.site_engineer);
    const complete = await request('POST', `/api/workflow/${eid}/complete-work`, { remarks: 'done' }, tokens.site_engineer);
    assert.equal(complete.status, 200, JSON.stringify(complete.body));

    // BO prepares + submits the real bill
    const prep = await request('POST', '/api/billing/prepare', { EstimateID: eid }, tokens.billing_officer);
    assert.equal(prep.status, 201, 'prepare: ' + JSON.stringify(prep.body));
    const billID = prep.body.bill.BillID;

    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/billing/${billID}/submit/request-otp`, {}, tokens.billing_officer));
    const m = /\[OTP\]\[DEV\] Bill Submit OTP for bill \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'submit OTP capture');
    const submit = await request('POST', `/api/billing/${billID}/submit`, { otpCode: m[1] }, tokens.billing_officer);
    assert.equal(submit.status, 200, 'submit: ' + JSON.stringify(submit.body));
    assert.equal(submit.body.status, 'SubmittedToManager');

    // Manager sees the bill on their desk (CurrentOwner) — dashboard AND list filter agree
    const mgrStats = await request('GET', '/api/dashboard/stats', null, tokens.manager);
    assert.equal(mgrStats.status, 200);
    const mdBilling = mgrStats.body.managerDashboard?.billing || [];
    assert.ok(mdBilling.some(b => b.BillID === billID), 'bill must appear in managerDashboard.billing queue');
    assert.ok(mgrStats.body.managerDashboard?.billingMetrics?.pendingBillCheck >= 1,
      'manager pendingBillCheck metric must count the bill');

    const managerList = await request('GET', '/api/billing?owner=me', null, tokens.manager);
    assert.equal(managerList.status, 200);
    const mgrOwned = managerList.body.filter(b => b.BillID === billID);
    assert.equal(mgrOwned.length, 1, 'owner=me (manager) lists the bill exactly once');
    assert.equal(mgrOwned[0].Status, 'SubmittedToManager');
    assert.equal(mgrOwned[0].CurrentOwner, await userOf('manager'), 'bill owned by the manager');

    // Manager checks/forwards with OTP -> moves to DGM
    const { captured: c2 } = await captureOtpFromLog(() =>
      request('POST', `/api/billing/${billID}/check/request-otp`, {}, tokens.manager));
    const m2 = /\[OTP\]\[DEV\] Bill Check OTP for bill \S+ \(user [^)]+\): (\d{6})/.exec(c2);
    assert.ok(m2, 'check OTP capture');
    const checkRes = await request('POST', `/api/billing/${billID}/check`, { otpCode: m2[1] }, tokens.manager);
    assert.equal(checkRes.status, 200, 'manager check: ' + JSON.stringify(checkRes.body));
    assert.equal(checkRes.body.status, 'ManagerChecked');

    // DGM sees the bill on their desk now
    const dgmToken = tokens.dgm;
    const dgmDash = await request('GET', '/api/dashboard/stats', null, dgmToken);
    assert.equal(dgmDash.status, 200);
    assert.ok((dgmDash.body.dgmDashboard?.billing || []).some(b => b.BillID === billID),
      'bill must appear in dgmDashboard.billing queue');
    assert.ok(dgmDash.body.dgmDashboard?.billingMetrics?.pendingBillCheck >= 1,
      'DGM pendingBillCheck metric must count the bill');

    const dgmList = await request('GET', '/api/billing?owner=me', null, dgmToken);
    const dgmOwned = dgmList.body.filter(b => b.BillID === billID);
    assert.equal(dgmOwned.length, 1, 'owner=me (DGM) lists the bill exactly once');
    assert.equal(dgmOwned[0].Status, 'ManagerChecked');
    assert.equal(dgmOwned[0].CurrentOwner, await userOf('dgm'), 'bill owned by the DGM');

    // Manager's desk is now empty of this bill
    const mgrAfter = await request('GET', '/api/billing?owner=me', null, tokens.manager);
    assert.ok(!mgrAfter.body.some(b => b.BillID === billID), 'manager desk no longer lists it');
  });

  it('prepares a real bill from the estimate (idempotent, no duplicates, stays WorkCompleted)', async () => {
    const est = await createEstimate('BdashPrepare ' + Date.now());
    const eid = est.EstimateID;
    await driveToAgencySelected(eid);
    await request('POST', `/api/workflow/${eid}/start-work`, { remarks: 'begin' }, tokens.site_engineer);
    const complete = await request('POST', `/api/workflow/${eid}/complete-work`, { remarks: 'done' }, tokens.site_engineer);
    assert.equal(complete.status, 200, JSON.stringify(complete.body));

    // non-editor cannot prepare
    const denied = await request('POST', '/api/billing/prepare', { EstimateID: eid }, tokens.manager);
    assert.equal(denied.status, 403, 'only Billers can prepare bills');

    const prep = await request('POST', '/api/billing/prepare', { EstimateID: eid }, tokens.billing_officer);
    assert.equal(prep.status, 201, 'prepare: ' + JSON.stringify(prep.body));
    assert.equal(prep.body.reused, false, 'first prepare creates a fresh bill');
    const billID = prep.body.bill.BillID;
    assert.equal(prep.body.bill.Status, 'Draft', 'prepared bill is a Draft');
    assert.equal(prep.body.bill.CurrentOwner, (await userOf('billing_officer')), 'prepared bill owned by the Billing Officer');
    assert.ok(prep.body.bill.SubmittedBy, 'prepared bill tracked by SubmittedBy');

    // idempotent: repeat click returns the same bill, no duplicate
    const again = await request('POST', '/api/billing/prepare', { EstimateID: eid }, tokens.billing_officer);
    assert.equal(again.status, 200, 'repeat prepare reuses the draft');
    assert.equal(again.body.reused, true, 'second prepare is a reuse');
    assert.equal(again.body.bill.BillID, billID, 'no duplicate bill created');

    // estimate is untouched by bill preparation
    const estDetail = await request('GET', `/api/estimates/${eid}`, null, tokens.billing_officer);
    assert.equal(estDetail.status, 200);
    assert.equal(estDetail.body.Status, 'WorkCompleted', 'estimate stays WorkCompleted');

    // the real bill shows up in the plain list and the prepared-by drill-down
    const list = await request('GET', '/api/billing', null, tokens.billing_officer);
    assert.ok(list.body.some((b) => b.BillID === billID), 'billing list includes the prepared bill');
    const prepared = await request('GET', '/api/billing?preparedBy=me', null, tokens.billing_officer);
    assert.ok(prepared.body.some((b) => b.BillID === billID), 'preparedBy=me lists it');
  });
});

async function userOf(username) {
  const db = require('../config/db');
  const r = await db.query('SELECT "UserID" FROM "Users" WHERE "Username" = $1', [username]);
  return r.rows[0].UserID;
}