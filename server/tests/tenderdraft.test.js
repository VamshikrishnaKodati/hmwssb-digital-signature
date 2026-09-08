const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const { trackEstimate, cleanupTrackedData } = require('./cleanup');
const { resolveLocation } = require('./helpers');

let server;
let managerToken, dgmToken, gmToken, cgmToken, dopToken, edToken, mdToken;
let tenderToken, directorToken;
let location, items;

const SERVER_PORT = 5421;

function request(method, path, body, authToken) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: SERVER_PORT,
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

function extractOtp(captured) {
  const m = captured.match(/(\d{6})/);
  return m ? m[1] : null;
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(SERVER_PORT, resolve); });
  const login = async (u) => (await request('POST', '/api/auth/login', { username: u, password: 'password123' })).body.token;
  managerToken = await login('manager');
  dgmToken = await login('dgm');
  gmToken = await login('gm');
  cgmToken = await login('cgm');
  dopToken = await login('dop');
  edToken = await login('ed');
  mdToken = await login('md');
  tenderToken = await login('tender_officer');
  directorToken = await login('director_admin');
  location = await resolveLocation(request, managerToken);
  const itemsRes = await request('GET', '/api/items?limit=1000', null, managerToken);
  items = itemsRes.body;
});

after(async () => {
  await cleanupTrackedData();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

async function createEstimate() {
  const payload = {
    NameOfWork: 'Tender T2 ' + Date.now(),
    WorkCategory: 'Water Supply',
    RegionID: location.RegionID,
    WardID: location.WardID,
    GSTPercent: 18,
    LSProvision: 0,
    AdditionalItems: [],
    Items: items.slice(0, 3).map(function(it) {
      return { ItemID: it.ItemID, Category: it.Category, FormulaType: it.FormulaType, Unit: it.Unit, Rate: it.Rate, N: 1, L: 1, B: 1, D: 1 };
    }),
  };
  const r = await request('POST', '/api/estimates', payload, managerToken);
  return r.body;
}

async function getStatus(eid) {
  const r = await request('GET', '/api/estimates/' + eid, null, managerToken);
  return r.body.Status;
}

async function signWithOtp(eid, tok) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + eid + '/sign/request-otp', {}, tok));
  return request('POST', '/api/workflow/' + eid + '/sign',
    { otpCode: extractOtp(captured), certificateId: 'HMWSSB-DSC-T2-001' }, tok);
}

async function advanceStep(actionUrl, eid, tok) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + eid + actionUrl + '/request-otp', {}, tok));
  const r = await request('POST', '/api/workflow/' + eid + actionUrl,
    { otpCode: extractOtp(captured) }, tok);
  assert.equal(r.status, 200, actionUrl + ' failed: ' + JSON.stringify(r.body));
}

async function advanceToMD(eid) {
  await advanceStep('/submit', eid, managerToken);
  await advanceStep('/approve', eid, dgmToken);
  const g = await signWithOtp(eid, gmToken);
  assert.equal(g.status, 200, 'gm sign failed');
  await advanceStep('/cgm-submit', eid, cgmToken);
  await advanceStep('/dop-approve', eid, dopToken);
  await advanceStep('/ed-approve', eid, edToken);
  await advanceStep('/md-final', eid, mdToken);
}

async function advanceToTSApproved(eid) {
  await advanceToMD(eid);
  const fcn = await request('POST', '/api/workflow/' + eid + '/generate-fcn', { remarks: 'FCN' }, directorToken);
  assert.equal(fcn.status, 200, 'fcn failed');
  const san = await request('POST', '/api/workflow/' + eid + '/generate-admin-sanction', { sanctionNo: 'T2-SAN-' + Date.now(), remarks: 'san' }, directorToken);
  assert.equal(san.status, 200, 'sanction failed');
  const assign = await request('POST', '/api/workflow/' + eid + '/assign-ts-authority', { AuthorityRole: 'GM', remarks: 'assign GM' }, directorToken);
  assert.equal(assign.status, 200, 'assign failed');
  const approve = await request('POST', '/api/workflow/' + eid + '/approve-ts', { remarks: 'TS ok' }, gmToken);
  assert.equal(approve.status, 200, 'approve-ts failed: ' + JSON.stringify(approve.body));
}

