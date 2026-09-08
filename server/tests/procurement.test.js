const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const { trackEstimate, cleanupTrackedData } = require('./cleanup');
const { resolveLocation } = require('./helpers');

let server;
let managerToken, dgmToken, gmToken, cgmToken, dopToken, edToken, mdToken;
let tenderToken, directorToken, financeHeadToken;
let location, items;

const SERVER_PORT = 5402;

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
  financeHeadToken = await login('finance_head');
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
    NameOfWork: 'Procurement Test ' + Date.now(),
    WorkCategory: 'Water Supply',
    RegionID: location.RegionID,
    WardID: location.WardID,
    GSTPercent: 18,
    LSProvision: 0,
    AdditionalItems: [],
    Items: items.slice(0, 3).map(function(it) {
      return {
        ItemID: it.ItemID,
        Category: it.Category,
        FormulaType: it.FormulaType,
        Unit: it.Unit,
        Rate: it.Rate,
        N: 1, L: 1, B: 1, D: 1,
      };
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
    { otpCode: extractOtp(captured), certificateId: 'HMWSSB-DSC-TEST-001' }, tok);
}

// Draft -> Submitted (manager)
async function advanceToSubmitted(eid) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + eid + '/submit/request-otp', {}, managerToken));
  const r = await request('POST', '/api/workflow/' + eid + '/submit',
    { otpCode: extractOtp(captured) }, managerToken);
  assert.equal(r.status, 200, 'submit failed: ' + JSON.stringify(r.body));
}

// Submitted -> DGM_Approved (dgm)
async function advanceToDGMApproved(eid) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + eid + '/approve/request-otp', {}, dgmToken));
  const r = await request('POST', '/api/workflow/' + eid + '/approve',
    { otpCode: extractOtp(captured) }, dgmToken);
  assert.equal(r.status, 200, 'dgm approve failed: ' + JSON.stringify(r.body));
}

// DGM_Approved -> GM_Recommended (gm sign)
async function advanceToGMRecommended(eid) {
  const r = await signWithOtp(eid, gmToken);
  assert.equal(r.status, 200, 'gm sign failed: ' + JSON.stringify(r.body));
}

// GM_Recommended -> CGM_Submitted (cgm submit)
async function advanceToCGMSubmitted(eid) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + eid + '/cgm-submit/request-otp', {}, cgmToken));
  const r = await request('POST', '/api/workflow/' + eid + '/cgm-submit',
    { otpCode: extractOtp(captured) }, cgmToken);
  assert.equal(r.status, 200, 'cgm submit failed: ' + JSON.stringify(r.body));
}

// CGM_Submitted -> DOP_Approved (dop approve)
async function advanceToDOPApproved(eid) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + eid + '/dop-approve/request-otp', {}, dopToken));
  const r = await request('POST', '/api/workflow/' + eid + '/dop-approve',
    { otpCode: extractOtp(captured) }, dopToken);
  assert.equal(r.status, 200, 'dop approve failed: ' + JSON.stringify(r.body));
}

// DOP_Approved -> ED_Approved (ed approve)
async function advanceToEDApproved(eid) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + eid + '/ed-approve/request-otp', {}, edToken));
  const r = await request('POST', '/api/workflow/' + eid + '/ed-approve',
    { otpCode: extractOtp(captured) }, edToken);
  assert.equal(r.status, 200, 'ed approve failed: ' + JSON.stringify(r.body));
}

// ED_Approved -> FinalApproved (md final, default FCN authority = FinanceHead)
async function advanceToMDApproved(eid) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + eid + '/md-final/request-otp', {}, mdToken));
  const r = await request('POST', '/api/workflow/' + eid + '/md-final',
    { otpCode: extractOtp(captured) }, mdToken);
  assert.equal(r.status, 200, 'md final failed: ' + JSON.stringify(r.body));
}

// Advance through full approval chain to FinalApproved
async function advanceToMD(eid) {
  await advanceToSubmitted(eid);
  await advanceToDGMApproved(eid);
  await advanceToGMRecommended(eid);
  await advanceToCGMSubmitted(eid);
  await advanceToDOPApproved(eid);
  await advanceToEDApproved(eid);
  await advanceToMDApproved(eid);
}

