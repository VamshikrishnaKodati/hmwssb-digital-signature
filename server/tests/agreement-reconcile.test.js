// Tender → award → work order → agreement reconciles the linked estimate to
// execution-ready (AgencySelected under the SiteEngineer), so StartWork works
// with zero manual legacy steps. Also proves the hardened selectAgency never
// regresses an advanced tender, legacy selectAgency still works standalone,
// and every negative gate holds (agreement failure, duplicate submission,
// wrong user, missing agency).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const db = require('../config/db');
const { trackEstimate, cleanupTrackedData } = require('./cleanup');
const { resolveLocation } = require('./helpers');

const SERVER_PORT = 5481;

let server;
let managerToken, dgmToken, gmToken, cgmToken, dopToken, edToken, mdToken, tenderToken, directorToken, siteEngineerToken;
let location, items, seUserId, directorUserId;

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
  siteEngineerToken = await login('site_engineer');
  const seRow = (await db.query(
    `SELECT "UserID" FROM "Users" WHERE "Designation" = 'SiteEngineer' AND "IsActive" IS NOT FALSE ORDER BY "UserID" LIMIT 1`
  )).rows[0];
  seUserId = seRow.UserID;
  directorUserId = (await db.query(
    `SELECT "UserID" FROM "Users" WHERE "Designation" = 'DirectorOfAdministration' AND "IsActive" IS NOT FALSE ORDER BY "UserID" LIMIT 1`
  )).rows[0].UserID;
  location = await resolveLocation(request, managerToken);
  items = (await request('GET', '/api/items?limit=1000', null, managerToken)).body;
});

after(async () => {
  await cleanupTrackedData();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

async function createEstimate() {
  const payload = {
    NameOfWork: 'Reconcile Test ' + Date.now(),
    WorkCategory: 'Water Supply',
    RegionID: location.RegionID,
    WardID: location.WardID,
    GSTPercent: 18,
    LSProvision: 0,
    AdditionalItems: [],
    Items: items.slice(0, 3).map(function (it) {
      return { ItemID: it.ItemID, Category: it.Category, FormulaType: it.FormulaType, Unit: it.Unit, Rate: it.Rate, N: 3, L: 2, B: 1, D: 1 };
    }),
  };
  const r = await request('POST', '/api/estimates', payload, managerToken);
  return r.body;
}

async function advanceToTSApproved(eid) {
  async function step(url, tok) {
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${eid}${url}/request-otp`, {}, tok));
    const r = await request('POST', `/api/workflow/${eid}${url}`, { otpCode: extractOtp(captured) }, tok);
    assert.equal(r.status, 200, url + ' failed: ' + JSON.stringify(r.body));
  }
  async function sign(tok) {
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${eid}/sign/request-otp`, {}, tok));
    const g = await request('POST', `/api/workflow/${eid}/sign`,
      { otpCode: extractOtp(captured), certificateId: 'HMWSSB-DSC-T3-001' }, tok);
    assert.equal(g.status, 200, 'gm sign failed');
  }
  await step('/submit', managerToken);
  await step('/approve', dgmToken);
  await sign(gmToken);
  await step('/cgm-submit', cgmToken);
  await step('/dop-approve', dopToken);
  await step('/ed-approve', edToken);
  await step('/md-final', mdToken);
  await request('POST', `/api/workflow/${eid}/generate-fcn`, { remarks: 'FCN' }, directorToken);
  await request('POST', `/api/workflow/${eid}/generate-admin-sanction`, { sanctionNo: 'PL-SAN-' + Date.now() }, directorToken);
  await request('POST', `/api/workflow/${eid}/assign-ts-authority`, { AuthorityRole: 'GM' }, directorToken);
  const approve = await request('POST', `/api/workflow/${eid}/approve-ts`, { remarks: 'TS ok' }, gmToken);
  assert.equal(approve.status, 200, 'approve-ts failed: ' + JSON.stringify(approve.body));
}

const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
function draftPayload() {
  return {
    TenderType: 'Open', TenderCategory: 'Water Supply', BiddingType: 'Two Cover',
    ReferenceNo: 'REF-RC-' + Date.now(), TenderInvitingAuthority: 'Executive Engineer, HMWSSB',
    OfficerInvitingBids: 'Dy. Executive Engineer', BidOpeningAuthority: 'Superintending Engineer',
    PreBidMeetingDate: day(-4), BidStartDate: day(-3), BidEndDate: day(+7),
    TechnicalBidOpeningDate: day(+7), BidValidity: 90, EMD: 50000, TenderFee: 1000,
    CompletionPeriod: '6 months', ScopeOfWork: 'Supply and laying of distribution network',
    EligibilityCriteria: 'Registered contractor, 3 yrs exp', RequiredDocuments: 'GST, PAN',
    PerformanceSecurity: '5%', EvaluationType: 'Percentage',
  };
}

