// Letter of Award (LOA) — sits between Work Award and Work Order. Walks the
// standard pipeline only up to WorkAwarded, then exercises:
//   403 for non-Director generate
//   generate → 201, LOANumber format, single persisted row
//   generate again → idempotent 200, same row (no duplicate, survives refresh)
//   get → full data-driven fields (awarded agency, amount in words, location)
//   print → Status Generated→Printed, audited, stays Printed
//   Tender.Status unchanged (still WorkAwarded); work order still issueable
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const db = require('../config/db');
const { trackEstimate, cleanupTrackedData } = require('./cleanup');
const { resolveLocation } = require('./helpers');

let server;
let tenderToken, directorToken, managerToken;

const SERVER_PORT = 5435;
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

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
const extractOtp = (captured) => { const m = captured.match(/(\d{6})/); return m ? m[1] : null; };

before(async () => {
  await new Promise((resolve) => { server = app.listen(SERVER_PORT, resolve); });
  const login = async (u) => (await request('POST', '/api/auth/login', { username: u, password: 'password123' })).body.token;
  managerToken = await login('manager');
  tenderToken = await login('tender_officer');
  directorToken = await login('director_admin');
});

after(async () => {
  await cleanupTrackedData();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

async function createEstimate(items) {
  const payload = {
    NameOfWork: 'LOA Test ' + Date.now(),
    WorkCategory: 'Water Supply',
    RegionID: items.location.RegionID,
    WardID: items.location.WardID,
    GSTPercent: 18,
    LSProvision: 0,
    AdditionalItems: [],
    Items: items.list.slice(0, 3).map(function (it) {
      return { ItemID: it.ItemID, Category: it.Category, FormulaType: it.FormulaType, Unit: it.Unit, Rate: it.Rate, N: 3, L: 2, B: 1, D: 1 };
    }),
  };
  const r = await request('POST', '/api/estimates', payload, managerToken);
  assert.equal(r.status, 201, JSON.stringify(r.body));
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
  const md = await loginHelper('md');
  const gm = await loginHelper('gm');
  await step('/submit', managerToken);
  await step('/approve', await loginHelper('dgm'));
  await sign(gm);
  await step('/cgm-submit', await loginHelper('cgm'));
  await step('/dop-approve', await loginHelper('dop'));
  await step('/ed-approve', await loginHelper('ed'));
  await step('/md-final', md);
  await request('POST', `/api/workflow/${eid}/generate-fcn`, { remarks: 'FCN' }, directorToken);
  await request('POST', `/api/workflow/${eid}/generate-admin-sanction`, { sanctionNo: 'PL-SAN-' + Date.now() }, directorToken);
  await request('POST', `/api/workflow/${eid}/assign-ts-authority`, { AuthorityRole: 'GM' }, directorToken);
  const approve = await request('POST', `/api/workflow/${eid}/approve-ts`, { remarks: 'TS ok' }, gm);
  assert.equal(approve.status, 200, 'approve-ts failed: ' + JSON.stringify(approve.body));
}

async function loginHelper(u) {
  return (await request('POST', '/api/auth/login', { username: u, password: 'password123' })).body.token;
}

function draftPayload() {
  return {
    TenderType: 'Open', TenderCategory: 'Water Supply', BiddingType: 'Two Cover',
    ReferenceNo: 'REF-LOA-' + Date.now(), TenderInvitingAuthority: 'Executive Engineer, HMWSSB',
    OfficerInvitingBids: 'Dy. Executive Engineer', BidOpeningAuthority: 'Superintending Engineer',
    PreBidMeetingDate: day(-4), BidStartDate: day(-3), BidEndDate: day(+7),
    TechnicalBidOpeningDate: day(+7), BidValidity: 90, EMD: 50000, TenderFee: 1000,
    CompletionPeriod: '6 months', ScopeOfWork: 'Supply and laying of distribution network',
    EligibilityCriteria: 'Registered contractor, 3 yrs exp', RequiredDocuments: 'GST, PAN',
    PerformanceSecurity: '5%', EvaluationType: 'Percentage', SpecialConditions: 'On-site safety mandatory',
  };
}

async function makeTender(eid, payload) {
  const created = await request('POST', '/api/tender', { EstimateID: eid, ...payload }, tenderToken);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return created.body;
}

async function submitBid(tid, ContractorName, FinancialBidAmount) {
  const b = await request('POST', `/api/bids/tender/${tid}`, { ContractorName, FinancialBidAmount, EMD: 50000 }, tenderToken);
  assert.equal(b.status, 201, JSON.stringify(b.body));
  return b.body.BidID;
}

async function hasAudit(eid, action) {
  const r = await db.query('SELECT 1 FROM "AuditLog" WHERE "EstimateID"=$1 AND "Action"=$2 LIMIT 1', [eid, action]);
  return r.rows.length > 0;
}

describe('Letter of Award: award → LOA (persisted, duplicate-proof) → work order', () => {
  it('generates, idempotently re-generates, prints, and preserves WorkOrder handoff', async () => {
    const resLoc = await resolveLocation(request, managerToken);
    const itemsRes = await request('GET', '/api/items?limit=1000', null, managerToken);
    const items = itemsRes.body;
    const est = await createEstimate({ location: resLoc, list: items });
    const eid = est.EstimateID;
    trackEstimate(eid);
    await advanceToTSApproved(eid);
    const tender = await makeTender(eid, draftPayload());
    const tid = tender.TenderID;

    await request('POST', `/api/tender/${tid}/publish`, {}, tenderToken);
    const alpha = await submitBid(tid, 'Alpha Constructions', 2410000);
    const beta = await submitBid(tid, 'Beta Constructions', 2470000);
    await request('POST', `/api/tender/${tid}/close`, {}, tenderToken);
    await request('POST', `/api/tender/${tid}/bid-opening/start`, {}, tenderToken);
    for (const bidId of [alpha, beta]) await request('POST', `/api/bids/${bidId}/open`, {}, tenderToken);
    await request('POST', `/api/tender/${tid}/bid-opening/complete`, {}, tenderToken);
    const tech = await request('POST', `/api/bids/tender/${tid}/evaluate/technical`, {
      results: [
        { BidID: alpha, Qualified: true, Remarks: 'Meets criteria' },
        { BidID: beta, Qualified: true, Remarks: 'Meets criteria' },
      ],
    }, tenderToken);
    assert.equal(tech.status, 200, JSON.stringify(tech.body));
    await request('POST', `/api/bids/tender/${tid}/evaluate/financial`, {}, tenderToken);
    const l1 = await request('POST', `/api/bids/tender/${tid}/l1`, {}, tenderToken);
    assert.equal(l1.status, 200, JSON.stringify(l1.body));
    const award = await request('POST', `/api/bids/tender/${tid}/award`, { BidID: alpha }, directorToken);
    assert.equal(award.status, 200, JSON.stringify(award.body));
    assert.equal(award.body.tenderStatus, 'WorkAwarded');

    // After award no LOA exists yet.
    const noneYet = await request('GET', `/api/loa/tender/${tid}`, null, directorToken);
    assert.equal(noneYet.status, 404, 'no LOA before generation');

    // Director detail-view shows the capability to generate.
    const detail = await request('GET', `/api/tender/${tid}`, null, directorToken);
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.canIssueLOA, true, 'Director can generate LOA after award');
    const detailOfficer = await request('GET', `/api/tender/${tid}`, null, tenderToken);
    assert.equal(detailOfficer.body.canIssueLOA, false, 'TenderOfficer cannot');

    // ── Negative: officer cannot generate ──────────────────────────────────────
    const byOfficer = await request('POST', `/api/loa/tender/${tid}/generate`, {}, tenderToken);
    assert.equal(byOfficer.status, 403, 'LOA generation is Director-only');

    // ── Generate (Director) ─────────────────────────────────────────────────────
    const gen = await request('POST', `/api/loa/tender/${tid}/generate`, {}, directorToken);
    assert.equal(gen.status, 201, JSON.stringify(gen.body));
    assert.match(gen.body.LOANumber, /^LOA\/\d{4}-\d{2}\/\d{6}$/, 'LOA number auto-generated LOA/<FY>/<6digits>');
    assert.equal(gen.body.Status, 'Generated');
    assert.equal(gen.body.TenderStatus, 'WorkAwarded', 'Tender.Status untouched by LOA');
    assert.equal(gen.body.ContractorName, 'Alpha Constructions');
    assert.equal(Number(gen.body.AwardAmount), 2410000);
    assert.ok(gen.body.AwardAmountInWords, 'amount in words present');
    assert.ok(gen.body.locationLine, 'location line present');
    assert.ok(await hasAudit(eid, 'LOA_GENERATED'), 'generation audited');

    // ── Idempotency: repeat generate (refresh/double-click) → same row, no dup ──
    const dup = await request('POST', `/api/loa/tender/${tid}/generate`, {}, directorToken);
    assert.equal(dup.status, 200, 'repeat generate returns existing LOA');
    assert.equal(dup.body.LOAID, gen.body.LOAID, 'same LOA row returned');
    assert.equal(dup.body.LOANumber, gen.body.LOANumber, 'same LOA number on repeat');
    const rows = (await db.query('SELECT COUNT(*)::int AS n FROM "LetterOfAward" WHERE "TenderID"=$1', [tid])).rows[0];
    assert.equal(rows.n, 1, 'exactly one LOA row persisted across repeats');

    // ── Read after "refresh": fields come from the persisted chain ──────────────
    const got = await request('GET', `/api/loa/tender/${tid}`, null, directorToken);
    assert.equal(got.status, 200, JSON.stringify(got.body));
    assert.equal(got.body.LOANumber, gen.body.LOANumber);
    assert.ok(got.body.AgencyName || got.body.ContractorName, 'awarded agency/contractor present');
    assert.ok(got.body.NameOfWork, 'work name present');
    assert.ok(got.body.EstimateNo, 'estimate number present');
    assert.ok(got.body.TenderNo, 'tender number present');

    // ── Print → Generated→Printed, audited, stays Printed on repeat ─────────────
    const print1 = await request('POST', `/api/loa/tender/${tid}/print`, {}, directorToken);
    assert.equal(print1.status, 200, JSON.stringify(print1.body));
    assert.equal(print1.body.Status, 'Printed');
    assert.ok(await hasAudit(eid, 'LOA_PRINTED'), 'print audited');
    const after = await request('GET', `/api/loa/tender/${tid}`, null, directorToken);
    assert.equal(after.body.Status, 'Printed');
    assert.ok(after.body.PrintedAt, 'printed timestamp captured');
    const print2 = await request('POST', `/api/loa/tender/${tid}/print`, {}, directorToken);
    assert.equal(print2.body.Status, 'Printed', 'repeat print stays Printed');

    // ── Work Order handoff intact: LOA did not advance the tender ───────────────
    const still = await request('GET', `/api/tender/${tid}`, null, directorToken);
    assert.equal(still.body.Status, 'WorkAwarded');
    const wo = await request('POST', `/api/bids/tender/${tid}/work-order`, { WorkOrderNo: 'WO-LOA-781' }, directorToken);
    assert.equal(wo.status, 200, 'work order still issueable after LOA: ' + JSON.stringify(wo.body));
    assert.equal(wo.body.tenderStatus, 'WorkOrderIssued');
    const afterWo = await request('GET', `/api/tender/${tid}`, null, directorToken);
    assert.equal(afterWo.status, 200, JSON.stringify(afterWo.body));
    assert.equal(afterWo.body.canIssueLOA, false, 'LOA capability gone once Work Order issued');
  });
});