// FinalApproved -> TSApproved (FCN -> Sanction -> Assign TS -> Approve TS by GM)
async function advanceToTSApproved(eid) {
  await advanceToMD(eid);
  const fcn = await request('POST', '/api/workflow/' + eid + '/generate-fcn', { remarks: 'FCN generated' }, directorToken);
  assert.equal(fcn.status, 200, 'generate-fcn failed: ' + JSON.stringify(fcn.body));
  const san = await request('POST', '/api/workflow/' + eid + '/generate-admin-sanction', { sanctionNo: 'SAN-' + Date.now(), remarks: 'Sanction generated' }, directorToken);
  assert.equal(san.status, 200, 'generate-admin-sanction failed: ' + JSON.stringify(san.body));
  const assign = await request('POST', '/api/workflow/' + eid + '/assign-ts-authority', { AuthorityRole: 'GM', remarks: 'assign GM' }, directorToken);
  assert.equal(assign.status, 200, 'assign-ts-authority failed: ' + JSON.stringify(assign.body));
  const approve = await request('POST', '/api/workflow/' + eid + '/approve-ts', { remarks: 'TS approved' }, gmToken);
  assert.equal(approve.status, 200, 'approve-ts failed: ' + JSON.stringify(approve.body));
}

// ── 7.1 Tender Close ──────────────────────────────────────────────────────────
describe('7.1 Tender Close', () => {
  it('TenderOfficer can close tender from TSApproved status', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);
    assert.equal(await getStatus(eid), 'TSApproved');

    const res = await request('POST', '/api/workflow/' + eid + '/close-tender', { remarks: 'Closed for bids' }, tenderToken);
    assert.equal(res.status, 200);
    assert.equal(await getStatus(eid), 'TenderClosed');
  });

  it('Cannot close tender from wrong status', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    const res = await request('POST', '/api/workflow/' + eid + '/close-tender', { remarks: 'test' }, tenderToken);
    assert.equal(res.status, 400);
  });
});

// ── 7.2 Bid Evaluation ────────────────────────────────────────────────────────
describe('7.2 Bid Evaluation', () => {
  it('Full evaluation pipeline: TenderClosed -> TechnicalEval -> FinancialEval', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);
    await request('POST', '/api/workflow/' + eid + '/close-tender', { remarks: 'closed' }, tenderToken);
    assert.equal(await getStatus(eid), 'TenderClosed');

    await request('POST', '/api/workflow/' + eid + '/technical-eval', { remarks: 'tech eval' }, directorToken);
    assert.equal(await getStatus(eid), 'TechnicalEvaluation');

    await request('POST', '/api/workflow/' + eid + '/financial-eval', { remarks: 'fin eval' }, directorToken);
    assert.equal(await getStatus(eid), 'FinancialEvaluation');
  });

  it('Cannot start financial eval without completing tech eval', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    const res = await request('POST', '/api/workflow/' + eid + '/financial-eval', { remarks: 'test' }, directorToken);
    assert.equal(res.status, 400);
  });
});

// ── 7.3 L1 Identification & Award ─────────────────────────────────────────────
describe('7.3 L1 Identification & Award', () => {
  it('FinancialEval -> L1Identified -> WorkAwarded', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);
    await request('POST', '/api/workflow/' + eid + '/close-tender', { remarks: 'closed' }, tenderToken);
    await request('POST', '/api/workflow/' + eid + '/technical-eval', { remarks: 'tech' }, directorToken);
    await request('POST', '/api/workflow/' + eid + '/financial-eval', { remarks: 'fin' }, directorToken);
    assert.equal(await getStatus(eid), 'FinancialEvaluation');

    await request('POST', '/api/workflow/' + eid + '/identify-l1', { remarks: 'L1 identified' }, directorToken);
    assert.equal(await getStatus(eid), 'L1Identified');

    await request('POST', '/api/workflow/' + eid + '/create-award', { remarks: 'Award created' }, directorToken);
    assert.equal(await getStatus(eid), 'WorkAwarded');
  });

  it('Cannot identify L1 from wrong status', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    const res = await request('POST', '/api/workflow/' + eid + '/identify-l1', { remarks: 'test' }, directorToken);
    assert.equal(res.status, 400);
  });
});