const DRAFT_PAYLOAD = {
  TenderType: 'Open', TenderCategory: 'Water Supply', BiddingType: 'Two Cover',
  ReferenceNo: 'REF-T2-001', TenderInvitingAuthority: 'Executive Engineer, HMWSSB',
  OfficerInvitingBids: 'Dy. Executive Engineer', BidOpeningAuthority: 'Superintending Engineer',
  PreBidMeetingDate: '2026-09-05', BidStartDate: '2026-09-10', BidEndDate: '2026-09-25',
  TechnicalBidOpeningDate: '2026-09-25', BidValidity: 90, EMD: 50000, TenderFee: 1000,
  CompletionPeriod: '6 months', ContractPeriod: '6 months', DefectLiabilityPeriod: '12 months',
  ScopeOfWork: 'Supply and laying of distribution network', EligibilityCriteria: 'Registered contractor, 3 yrs exp',
  QualificationCriteria: 'Annual turnover > 10L', TechnicalRequirements: 'ISO compliant',
  RequiredDocuments: 'GST, PAN', InstructionsToBidders: 'Submit online', PerformanceSecurity: '5%',
  EvaluationType: 'Percentage',
};

describe('T2 Tender Draft Management', () => {
  it('GET /api/tender/config returns master data', async () => {
    const res = await request('GET', '/api/tender/config', null, tenderToken);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.tenderType));
    assert.ok(Array.isArray(res.body.tenderCategory));
  });

  it('Ready-for-tender list appears only after TS approval and matches fields', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);

    // Not ready before approval
    let res = await request('GET', '/api/tender/ready', null, tenderToken);
    assert.ok(!res.body.some(r => r.EstimateID === eid));

    await advanceToTSApproved(eid);
    assert.equal(await getStatus(eid), 'TSApproved');

    res = await request('GET', '/api/tender/ready', null, tenderToken);
    const row = res.body.find(r => r.EstimateID === eid);
    assert.ok(row, 'estimate should be in ready queue after TS approval');
    assert.ok(row.FCNNo, 'FCNNo present');
    assert.ok(row.ASNo, 'ASNo present');
    assert.ok(row.TSNo, 'TSNo present');
    assert.ok(row.ReadyDate, 'ReadyDate present');
  });

  it('Create tender draft from a ready estimate', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);

    const res = await request('POST', '/api/tender', { EstimateID: eid, ...DRAFT_PAYLOAD }, tenderToken);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.Status, 'TenderDraft');
    assert.ok(res.body.TenderNo.startsWith('eTNO/'));
    assert.equal(Number(res.body.EMD), 50000);
    assert.ok(res.body.readiness);
    assert.ok(res.body.EstimateID === eid);
  });

  it('Rejects draft creation for a not-ready estimate', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    // only advance to MD FinalApproved (no FCN/AS/TS) — not tender-ready
    await advanceToMD(eid);
    assert.equal(await getStatus(eid), 'FinalApproved');
    const res = await request('POST', '/api/tender', { EstimateID: eid }, tenderToken);
    assert.equal(res.status, 400);
  });

  it('Rejects draft creation by a non-TenderOfficer', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);
    const res = await request('POST', '/api/tender', { EstimateID: eid }, managerToken);
    assert.equal(res.status, 403);
  });

  it('Rejects protected field scribbling and bad dates on update', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);
    const created = await request('POST', '/api/tender', { EstimateID: eid, ...DRAFT_PAYLOAD }, tenderToken);
    assert.equal(created.status, 201);
    const tid = created.body.TenderID;

    // invalid timeline (opening before closing)
    const badDate = await request('PUT', `/api/tender/${tid}`, {
      BidEndDate: '2026-09-25', TechnicalBidOpeningDate: '2026-09-20',
    }, tenderToken);
    assert.equal(badDate.status, 400, 'should reject opening before closing');

    // estimated cost is not an editable field — the server rejects it outright
    const costScribble = await request('PUT', `/api/tender/${tid}`, { EstimatedCost: 1 }, tenderToken);
    assert.equal(costScribble.status, 400, 'protected EstimatedCost field must be rejected');
    const after = await request('GET', `/api/tender/${tid}`, null, tenderToken);
    assert.notEqual(Number(after.body.EstimatedCost), 1, 'EstimatedCost must remain derived from estimate');
  });

  it('Update a draft increments version and writes history', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);
    const created = await request('POST', '/api/tender', { EstimateID: eid, ...DRAFT_PAYLOAD }, tenderToken);
    assert.equal(created.status, 201);
    const tid = created.body.TenderID;
    assert.equal(created.body.Version, 1);

    const upd = await request('PUT', `/api/tender/${tid}`, { TenderType: 'Limited', EMD: 75000 }, tenderToken);
    assert.equal(upd.status, 200, JSON.stringify(upd.body));
    assert.equal(Number(upd.body.EMD), 75000);
    assert.equal(upd.body.Version, 2);

    const versions = await request('GET', `/api/tender/${tid}/versions`, null, tenderToken);
    assert.ok(versions.body.some(v => v.Version === 1), 'v1 snapshot kept');
  });

  it('Tender preview returns real saved draft data', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);
    const created = await request('POST', '/api/tender', { EstimateID: eid, ...DRAFT_PAYLOAD }, tenderToken);
    assert.equal(created.status, 201);
    const tid = created.body.TenderID;

    const prev = await request('GET', `/api/tender/${tid}/preview`, null, tenderToken);
    assert.equal(prev.status, 200);
    assert.equal(prev.body.tender.TenderType, 'Open');
    assert.equal(prev.body.tender.OfficerInvitingBids, 'Dy. Executive Engineer');
    assert.ok(Array.isArray(prev.body.documents));
  });

  it('Documents checklist: add and delete a document', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);
    const created = await request('POST', '/api/tender', { EstimateID: eid, ...DRAFT_PAYLOAD }, tenderToken);
    assert.equal(created.status, 201);
    const tid = created.body.TenderID;

    const add = await request('POST', `/api/tender/${tid}/documents`, { DocumentName: 'NIT', DocumentType: 'NIT', Required: true }, tenderToken);
    assert.equal(add.status, 201, JSON.stringify(add.body));

    const list = await request('GET', `/api/tender/${tid}/documents`, null, tenderToken);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].DocumentName, 'NIT');

    const del = await request('DELETE', `/api/tender/${tid}/documents/${list.body[0].DocumentID}`, null, tenderToken);
    assert.equal(del.status, 200);
    const after = await request('GET', `/api/tender/${tid}/documents`, null, tenderToken);
    assert.equal(after.body.length, 0);
  });

  it('Dashboard: draft creation moves estimate out of ready and increments drafts (KPI==queue)', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);

    // Before: in ready queue, not a draft yet
    let dash = await request('GET', '/api/dashboard/stats', null, tenderToken);
    const beforeReady = dash.body.tenderOfficerDashboard.queue.filter(r => r.EstimateID === eid).length;
    assert.equal(beforeReady, 1, 'estimate in ready queue');
    const beforeDraftCount = dash.body.tenderOfficerDashboard.metrics.tenderDrafts || 0;
    // assert KPI == queue length
    assert.equal(dash.body.tenderOfficerDashboard.metrics.readyForTender, dash.body.tenderOfficerDashboard.queue.length, 'KPI readyForTender == queue length');

    const created = await request('POST', '/api/tender', { EstimateID: eid, ...DRAFT_PAYLOAD }, tenderToken);
    assert.equal(created.status, 201);

    // After: the draft is no longer in the ready-for-tender queue (drafts are
    // resumed from the Tender Drafts list / edit URL), and the drafts metric grows.
    dash = await request('GET', '/api/dashboard/stats', null, tenderToken);
    const afterRow = dash.body.tenderOfficerDashboard.queue.find(r => r.EstimateID === eid);
    assert.equal(afterRow, undefined, 'estimate leaves ready queue once a draft exists');
    assert.equal(dash.body.tenderOfficerDashboard.metrics.readyForTender, dash.body.tenderOfficerDashboard.queue.length, 'KPI readyForTender == queue length after draft');
    assert.ok(dash.body.tenderOfficerDashboard.metrics.tenderDrafts >= beforeDraftCount + 1, 'Tender Drafts metric incremented');
  });
});
