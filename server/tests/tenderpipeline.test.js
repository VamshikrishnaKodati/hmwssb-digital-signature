// Pipeline hardening (Option 1): the canonical Tender-table evaluation →
// L1 → award → work-order → agreement flow, with negative gates asserted
// alongside the positives and dashboard KPI-vs-queue consistency.
//
// Ownership under test (Migration 041):
//   TenderOfficer:  bid opening + technical/financial evaluation + L1
//   DirectorOfAdministration: award, work order, agreement (bid.open revoked)
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const db = require('../config/db');
const { trackEstimate, cleanupTrackedData } = require('./cleanup');
const { resolveLocation } = require('./helpers');

let server;
let tenderToken, directorToken, managerToken, dgmToken, gmToken, cgmToken, dopToken, edToken, mdToken;
let location, items;

const SERVER_PORT = 5434;

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
    NameOfWork: 'Pipeline Test ' + Date.now(),
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
function draftPayload(opts) {
  return {
    TenderType: 'Open', TenderCategory: 'Water Supply', BiddingType: 'Two Cover',
    ReferenceNo: 'REF-PL-' + Date.now(), TenderInvitingAuthority: 'Executive Engineer, HMWSSB',
    OfficerInvitingBids: 'Dy. Executive Engineer', BidOpeningAuthority: 'Superintending Engineer',
    PreBidMeetingDate: day(-4), BidStartDate: day(-3), BidEndDate: day(+7),
    TechnicalBidOpeningDate: day(+7), BidValidity: 90, EMD: 50000, TenderFee: 1000,
    CompletionPeriod: '6 months', ScopeOfWork: 'Supply and laying of distribution network',
    EligibilityCriteria: 'Registered contractor, 3 yrs exp', RequiredDocuments: 'GST, PAN',
    PerformanceSecurity: '5%', EvaluationType: 'Percentage',
    ...(opts || {}),
  };
}

async function makeTender(eid, payload) {
  const created = await request('POST', '/api/tender', { EstimateID: eid, ...payload }, tenderToken);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return created.body;
}

async function hasAudit(eid, action) {
  const r = await db.query('SELECT 1 FROM "AuditLog" WHERE "EstimateID"=$1 AND "Action"=$2 LIMIT 1', [eid, action]);
  return r.rows.length > 0;
}

async function submitBid(tid, ContractorName, FinancialBidAmount) {
  const b = await request('POST', `/api/bids/tender/${tid}`, { ContractorName, FinancialBidAmount, EMD: 50000 }, tenderToken);
  assert.equal(b.status, 201, JSON.stringify(b.body));
  return b.body.BidID;
}