// ── 7.4 Work Order & Agreement ────────────────────────────────────────────────
describe('7.4 Work Order & Agreement', () => {
  it('WorkAwarded -> WorkOrderIssued -> AgreementExecuted', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);
    await request('POST', '/api/workflow/' + eid + '/close-tender', { remarks: 'closed' }, tenderToken);
    await request('POST', '/api/workflow/' + eid + '/technical-eval', { remarks: 'tech' }, directorToken);
    await request('POST', '/api/workflow/' + eid + '/financial-eval', { remarks: 'fin' }, directorToken);
    await request('POST', '/api/workflow/' + eid + '/identify-l1', { remarks: 'L1' }, directorToken);
    await request('POST', '/api/workflow/' + eid + '/create-award', { remarks: 'award' }, directorToken);
    assert.equal(await getStatus(eid), 'WorkAwarded');

    await request('POST', '/api/workflow/' + eid + '/issue-work-order', { remarks: 'WO issued' }, directorToken);
    assert.equal(await getStatus(eid), 'WorkOrderIssued');

    await request('POST', '/api/workflow/' + eid + '/record-agreement', { remarks: 'Agreement done' }, directorToken);
    assert.equal(await getStatus(eid), 'AgreementExecuted');
  });

  it('Cannot issue WO from wrong status', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    const res = await request('POST', '/api/workflow/' + eid + '/issue-work-order', { remarks: 'test' }, directorToken);
    assert.equal(res.status, 400);
  });
});

// ── 7.5 Return / Rework Paths ─────────────────────────────────────────────────
describe('7.5 Return / Rework Paths', () => {
  it('Director returns estimate from AdminSanction back to FCN stage for rework', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToMD(eid);
    await request('POST', '/api/workflow/' + eid + '/generate-fcn', { remarks: 'FCN' }, directorToken);
    await request('POST', '/api/workflow/' + eid + '/generate-admin-sanction', { sanctionNo: 'SAN-' + Date.now(), remarks: 'Sanction' }, directorToken);
    assert.equal(await getStatus(eid), 'AdminSanctionGenerated');

    await request('POST', '/api/workflow/' + eid + '/return-to-fcn', { remarks: 'FCN needs rework' }, directorToken);
    assert.equal(await getStatus(eid), 'FCNGenerated');
  });

  it('TS authority returns TS to Director', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToMD(eid);
    await request('POST', '/api/workflow/' + eid + '/generate-fcn', { remarks: 'FCN' }, directorToken);
    await request('POST', '/api/workflow/' + eid + '/generate-admin-sanction', { sanctionNo: 'SAN-' + Date.now(), remarks: 'Sanction' }, directorToken);
    const assign = await request('POST', '/api/workflow/' + eid + '/assign-ts-authority', { AuthorityRole: 'DGM', remarks: 'assign DGM' }, directorToken);
    assert.equal(assign.status, 200, 'assign-ts-authority failed: ' + JSON.stringify(assign.body));
    assert.equal(await getStatus(eid), 'TSPending');

    await request('POST', '/api/workflow/' + eid + '/return-ts', { remarks: 'TS needs rework' }, dgmToken);
    assert.equal(await getStatus(eid), 'AdminSanctionGenerated');
  });

  it('Return requires remarks', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToMD(eid);
    await request('POST', '/api/workflow/' + eid + '/generate-fcn', { remarks: 'FCN' }, directorToken);
    await request('POST', '/api/workflow/' + eid + '/generate-admin-sanction', { sanctionNo: 'SAN-' + Date.now(), remarks: 'Sanction' }, directorToken);
    const res = await request('POST', '/api/workflow/' + eid + '/return-to-fcn', {}, directorToken);
    assert.equal(res.status, 400);
  });
});