async function auditCount(eid, action) {
  const r = await db.query('SELECT COUNT(*)::int AS n FROM "AuditLog" WHERE "EstimateID"=$1 AND "Action"=$2', [eid, action]);
  return r.rows[0].n;
}
async function workflowCount(eid, action) {
  const r = await db.query('SELECT COUNT(*)::int AS n FROM "Workflow" WHERE "EstimateID"=$1 AND "Action"=$2', [eid, action]);
  return r.rows[0].n;
}
async function estimateState(eid) {
  const r = await db.query('SELECT "Status","CurrentOwner" FROM "EstimateHeader" WHERE "EstimateID"=$1', [eid]);
  return r.rows[0];
}
async function tenderStateRow(tid) {
  const r = await db.query('SELECT "Status","WorkOrderNo","AgreementNo" FROM "Tender" WHERE "TenderID"=$1', [tid]);
  return r.rows[0];
}

// Mirrors the legacy workflowController.publishTender outcome (EstimateHeader
// → TenderPublished under the DirectorOfAdministration) so the estimate-side
// selectAgency path can be exercised against an already-published tender.
async function makeEstimateTenderPublished(eid) {
  await db.query(
    `UPDATE "EstimateHeader" SET "Status" = 'TenderPublished', "CurrentOwner" = $1 WHERE "EstimateID" = $2`,
    [directorUserId, eid]
  );
}

function makeTender(eid) {
  return request('POST', '/api/tender', { EstimateID: eid, ...draftPayload() }, tenderToken);
}

async function chainToL1(tid) {
  const alpha = (await request('POST', `/api/bids/tender/${tid}`, { ContractorName: 'Alpha Constructions', FinancialBidAmount: 2410000, EMD: 50000 }, tenderToken)).body.BidID;
  const beta = (await request('POST', `/api/bids/tender/${tid}`, { ContractorName: 'Beta Constructions', FinancialBidAmount: 2470000, EMD: 50000 }, tenderToken)).body.BidID;
  await request('POST', `/api/tender/${tid}/close`, {}, tenderToken);
  await request('POST', `/api/tender/${tid}/bid-opening/start`, {}, tenderToken);
  for (const id of [alpha, beta]) await request('POST', `/api/bids/${id}/open`, {}, tenderToken);
  const complete = await request('POST', `/api/tender/${tid}/bid-opening/complete`, {}, tenderToken);
  assert.equal(complete.body.effectiveStatus, 'TechnicalEvaluationPending');
  const tech = await request('POST', `/api/bids/tender/${tid}/evaluate/technical`, {
    results: [
      { BidID: alpha, Qualified: true, Remarks: 'Meets criteria' },
      { BidID: beta, Qualified: true, Remarks: 'Meets criteria' },
    ],
  }, tenderToken);
  assert.equal(tech.status, 200, JSON.stringify(tech.body));
  const fin = await request('POST', `/api/bids/tender/${tid}/evaluate/financial`, {}, tenderToken);
  assert.equal(fin.status, 200, JSON.stringify(fin.body));
  const l1 = await request('POST', `/api/bids/tender/${tid}/l1`, {}, tenderToken);
  assert.equal(l1.status, 200, JSON.stringify(l1.body));
  assert.equal(l1.body.l1.BidID, alpha, 'Alpha is L1');
  return alpha;
}

async function reachAward(eid, tid) {
  await chainToL1(tid);
  const award = await request('POST', `/api/bids/tender/${tid}/award`, {}, directorToken);
  assert.equal(award.status, 200, JSON.stringify(award.body));
  assert.equal(award.body.tenderStatus, 'WorkAwarded');
}

async function issueWokOrder(tid, no) {
  const wo = await request('POST', `/api/bids/tender/${tid}/work-order`, { WorkOrderNo: no }, directorToken);
  assert.equal(wo.status, 200, JSON.stringify(wo.body));
  return wo.body;
}

