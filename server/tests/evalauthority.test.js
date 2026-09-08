// Evaluation Authority + structured technical checklist (Migration 043).
// Ownership split under test:
//   TenderOfficer: tender prep / publication / bid closing admin / bid opening
//   Configured Evaluation Authority (per-tender, default = creating TenderOfficer):
//     technical evaluation, financial evaluation, L1
//   DirectorOfAdministration: work award
//
// Asserts the per-tender gate (non-assigned TenderOfficer is blocked, a
// reassigned authority can evaluate and the creator then cannot) and the JSONB
// checklist contract (persisted; any failed criterion force-disqualifies even
// when the payload claims qualified; disqualified bids are never ranked).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const app = require('../app');
const db = require('../config/db');
const { trackEstimate, trackUser, cleanupTrackedData } = require('./cleanup');
const { resolveLocation } = require('./helpers');

const SERVER_PORT = 5435;

function makeToken(user) {
  return jwt.sign({ ...user, iat: Math.floor(Date.now() / 1000) }, process.env.JWT_SECRET || 'hmwssb-jwt-secret-key-2024', { expiresIn: '1h' });
}

let server;
let tenderToken, directorToken, managerToken, dgmToken, gmToken, cgmToken, dopToken, edToken, mdToken;
let location, items, toId;

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
function extractOtp(captured) { const m = captured.match(/(\d{6})/); return m ? m[1] : null; }

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
  items = (await request('GET', '/api/items?limit=1000', null, managerToken)).body;
  toId = (await db.query('SELECT "UserID" FROM "Users" WHERE "Username" = $1', ['tender_officer'])).rows[0].UserID;
});