// ── 7.6 Dashboard Data ────────────────────────────────────────────────────────
describe('7.6 DirectorOfAdministration Dashboard Data', () => {
  it('DirectorOfAdministration dashboard returns directorAdminDashboard', async () => {
    const res = await request('GET', '/api/dashboard/stats', null, directorToken);
    assert.ok(res.body.directorAdminDashboard, 'should have directorAdminDashboard');
    assert.equal(res.body.procurementDashboard, undefined, 'procurementDashboard removed');
  });

  it('TenderOfficer dashboard has tender pipeline', async () => {
    const res = await request('GET', '/api/dashboard/stats', null, tenderToken);
    assert.ok(res.body.tenderOfficerDashboard, 'should have tenderOfficerDashboard');
    assert.ok(res.body.tenderOfficerDashboard.metrics);
  });

  it('DirectorOfAdministration dashboard has returnsSent metric', async () => {
    const res = await request('GET', '/api/dashboard/stats', null, directorToken);
    assert.ok(res.body.directorAdminDashboard, 'should have directorAdminDashboard');
    assert.ok('returnsSent' in res.body.directorAdminDashboard.metrics);
  });

  it('DirectorOfAdministration dashboard has FCN queue (Directors queue, not FinanceHead)', async () => {
    const res = await request('GET', '/api/dashboard/stats', null, directorToken);
    assert.ok(res.body.directorAdminDashboard);
    assert.ok(Array.isArray(res.body.directorAdminDashboard.queue));
    assert.ok('pendingFCN' in res.body.directorAdminDashboard.metrics);
  });

  it('FinanceHead dashboard has no FCN queue (FCN moved to Director)', async () => {
    const res = await request('GET', '/api/dashboard/stats', null, financeHeadToken);
    assert.ok(res.body.financeHeadDashboard);
    assert.ok(!('fcnQueue' in res.body.financeHeadDashboard));
    assert.ok(!('pendingFCN' in res.body.financeHeadDashboard.metrics));
  });

  it('GM dashboard has awaitingReview metric', async () => {
    const res = await request('GET', '/api/dashboard/stats', null, gmToken);
    assert.ok(res.body.gmDashboard);
    assert.ok('awaitingReview' in res.body.gmDashboard.metrics);
  });

  it('DGM dashboard has postApprovalPending metric', async () => {
    const res = await request('GET', '/api/dashboard/stats', null, dgmToken);
    assert.ok(res.body.dgmDashboard);
    assert.ok('postApprovalPending' in res.body.dgmDashboard.metrics);
  });
});

// ── 7.7 Workflow Audit Trail ──────────────────────────────────────────────────
describe('7.7 Workflow Audit Trail', () => {
  it('All procurement actions are recorded', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);
    await request('POST', '/api/workflow/' + eid + '/close-tender', { remarks: 'closed' }, tenderToken);
    await request('POST', '/api/workflow/' + eid + '/technical-eval', { remarks: 'tech' }, directorToken);
    await request('POST', '/api/workflow/' + eid + '/financial-eval', { remarks: 'fin' }, directorToken);
    await request('POST', '/api/workflow/' + eid + '/identify-l1', { remarks: 'L1' }, directorToken);
    await request('POST', '/api/workflow/' + eid + '/create-award', { remarks: 'award' }, directorToken);
    await request('POST', '/api/workflow/' + eid + '/issue-work-order', { remarks: 'WO' }, directorToken);
    await request('POST', '/api/workflow/' + eid + '/record-agreement', { remarks: 'agr' }, directorToken);

    const hist = await request('GET', '/api/workflow/' + eid + '/history', null, managerToken);
    const actions = hist.body.map(function(w) { return w.Action; });
    assert.ok(actions.includes('CloseTender'));
    assert.ok(actions.includes('TechnicalEval'));
    assert.ok(actions.includes('FinancialEval'));
    assert.ok(actions.includes('IdentifyL1'));
    assert.ok(actions.includes('CreateAward'));
    assert.ok(actions.includes('IssueWorkOrder'));
    assert.ok(actions.includes('RecordAgreement'));
  });
});