describe('Agreement → estimate reconciliation (tender-side authority)', () => {
  it('reconciles the estimate to AgencySelected + SiteEngineer and StartWork succeeds', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);

    const created = await makeTender(eid);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const tid = created.body.TenderID;
    await request('POST', `/api/tender/${tid}/publish`, {}, tenderToken);
    await reachAward(eid, tid);
    await issueWokOrder(tid, 'WO-RC-001');
    const ag = await request('POST', `/api/bids/tender/${tid}/agreement`, { AgreementNo: 'AGT-RC-001' }, directorToken);
    assert.equal(ag.status, 200, JSON.stringify(ag.body));
    assert.equal(ag.body.tenderStatus, 'AgreementExecuted');

    // The authoritative contract numbers live on the tender; the estimate
    // references them — nothing duplicated on the estimate header.
    const trow = await tenderStateRow(tid);
    assert.equal(trow.Status, 'AgreementExecuted');
    assert.equal(trow.WorkOrderNo, 'WO-RC-001');
    assert.equal(trow.AgreementNo, 'AGT-RC-001');

    const eh = await estimateState(eid);
    assert.equal(eh.Status, 'AgencySelected', 'estimate reconciled to AgencySelected');
    assert.equal(eh.CurrentOwner, seUserId, 'estimate handed to the SiteEngineer');

    assert.equal(await workflowCount(eid, 'SelectAgency'), 1, 'exactly one SelectAgency handoff entry');
    assert.equal(await auditCount(eid, 'AGREEMENT_EXECUTED'), 1, 'exactly one agreement audit entry');

    const agencyRow = (await db.query(`SELECT "AgreementNo" FROM "Agency" WHERE "TenderID"=$1`, [tid])).rows[0];
    assert.equal(agencyRow.AgreementNo, 'AGT-RC-001', 'agency carries the agreement number');

    const notif = (await db.query(
      `SELECT u."Designation" FROM "Notification" n JOIN "Users" u ON u."UserID"=n."ToUserID"
       WHERE n."EstimateID"=$1 AND n."Type"='AgencySelected' LIMIT 1`, [eid])).rows[0];
    assert.ok(notif && notif.Designation === 'SiteEngineer', 'SiteEngineer notified');

    const ehSla = (await db.query(`SELECT "SlaStatus" FROM "EstimateHeader" WHERE "EstimateID"=$1`, [eid])).rows[0];
    assert.equal(ehSla.SlaStatus, 'Resolved', 'stale estimate SLA resolved at execution handoff');

    // Liquid execution: the SiteEngineer owner can start work immediately.
    const start = await request('POST', `/api/workflow/${eid}/start-work`, {}, siteEngineerToken);
    assert.equal(start.status, 200, 'StartWork succeeds after agreement: ' + JSON.stringify(start.body));
    assert.equal((await estimateState(eid)).Status, 'WorkStarted');
  });

  it('is idempotent: a duplicate agreement submission is blocked with no extra writes', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);

    const created = await makeTender(eid);
    const tid = created.body.TenderID;
    await request('POST', `/api/tender/${tid}/publish`, {}, tenderToken);
    await reachAward(eid, tid);
    await issueWokOrder(tid, 'WO-RC-002');
    await request('POST', `/api/bids/tender/${tid}/agreement`, { AgreementNo: 'AGT-RC-002' }, directorToken);

    const dup = await request('POST', `/api/bids/tender/${tid}/agreement`, { AgreementNo: 'AGT-RC-002X' }, directorToken);
    assert.equal(dup.status, 409, 'duplicate agreement submission must conflict');
    assert.equal(await auditCount(eid, 'AGREEMENT_EXECUTED'), 1, 'no duplicate audit entries');
    assert.equal(await workflowCount(eid, 'SelectAgency'), 1, 'no duplicate workflow entries');
    assert.equal((await tenderStateRow(tid)).AgreementNo, 'AGT-RC-002', 'first agreement number preserved');
    const eh = await estimateState(eid);
    assert.equal(eh.Status, 'AgencySelected');
    assert.equal(eh.CurrentOwner, seUserId);
  });

  it('never regresses an advanced tender (legacy selectAgency after work order)', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);

    const created = await makeTender(eid);
    const tid = created.body.TenderID;
    await request('POST', `/api/tender/${tid}/publish`, {}, tenderToken);
    await reachAward(eid, tid);
    await issueWokOrder(tid, 'WO-RC-003');
    await makeEstimateTenderPublished(eid);

    // Legacy selectAgency on a WorkOrderIssued tender: the estimate advances,
    // the tender must NOT be shoved back to 'Awarded'.
    const select = await request('POST', `/api/workflow/${eid}/select-agency`, {}, directorToken);
    assert.equal(select.status, 200, JSON.stringify(select.body));
    assert.equal((await estimateState(eid)).Status, 'AgencySelected');
    const trow = await tenderStateRow(tid);
    assert.equal(trow.Status, 'WorkOrderIssued', 'advanced tender is never regressed');
    assert.equal(trow.WorkOrderNo, 'WO-RC-003', 'work order number preserved');
    assert.equal(await workflowCount(eid, 'SelectAgency'), 1, 'exactly one handoff entry');

    // Agreement on top of the legacy-reconciled estimate: no duplicate handoff.
    const ag = await request('POST', `/api/bids/tender/${tid}/agreement`, { AgreementNo: 'AGT-RC-003' }, directorToken);
    assert.equal(ag.status, 200, JSON.stringify(ag.body));
    assert.equal(await workflowCount(eid, 'SelectAgency'), 1, 'still exactly one handoff entry');
    assert.equal(await auditCount(eid, 'AGREEMENT_EXECUTED'), 1, 'exactly one agreement audit entry');
    assert.equal((await estimateState(eid)).CurrentOwner, seUserId);

    const start = await request('POST', `/api/workflow/${eid}/start-work`, {}, siteEngineerToken);
    assert.equal(start.status, 200, JSON.stringify(start.body));
  });

  it('still supports the legacy standalone selectAgency → StartWork path', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);

    const created = await makeTender(eid);
    const tid = created.body.TenderID;
    await request('POST', `/api/tender/${tid}/publish`, {}, tenderToken);
    await makeEstimateTenderPublished(eid);

    // Legacy ordering (as the golden spec does it): the agency record is
    // created against the TenderPublished estimate first (no TenderID), then
    // selectAgency advances the pre-award (Published) tender to 'Awarded'.
    const agencyRes = await request('POST', '/api/agency', {
      EstimateID: eid, AgencyName: 'Legacy Agency Pvt Ltd', AgencyCode: 'LGY-001',
      AgreementNo: 'AGT-LGY-001', AgreementDate: day(0), TenderValue: 1000000,
      CompletionPeriod: '6 months', SecurityDeposit: 50000, PerformanceGuarantee: 100000,
      ContractorName: 'Legacy Contractor', ContactDetails: 'legacy@test.in',
    }, directorToken);
    assert.equal(agencyRes.status, 201, JSON.stringify(agencyRes.body));

    const select = await request('POST', `/api/workflow/${eid}/select-agency`, {}, directorToken);
    assert.equal(select.status, 200, JSON.stringify(select.body));
    assert.equal((await estimateState(eid)).Status, 'AgencySelected');
    assert.equal((await estimateState(eid)).CurrentOwner, seUserId);
    assert.equal((await tenderStateRow(tid)).Status, 'Awarded', 'pre-award tender advances to Awarded');

    const start = await request('POST', `/api/workflow/${eid}/start-work`, {}, siteEngineerToken);
    assert.equal(start.status, 200, JSON.stringify(start.body));
    assert.equal((await estimateState(eid)).Status, 'WorkStarted');
  });

  it('negative gates: agreement failure leaves the estimate untouched; wrong owner cannot start work', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);

    const created = await makeTender(eid);
    const tid = created.body.TenderID;
    await request('POST', `/api/tender/${tid}/publish`, {}, tenderToken);
    await reachAward(eid, tid);
    await issueWokOrder(tid, 'WO-RC-004');

    const beforeState = await estimateState(eid);
    const beforeTender = await tenderStateRow(tid);

    // Missing AgreementNo → rollback mirrors no partial update.
    const badAg = await request('POST', `/api/bids/tender/${tid}/agreement`, {}, directorToken);
    assert.equal(badAg.status, 400, 'agreement number required');
    const ehAfter = await estimateState(eid);
    assert.deepEqual(ehAfter, beforeState, 'estimate untouched by a failed agreement');
    const trow = await tenderStateRow(tid);
    assert.equal(trow.Status, beforeTender.Status, 'tender untouched by a failed agreement');

    // A non-owner (Director, mid-chain, estimate still TenderPublished) cannot start work.
    const startDir = await request('POST', `/api/workflow/${eid}/start-work`, {}, directorToken);
    assert.equal(startDir.status, 403, 'only the SiteEngineer owner can start work');
    const startNoAgency = await request('POST', `/api/workflow/${eid}/start-work`, {}, siteEngineerToken);
    assert.equal(startNoAgency.status, 403, 'SiteEngineer not owner yet — cannot start work');
  });

  it('negative gate: StartWork without an Agency record fails', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);
    await makeEstimateTenderPublished(eid);

    const created = await makeTender(eid);
    const tid = created.body.TenderID;
    await request('POST', `/api/tender/${tid}/publish`, {}, tenderToken);
    await request('POST', '/api/agency', {
      EstimateID: eid, AgencyName: 'Temp Agency', AgencyCode: 'TMP-001',
      AgreementNo: 'AGT-TMP-001', AgreementDate: day(0), TenderValue: 1000000,
      CompletionPeriod: '6 months', SecurityDeposit: 50000, PerformanceGuarantee: 100000,
      ContractorName: 'Temp Contractor', ContactDetails: 'temp@test.in',
    }, directorToken);
    await request('POST', `/api/workflow/${eid}/select-agency`, {}, directorToken);
    assert.equal((await estimateState(eid)).Status, 'AgencySelected');

    await db.query('DELETE FROM "Agency" WHERE "EstimateID" = $1', [eid]);
    const start = await request('POST', `/api/workflow/${eid}/start-work`, {}, siteEngineerToken);
    assert.equal(start.status, 400, 'StartWork without an Agency record must fail');
    assert.equal((await estimateState(eid)).Status, 'AgencySelected', 'estimate remains execution-ready');
  });
});