after(async () => {
  await cleanupTrackedData();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

async function createEstimate() {
  const payload = {
    NameOfWork: 'EvalAuth Test ' + Date.now(),
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
    const { captured } = await captureOtpFromLog(() => request('POST', `/api/workflow/${eid}${url}/request-otp`, {}, tok));
    const r = await request('POST', `/api/workflow/${eid}${url}`, { otpCode: extractOtp(captured) }, tok);
    assert.equal(r.status, 200, url + ' failed: ' + JSON.stringify(r.body));
  }
  async function sign(tok) {
    const { captured } = await captureOtpFromLog(() => request('POST', `/api/workflow/${eid}/sign/request-otp`, {}, tok));
    const g = await request('POST', `/api/workflow/${eid}/sign`, { otpCode: extractOtp(captured), certificateId: 'HMWSSB-DSC-T3-001' }, tok);
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
    ReferenceNo: 'REF-EA-' + Date.now(), TenderInvitingAuthority: 'Executive Engineer, HMWSSB',
    OfficerInvitingBids: 'Dy. Executive Engineer', BidOpeningAuthority: 'Superintending Engineer',
    PreBidMeetingDate: day(-4), BidStartDate: day(-3), BidEndDate: day(+7),
    TechnicalBidOpeningDate: day(+7), BidValidity: 90, EMD: 50000, TenderFee: 1000,
    CompletionPeriod: '6 months', ScopeOfWork: 'Supply and laying of distribution network',
    EligibilityCriteria: 'Registered contractor, 3 yrs exp', RequiredDocuments: 'GST, PAN',
    PerformanceSecurity: '5%', EvaluationType: 'Percentage',
  };
}

const ALL_PASS = ['Eligibility', 'Registration', 'Experience', 'Qualification', 'Financial Capacity', 'Technical Compliance', 'Required Documents']
  .map((c) => ({ Criterion: c, Passed: true }));
function checklistWithFailure(criterion) {
  return ALL_PASS.map(c => c.Criterion === criterion ? { ...c, Passed: false } : c);
}

describe('Evaluation Authority + structured technical checklist (043)', () => {
  it('per-tender authority gate + JSONB checklist force-disqualification', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);

    const created = await request('POST', '/api/tender', { EstimateID: eid, ...draftPayload() }, tenderToken);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const tid = created.body.TenderID;
    assert.equal(created.body.EvaluationAuthorityID, toId, 'creator TenderOfficer is the default evaluation authority');
    await request('POST', `/api/tender/${tid}/publish`, {}, tenderToken);

    // A second TenderOfficer (not assigned) — real DB row so FK-bearing writes work.
    const to2row = (await db.query(
      `INSERT INTO "Users" ("Username","Name","Email","Designation","PasswordHash")
       VALUES ('eval_to2','Eval Authority Two','eval_to2@hmwssb.in','TenderOfficer','x')
       RETURNING "UserID"`)).rows[0];
    const to2Id = to2row.UserID;
    trackUser(to2Id);
    const to2Token = makeToken({ UserID: to2Id, Username: 'eval_to2', Name: 'Eval Authority Two', Designation: 'TenderOfficer' });

    const alpha = (await request('POST', `/api/bids/tender/${tid}`, { ContractorName: 'Alpha Constructions', FinancialBidAmount: 2410000, EMD: 50000 }, tenderToken)).body.BidID;
    const beta = (await request('POST', `/api/bids/tender/${tid}`, { ContractorName: 'Beta Constructions', FinancialBidAmount: 2470000, EMD: 50000 }, tenderToken)).body.BidID;
    await request('POST', `/api/tender/${tid}/close`, {}, tenderToken);
    await request('POST', `/api/tender/${tid}/bid-opening/start`, {}, tenderToken);
    for (const bid of [alpha, beta]) await request('POST', `/api/bids/${bid}/open`, {}, tenderToken);
    const complete = await request('POST', `/api/tender/${tid}/bid-opening/complete`, {}, tenderToken);
    assert.equal(complete.body.effectiveStatus, 'TechnicalEvaluationPending');

    // ── Per-tender gate: an unassigned TenderOfficer is a stranger ──────────────
    const strangerEval = await request('POST', `/api/bids/tender/${tid}/evaluate/technical`,
      { results: [{ BidID: alpha, Qualified: true }] }, to2Token);
    assert.equal(strangerEval.status, 403, 'unassigned TenderOfficer must not evaluate');

    // Creator (assigned) sees the eval controls; stranger's capability flags hide them.
    const capsCreator = (await request('GET', `/api/tender/${tid}`, null, tenderToken)).body;
    assert.equal(capsCreator.canEvaluateTechnical, true, 'creator (authority) can evaluate');
    assert.equal(capsCreator.isEvaluationAuthority, true);
    const capsStranger = (await request('GET', `/api/tender/${tid}`, null, to2Token)).body;
    assert.equal(capsStranger.canEvaluateTechnical, false, 'stranger capability hidden');
    assert.equal(capsStranger.isEvaluationAuthority, false);

    // ── Reassign authority: creator loses it, the assigned user gains it ────────
    await db.query('UPDATE "Tender" SET "EvaluationAuthorityID" = $1 WHERE "TenderID" = $2', [to2Id, tid]);
    const creatorNow = await request('POST', `/api/bids/tender/${tid}/evaluate/technical`,
      { results: [{ BidID: alpha, Qualified: true }] }, tenderToken);
    assert.equal(creatorNow.status, 403, 'creator is no longer the authority after reassignment');
    const named = (await request('GET', `/api/tender/${tid}`, null, to2Token)).body;
    assert.equal(named.EvaluationAuthorityName, 'Eval Authority Two', 'authority name is exposed');

    // ── Structured checklist with a failed criterion forces Disqualified ────────
    const tech = await request('POST', `/api/bids/tender/${tid}/evaluate/technical`, {
      results: [
        { BidID: alpha, Qualified: true, Remarks: 'All clear', Checklist: ALL_PASS },
        { BidID: beta, Qualified: true, Remarks: 'Claims qualified', Checklist: checklistWithFailure('Experience') },
      ],
    }, to2Token);
    assert.equal(tech.status, 200, JSON.stringify(tech.body));
    assert.equal(tech.body.tenderStatus, 'FinancialEvaluationPending', 'all technicals done');
    const aRow = (await db.query('SELECT "TechnicalStatus","TechnicalChecklist" FROM "Bid" WHERE "BidID" = $1', [alpha])).rows[0];
    const bRow = (await db.query('SELECT "TechnicalStatus","TechnicalChecklist" FROM "Bid" WHERE "BidID" = $1', [beta])).rows[0];
    assert.equal(aRow.TechnicalStatus, 'Qualified', 'all-pass checklist keeps the qualified result');
    assert.equal(bRow.TechnicalStatus, 'Disqualified', 'failed criterion forces disqualification despite Qualified:true');
    assert.equal(aRow.TechnicalChecklist.length, 7, 'checklist persisted as JSONB (alpha)');
    assert.equal(bRow.TechnicalChecklist.find(c => c.Criterion === 'Experience').Passed, false, 'failed criterion persisted (beta)');

    // ── Financial evaluation: the creator (now stripped of authority) is blocked ──
    const strangerFin = await request('POST', `/api/bids/tender/${tid}/evaluate/financial`, {}, tenderToken);
    assert.equal(strangerFin.status, 403, 'former authority must not run financial eval after reassignment');
    const fin = await request('POST', `/api/bids/tender/${tid}/evaluate/financial`, {}, to2Token);
    assert.equal(fin.status, 200, JSON.stringify(fin.body));
    assert.equal(fin.body.ranked.length, 1, 'only the qualified bid enters financial ranking');
    assert.equal(fin.body.ranked[0].BidID, alpha, 'lowest quote ranked first');
    const bRow2 = (await db.query('SELECT "Rank" FROM "Bid" WHERE "BidID" = $1', [beta])).rows[0];
    assert.equal(bRow2.Rank, null, 'checklist-disqualified bid is never ranked');

    // ── L1 by the assigned authority only, then Director award (handoff intact) ──
    const strangerL1 = await request('POST', `/api/bids/tender/${tid}/l1`, {}, tenderToken);
    assert.equal(strangerL1.status, 403, 'former authority must not identify L1 after reassignment');
    const l1 = await request('POST', `/api/bids/tender/${tid}/l1`, {}, to2Token);
    assert.equal(l1.status, 200, JSON.stringify(l1.body));
    assert.equal(l1.body.l1.BidID, alpha, 'L1 persisted');
    const award = await request('POST', `/api/bids/tender/${tid}/award`, { BidID: alpha }, directorToken);
    assert.equal(award.status, 200, JSON.stringify(award.body));
    assert.equal(award.body.tenderStatus, 'WorkAwarded', 'handoff from authority to Director intact');
  });
});