// ── 7.8 Complete End-to-End Workflow ────────────────────────────────────────
describe('7.8 Complete End-to-End: Reservoir Estimate', () => {
  it('Full lifecycle: Draft -> Submitted -> DGM_Approved -> GM_Recommended -> CGM_Submitted -> DOP_Approved -> ED_Approved -> FinalApproved -> FCNGenerated -> AdminSanctionGenerated -> TSPending -> TSApproved -> TenderPublished -> TenderClosed -> TechnicalEvaluation -> FinancialEvaluation -> L1Identified -> WorkAwarded -> WorkOrderIssued -> AgreementExecuted', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);

    // Step 1: Verify draft
    let status = await getStatus(eid);
    assert.equal(status, 'Draft', 'Step 1: should start as Draft');

    // Step 2: Manager submits
    await advanceToSubmitted(eid);
    status = await getStatus(eid);
    assert.equal(status, 'Submitted', 'Step 2: Manager submitted');

    // Step 3: DGM approves
    await advanceToDGMApproved(eid);
    status = await getStatus(eid);
    assert.equal(status, 'DGM_Approved', 'Step 3: DGM approved');

    // Step 4: GM signs
    await advanceToGMRecommended(eid);
    status = await getStatus(eid);
    assert.equal(status, 'GM_Recommended', 'Step 4: GM signed');

    // Step 5: CGM submits
    await advanceToCGMSubmitted(eid);
    status = await getStatus(eid);
    assert.equal(status, 'CGM_Submitted', 'Step 5: CGM submitted');

    // Step 6: DOP approves
    await advanceToDOPApproved(eid);
    status = await getStatus(eid);
    assert.equal(status, 'DOP_Approved', 'Step 6: DOP approved');

    // Step 7: ED approves
    await advanceToEDApproved(eid);
    status = await getStatus(eid);
    assert.equal(status, 'ED_Approved', 'Step 7: ED approved');

    // Step 8: MD final approval
    await advanceToMDApproved(eid);
    status = await getStatus(eid);
    assert.equal(status, 'FinalApproved', 'Step 8: MD final approved');

    // Step 9: FinanceHead generates FCN
    const fcnR = await request('POST', '/api/workflow/' + eid + '/generate-fcn', { remarks: 'FCN for Reservoir' }, directorToken);
    assert.equal(fcnR.status, 200, 'Step 9: FCN generated - ' + JSON.stringify(fcnR.body));
    status = await getStatus(eid);
    assert.equal(status, 'FCNGenerated', 'Step 9: FCN generated');

    // Step 10: DirectorOfAdmin generates AdminSanction
    const sanR = await request('POST', '/api/workflow/' + eid + '/generate-admin-sanction', { sanctionNo: 'SAN-RES-' + Date.now(), remarks: 'Sanction for Reservoir' }, directorToken);
    assert.equal(sanR.status, 200, 'Step 10: AdminSanction generated - ' + JSON.stringify(sanR.body));
    status = await getStatus(eid);
    assert.equal(status, 'AdminSanctionGenerated', 'Step 10: AdminSanction generated');

    // Step 11: Director assigns TS authority to GM
    const assignR = await request('POST', '/api/workflow/' + eid + '/assign-ts-authority', { AuthorityRole: 'GM', remarks: 'Assign GM Reservoir' }, directorToken);
    assert.equal(assignR.status, 200, 'Step 11: TS assigned - ' + JSON.stringify(assignR.body));
    status = await getStatus(eid);
    assert.equal(status, 'TSPending', 'Step 11: TS pending');

    // Step 12: GM approves TS
    const tsR = await request('POST', '/api/workflow/' + eid + '/approve-ts', { remarks: 'TS approved Reservoir' }, gmToken);
    assert.equal(tsR.status, 200, 'Step 12: TS approve - ' + JSON.stringify(tsR.body));
    status = await getStatus(eid);
    assert.equal(status, 'TSApproved', 'Step 12: TS approved');

    // Step 13: TenderOfficer publishes tender
    const pubR = await request('POST', '/api/workflow/' + eid + '/publish-tender', { remarks: 'Published Reservoir tender' }, tenderToken);
    assert.equal(pubR.status, 200, 'Step 13: Tender published - ' + JSON.stringify(pubR.body));
    status = await getStatus(eid);
    assert.equal(status, 'TenderPublished', 'Step 13: Tender published');

    // Step 14: TenderOfficer closes tender
    const closeR = await request('POST', '/api/workflow/' + eid + '/close-tender', { remarks: 'Closed Reservoir tender' }, tenderToken);
    assert.equal(closeR.status, 200, 'Step 14: Tender closed - ' + JSON.stringify(closeR.body));
    status = await getStatus(eid);
    assert.equal(status, 'TenderClosed', 'Step 14: Tender closed');

    // Step 15: DirectorOfAdministration technical evaluation
    const techR = await request('POST', '/api/workflow/' + eid + '/technical-eval', { remarks: 'Tech eval for Reservoir' }, directorToken);
    assert.equal(techR.status, 200, 'Step 15: Tech eval - ' + JSON.stringify(techR.body));
    status = await getStatus(eid);
    assert.equal(status, 'TechnicalEvaluation', 'Step 15: Technical evaluation');

    // Step 16: DirectorOfAdministration financial evaluation
    const finR = await request('POST', '/api/workflow/' + eid + '/financial-eval', { remarks: 'Fin eval for Reservoir' }, directorToken);
    assert.equal(finR.status, 200, 'Step 16: Fin eval - ' + JSON.stringify(finR.body));
    status = await getStatus(eid);
    assert.equal(status, 'FinancialEvaluation', 'Step 16: Financial evaluation');

    // Step 17: DirectorOfAdministration identifies L1
    const l1R = await request('POST', '/api/workflow/' + eid + '/identify-l1', { remarks: 'L1 identified for Reservoir' }, directorToken);
    assert.equal(l1R.status, 200, 'Step 17: L1 identified - ' + JSON.stringify(l1R.body));
    status = await getStatus(eid);
    assert.equal(status, 'L1Identified', 'Step 17: L1 identified');

    // Step 18: DirectorOfAdministration creates award
    const awardR = await request('POST', '/api/workflow/' + eid + '/create-award', { remarks: 'Award for Reservoir' }, directorToken);
    assert.equal(awardR.status, 200, 'Step 18: Award created - ' + JSON.stringify(awardR.body));
    status = await getStatus(eid);
    assert.equal(status, 'WorkAwarded', 'Step 18: Work awarded');

    // Step 19: DirectorOfAdministration issues work order
    const woR = await request('POST', '/api/workflow/' + eid + '/issue-work-order', { remarks: 'WO issued for Reservoir' }, directorToken);
    assert.equal(woR.status, 200, 'Step 19: WO issued - ' + JSON.stringify(woR.body));
    status = await getStatus(eid);
    assert.equal(status, 'WorkOrderIssued', 'Step 19: Work order issued');

    // Step 20: DirectorOfAdministration records agreement
    const agrR = await request('POST', '/api/workflow/' + eid + '/record-agreement', { remarks: 'Agreement for Reservoir' }, directorToken);
    assert.equal(agrR.status, 200, 'Step 20: Agreement recorded - ' + JSON.stringify(agrR.body));
    status = await getStatus(eid);
    assert.equal(status, 'AgreementExecuted', 'Step 20: Agreement executed');

    // Verify audit trail has all actions
    const hist = await request('GET', '/api/workflow/' + eid + '/history', null, managerToken);
    const actions = hist.body.map(function(w) { return w.Action; });
    assert.ok(actions.includes('Submit'), 'Audit: Submit');
    assert.ok(actions.includes('Approve'), 'Audit: DGM Approve');
    assert.ok(actions.includes('Recommend'), 'Audit: GM Recommend');
    assert.ok(actions.includes('SubmitForApproval'), 'Audit: CGM Submit');
    assert.ok(actions.includes('FinalApprove'), 'Audit: MD Final');
    assert.ok(actions.includes('GenerateFCN'), 'Audit: GenerateFCN');
    assert.ok(actions.includes('GenerateSanction'), 'Audit: GenerateSanction');
    assert.ok(actions.includes('AssignTSAuthority'), 'Audit: AssignTSAuthority');
    assert.ok(actions.includes('ApproveTS'), 'Audit: ApproveTS');
    assert.ok(actions.includes('PublishTender'), 'Audit: PublishTender');
    assert.ok(actions.includes('CloseTender'), 'Audit: CloseTender');
    assert.ok(actions.includes('TechnicalEval'), 'Audit: TechnicalEval');
    assert.ok(actions.includes('FinancialEval'), 'Audit: FinancialEval');
    assert.ok(actions.includes('IdentifyL1'), 'Audit: IdentifyL1');
    assert.ok(actions.includes('CreateAward'), 'Audit: CreateAward');
    assert.ok(actions.includes('IssueWorkOrder'), 'Audit: IssueWorkOrder');
    assert.ok(actions.includes('RecordAgreement'), 'Audit: RecordAgreement');

    console.log('\n=== RESERVOIR ESTIMATE COMPLETE WORKFLOW ===');
    console.log('Estimate: ' + est.WorkID);
    console.log('Steps completed: 20');
    console.log('Final status: ' + status);
    console.log('Workflow actions: ' + actions.length);
    console.log('============================================\n');
  });
});