describe('Tender pipeline (Option 1): eval → L1 → award → work order → agreement', () => {
  it('runs the full pipeline with positive + negative assertions end to end', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);
    const tender = await makeTender(eid, draftPayload());
    const tid = tender.TenderID;
    await request('POST', `/api/tender/${tid}/publish`, {}, tenderToken);

    // Alpha is the lowest qualified quote (L1), Beta second, Gamma disqualified.
    const alpha = await submitBid(tid, 'Alpha Constructions', 2410000);
    const beta = await submitBid(tid, 'Beta Constructions', 2470000);
    const gamma = await submitBid(tid, 'Gamma Constructions', 2530000);
    const bidIds = { alpha, beta, gamma };

    await request('POST', `/api/tender/${tid}/close`, {}, tenderToken);

    // ── Negative: nothing may evaluate/award before the opening completes ──────
    const prematureTech = await request('POST', `/api/bids/tender/${tid}/evaluate/technical`, { results: [{ BidID: alpha, Qualified: true }] }, tenderToken);
    assert.equal(prematureTech.status, 409, 'technical eval before opening must be blocked');
    const prematureFin = await request('POST', `/api/bids/tender/${tid}/evaluate/financial`, {}, tenderToken);
    assert.equal(prematureFin.status, 409, 'financial eval before opening must be blocked');
    const prematureL1 = await request('POST', `/api/bids/tender/${tid}/l1`, {}, tenderToken);
    assert.equal(prematureL1.status, 409, 'L1 before financial evaluation must be blocked');
    const prematureAward = await request('POST', `/api/bids/tender/${tid}/award`, { BidID: alpha }, directorToken);
    assert.equal(prematureAward.status, 409, 'award before L1 must be blocked');

    // ── Bid opening (TenderOfficer, canonical owner) ───────────────────────────
    const start = await request('POST', `/api/tender/${tid}/bid-opening/start`, {}, tenderToken);
    assert.equal(start.status, 200, JSON.stringify(start.body));
    for (const id of Object.values(bidIds)) {
      const opened = await request('POST', `/api/bids/${id}/open`, {}, tenderToken);
      assert.equal(opened.status, 200, `bid ${id} open failed: ${JSON.stringify(opened.body)}`);
    }
    const complete = await request('POST', `/api/tender/${tid}/bid-opening/complete`, {}, tenderToken);
    assert.equal(complete.body.effectiveStatus, 'TechnicalEvaluationPending');

    // ── Technical evaluation (TenderOfficer / tender.evaluate) ─────────────────
    const tech = await request('POST', `/api/bids/tender/${tid}/evaluate/technical`, {
      results: [
        { BidID: alpha, Qualified: true, Remarks: 'Meets criteria' },
        { BidID: beta, Qualified: true, Remarks: 'Meets criteria' },
        { BidID: gamma, Qualified: false, Remarks: 'Insufficient track record' },
      ],
    }, tenderToken);
    assert.equal(tech.status, 200, JSON.stringify(tech.body));
    assert.equal(tech.body.tenderStatus, 'FinancialEvaluationPending', 'all technicals done');
    assert.ok(await hasAudit(eid, 'TECHNICAL_EVALUATION_STARTED'), 'evaluation start audited');
    assert.ok(await hasAudit(eid, 'TECHNICAL_EVALUATION_COMPLETED'), 'evaluation completion audited');

    // Director cannot drive evaluation (no tender.evaluate).
    const dirEval = await request('POST', `/api/bids/tender/${tid}/evaluate/financial`, {}, directorToken);
    assert.equal(dirEval.status, 403, 'Director must not run evaluation');

    // ── Financial evaluation: ranked, disqualified excluded ────────────────────
    const fin = await request('POST', `/api/bids/tender/${tid}/evaluate/financial`, {}, tenderToken);
    assert.equal(fin.status, 200, JSON.stringify(fin.body));
    assert.equal(fin.body.tenderStatus, 'FinancialEvaluation');
    assert.equal(fin.body.ranked.length, 2, 'only technically qualified bids are ranked');
    assert.equal(fin.body.ranked[0].BidID, alpha, 'lowest quote is Rank 1');
    assert.equal(fin.body.ranked[1].BidID, beta, 'second quote is Rank 2');
    const gammaRow = (await db.query('SELECT "Rank","FinancialEvaluatedAt" FROM "Bid" WHERE "BidID" = $1', [gamma])).rows[0];
    assert.equal(gammaRow.Rank, null, 'disqualified bidder is never ranked');

    // ── L1: persisted, not a frontend-only calculation ──────────────────────────
    const l1 = await request('POST', `/api/bids/tender/${tid}/l1`, {}, tenderToken);
    assert.equal(l1.status, 200, JSON.stringify(l1.body));
    assert.equal(l1.body.l1.BidID, alpha, 'Alpha persisted as L1');
    const persisted = (await db.query('SELECT * FROM "TenderEvaluation" WHERE "TenderID" = $1', [tid])).rows[0];
    assert.ok(persisted, 'TenderEvaluation row persists');
    assert.equal(persisted.SelectedBidID, alpha, 'selected bid == L1');
    assert.equal(persisted.Methodology, 'L1_LOWEST_BID');
    assert.equal(JSON.parse(JSON.stringify(persisted.Ranking)).length, 2, 'ranking snapshot has 2 entries');
    assert.ok(await hasAudit(eid, 'L1_IDENTIFIED'), 'L1 audited');
    const l1Notif = (await db.query(
      `SELECT u."Designation" FROM "Notification" n JOIN "Users" u ON u."UserID" = n."ToUserID"
       WHERE n."EstimateID"=$1 AND n."Type"='L1Identified' LIMIT 1`, [eid])).rows[0];
    assert.ok(l1Notif && l1Notif.Designation === 'DirectorOfAdministration', 'Director notified of L1');

    // ── Negative: officer cannot award; Director cannot award arbitrary bidder ───
    const officerAward = await request('POST', `/api/bids/tender/${tid}/award`, { BidID: alpha }, tenderToken);
    assert.equal(officerAward.status, 403, 'TenderOfficer must not award (tender.award is Director-only)');
    const wrongBidder = await request('POST', `/api/bids/tender/${tid}/award`, { BidID: beta }, directorToken);
    assert.equal(wrongBidder.status, 400, 'Director must award the persisted L1, not an arbitrary bid');

    // Director queue sees it as award-pending in the same blink as the KPI.
    const dashBefore = await request('GET', '/api/dashboard/stats', null, directorToken);
    const awardPending = dashBefore.body.directorAdminDashboard.metrics.awardPending;
    assert.ok(awardPending >= 1, 'award-pending KPI visible to Director');
    const queued = dashBefore.body.directorAdminDashboard.awardPipeline.filter(r => r.TenderID === tid);
    assert.equal(queued.length, 1, 'award pipeline queue contains the L1 tender');
    assert.equal(queued[0].Status, 'L1Identified');

    // ── Award (Director) → bidder becomes an Agency only now ────────────────────
    const award = await request('POST', `/api/bids/tender/${tid}/award`, { BidID: alpha }, directorToken);
    assert.equal(award.status, 200, JSON.stringify(award.body));
    assert.equal(award.body.tenderStatus, 'WorkAwarded');
    assert.equal(award.body.winner.ContractorName, 'Alpha Constructions');
    const agency = (await db.query(
      `SELECT "AgencyName","ContractorName","TenderValue" FROM "Agency" WHERE "TenderID" = $1`, [tid])).rows[0];
    assert.ok(agency, 'Agency created at award');
    assert.equal(agency.AgencyName, 'Alpha Constructions');
    assert.equal(Number(agency.TenderValue), 2410000, 'agency carries the awarded amount');
    const bidsAfter = (await db.query(
      `SELECT "BidID","IsSelected","Status" FROM "Bid" WHERE "TenderID" = $1 ORDER BY "BidID"`, [tid])).rows;
    assert.equal(bidsAfter.find(b => b.BidID === alpha).IsSelected, true);
    assert.equal(bidsAfter.find(b => b.BidID === beta).IsSelected, false, 'losing bid marked unselected');
    assert.ok(await hasAudit(eid, 'AWARD_TENDER'), 'award audited');

    // ── Negative: re-award + agreement before work order ────────────────────────
    const reAward = await request('POST', `/api/bids/tender/${tid}/award`, { BidID: alpha }, directorToken);
    assert.equal(reAward.status, 409, 'already awarded');
    const earlyAgreement = await request('POST', `/api/bids/tender/${tid}/agreement`, { AgreementNo: 'AGT-early' }, directorToken);
    assert.equal(earlyAgreement.status, 409, 'agreement requires a work order first');
    const woByOfficer = await request('POST', `/api/bids/tender/${tid}/work-order`, { WorkOrderNo: 'WO-officer' }, tenderToken);
    assert.equal(woByOfficer.status, 403, 'work order is Director-only');
    const woMissingNo = await request('POST', `/api/bids/tender/${tid}/work-order`, {}, directorToken);
    assert.equal(woMissingNo.status, 400, 'work order number required');

    // ── Work order (Director) ───────────────────────────────────────────────────
    const wo = await request('POST', `/api/bids/tender/${tid}/work-order`, { WorkOrderNo: 'WO-PL-781' }, directorToken);
    assert.equal(wo.status, 200, JSON.stringify(wo.body));
    assert.equal(wo.body.tenderStatus, 'WorkOrderIssued');
    assert.equal(wo.body.WorkOrderNo, 'WO-PL-781');
    const woAgency = (await db.query(`SELECT "WorkOrderDate" FROM "Agency" WHERE "TenderID" = $1`, [tid])).rows[0];
    assert.ok(woAgency.WorkOrderDate, 'agency stamped with work-order date');
    assert.ok(await hasAudit(eid, 'WORK_ORDER_ISSUED'), 'work order audited');
    const dupWo = await request('POST', `/api/bids/tender/${tid}/work-order`, { WorkOrderNo: 'WO-PL-999' }, directorToken);
    assert.equal(dupWo.status, 409, 'duplicate work order must conflict');

    // ── Negative: agreement before work order done is blocked (covered above);
    //    agreement by officer blocked; agreement without number blocked ──────────
    const agByOfficer = await request('POST', `/api/bids/tender/${tid}/agreement`, { AgreementNo: 'AGT-officer' }, tenderToken);
    assert.equal(agByOfficer.status, 403, 'agreement is Director-only');
    const agMissingNo = await request('POST', `/api/bids/tender/${tid}/agreement`, {}, directorToken);
    assert.equal(agMissingNo.status, 400, 'agreement number required');

    // ── Agreement (Director) ────────────────────────────────────────────────────
    const ag = await request('POST', `/api/bids/tender/${tid}/agreement`, { AgreementNo: 'AGT-PL-781' }, directorToken);
    assert.equal(ag.status, 200, JSON.stringify(ag.body));
    assert.equal(ag.body.tenderStatus, 'AgreementExecuted');
    const agAgency = (await db.query(
      `SELECT "AgreementNo","AgreementDate" FROM "Agency" WHERE "TenderID" = $1`, [tid])).rows[0];
    assert.equal(agAgency.AgreementNo, 'AGT-PL-781');
    assert.ok(agAgency.AgreementDate, 'agency stamped with agreement date');
    assert.ok(await hasAudit(eid, 'AGREEMENT_EXECUTED'), 'agreement audited');

    // Work-flow SLA resolved end to end.
    const sla = (await db.query(
      `SELECT "SlaStatus" FROM "Tender" WHERE "TenderID" = $1`, [tid])).rows[0];
    assert.equal(sla.SlaStatus, 'Resolved', 'SLA resolved by agreement');
  });

  it('dashboard KPIs equal their queue rows (KPI == queue)', async () => {
    const dash = await request('GET', '/api/dashboard/stats', null, tenderToken);
    const m = dash.body.tenderOfficerDashboard.metrics;
    const q = dash.body.tenderOfficerDashboard.pipelineQueue;
    assert.ok(Array.isArray(q), 'TenderOfficer pipeline queue present');
    const byStatus = (s) => q.filter(r => r.Status === s).length;
    assert.equal(m.inPipeline, q.length, 'inPipeline KPI == queue size');
    assert.equal(m.bidsClosed, byStatus('BidsClosed'));
    assert.equal(m.bidOpeningInProgress, byStatus('BidOpeningInProgress'));
    assert.equal(m.bidOpening, byStatus('BidsClosed') + byStatus('BidOpeningInProgress'));
    assert.equal(m.technicalEvaluationPending, byStatus('TechnicalEvaluationPending'));
    assert.equal(m.underTechnicalEvaluation, byStatus('UnderTechnicalEvaluation'));
    assert.equal(m.financialEvaluationPending, byStatus('FinancialEvaluationPending'));
    assert.equal(m.financialEvaluation, byStatus('FinancialEvaluation'));
    assert.equal(m.l1Identified, byStatus('L1Identified'));
    assert.equal(m.workAwarded, byStatus('WorkAwarded'));
    assert.equal(m.workOrderIssued, byStatus('WorkOrderIssued'));
    assert.equal(m.agreementExecuted, byStatus('AgreementExecuted'));
    assert.ok(m.agreementExecuted >= 1, 'completed agreement counted');

    const ddash = await request('GET', '/api/dashboard/stats', null, directorToken);
    const dm = ddash.body.directorAdminDashboard.metrics;
    const dq = ddash.body.directorAdminDashboard.awardPipeline;
    assert.ok(Array.isArray(dq), 'Director award pipeline present');
    assert.equal(dm.awardPending, dq.filter(r => r.Status === 'L1Identified').length, 'awardPending KPI == queue');
    assert.equal(dm.workOrderPending, dq.filter(r => r.Status === 'WorkAwarded').length, 'workOrderPending KPI == queue');
    assert.equal(dm.agreementPending, dq.filter(r => r.Status === 'WorkOrderIssued').length, 'agreementPending KPI == queue');
    assert.equal(dm.agreementsExecuted, dq.filter(r => r.Status === 'AgreementExecuted').length, 'agreementsExecuted KPI == queue');
  });
});