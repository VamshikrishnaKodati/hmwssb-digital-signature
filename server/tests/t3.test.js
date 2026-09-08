const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const db = require('../config/db');
const { trackEstimate, cleanupTrackedData } = require('./cleanup');
const { resolveLocation } = require('./helpers');

let server;
let managerToken, dgmToken, gmToken, cgmToken, dopToken, edToken, mdToken;
let tenderToken, directorToken;
let location, items;
let activeBidID, activeContractorID;

// Unique port so tests can run in parallel with the existing suites.
const SERVER_PORT = 5433;

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
    NameOfWork: 'T3 Test ' + Date.now(),
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

  const fcn = await request('POST', '/api/workflow/' + eid + '/generate-fcn', { remarks: 'FCN' }, directorToken);
  assert.equal(fcn.status, 200, 'fcn failed');
  const san = await request('POST', '/api/workflow/' + eid + '/generate-admin-sanction', { sanctionNo: 'T3-SAN-' + Date.now(), remarks: 'san' }, directorToken);
  assert.equal(san.status, 200, 'sanction failed');
  const assign = await request('POST', '/api/workflow/' + eid + '/assign-ts-authority', { AuthorityRole: 'GM', remarks: 'assign GM' }, directorToken);
  assert.equal(assign.status, 200, 'assign failed');
  const approve = await request('POST', '/api/workflow/' + eid + '/approve-ts', { remarks: 'TS ok' }, gmToken);
  assert.equal(approve.status, 200, 'approve-ts failed: ' + JSON.stringify(approve.body));
}

// Full, publishable draft. Window + opening are relative to "today" so the
// flow works on any clock (T3 enforces windows by server time).
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
function draftPayload(opts) {
  return {
    TenderType: 'Open', TenderCategory: 'Water Supply', BiddingType: 'Two Cover',
    ReferenceNo: 'REF-T3-' + Date.now(), TenderInvitingAuthority: 'Executive Engineer, HMWSSB',
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

async function notificationToPo(eid, type) {
  const r = await db.query(
    `SELECT n."ToUserID", u."Designation" FROM "Notification" n
     JOIN "Users" u ON u."UserID" = n."ToUserID"
     WHERE n."EstimateID"=$1 AND n."Type"=$2 LIMIT 1`, [eid, type]);
  return r.rows[0] || null;
}

describe('T3: Publication Gate · Bid Submission · Bid Opening', () => {
  it('publish blocks an incomplete draft (readiness) then allows once complete', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);

    // Minimal draft: no NIT fields yet → not publishable.
    const minimal = await makeTender(eid, { TenderType: 'Open' });
    const tid = minimal.TenderID;

    let res = await request('POST', `/api/tender/${tid}/publish`, {}, tenderToken);
    assert.equal(res.status, 422, 'incomplete draft must not publish: ' + JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body.details) && res.body.details.length > 0, 'should list unmet requirements');

    // Complete the draft and add one required document WITH a file path.
    const upd = await request('PUT', `/api/tender/${tid}`, draftPayload(), tenderToken);
    assert.equal(upd.status, 200, JSON.stringify(upd.body));
    await request('POST', `/api/tender/${tid}/documents`, { DocumentName: 'NIT', DocumentType: 'NIT', Required: true, FilePath: 'uploads/nit.pdf' }, tenderToken);

    res = await request('POST', `/api/tender/${tid}/publish`, {}, tenderToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.Status, 'Published');
    assert.ok(res.body.PublishedDate, 'PublishedDate set on publish');
    assert.ok(res.body.PublishedBy, 'PublishedBy set on publish');
    assert.ok(res.body.Version >= 2, 'publish bumps the page version');

    // Duplicate publish → 409; post-publish edit (PublishedDate discriminator) → locked.
    const dup = await request('POST', `/api/tender/${tid}/publish`, {}, tenderToken);
    assert.equal(dup.status, 409, JSON.stringify(dup.body));
    const locked = await request('PUT', `/api/tender/${tid}`, { EMD: 1 }, tenderToken);
    assert.equal(locked.status, 400, 'published tender must be edit-locked: ' + JSON.stringify(locked.body));
  });

  it('records submission refs, dedupes contractors, masks financials, segregates documents', async () => {
    const est = await createEstimate();
    const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid);
    await advanceToTSApproved(eid);
    const tender = await makeTender(eid, draftPayload());
    await request('POST', `/api/tender/${tender.TenderID}/publish`, {}, tenderToken);
    const tid = tender.TenderID;

    const b1 = await request('POST', `/api/bids/tender/${tid}`, {
      ContractorName: 'Alpha T3', RegistrationNo: 'REG-ALPHA-T3', Email: 'alpha@t3.in',
      FinancialBidAmount: 2485000, EMD: 50000,
      Documents: [
        { Category: 'Technical', DocumentName: 'Exp certificates' },
        { Category: 'Financial', DocumentName: 'Quoted BOQ' },
        { Category: 'EMD', DocumentName: 'Bid security' },
        { Category: 'Declaration', DocumentName: 'Undertaking' },
      ],
    }, tenderToken);
    assert.equal(b1.status, 201, JSON.stringify(b1.body));
    assert.ok(b1.body.SubmissionReference && b1.body.SubmissionReference.startsWith('SB-'), 'ref issued: ' + b1.body.SubmissionReference);
    activeBidID = b1.body.BidID;
    activeContractorID = b1.body.ContractorID;

    const b2 = await request('POST', `/api/bids/tender/${tid}`, {
      ContractorName: 'Beta T3', RegistrationNo: 'REG-BETA-T3', Email: 'beta@t3.in',
      FinancialBidAmount: 2421000, EMD: 50000,
    }, tenderToken);
    assert.equal(b2.status, 201, JSON.stringify(b2.body));

    // One submission per bidder — reusing the same contractor identity is rejected.
    const dup = await request('POST', `/api/bids/tender/${tid}`, {
      ContractorID: activeContractorID, ContractorName: 'Alpha T3', RegistrationNo: 'REG-ALPHA-T3', FinancialBidAmount: 1,
    }, tenderToken);
    assert.equal(dup.status, 409, JSON.stringify(dup.body));

    // Financials masked for everyone (no role holds bid.financial.view by default).
    const list = await request('GET', `/api/bids/tender/${tid}`, null, tenderToken);
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 2, 'two stored bids');
    assert.ok(list.body.every(b => b.FinancialBidAmount === null), 'financial amounts masked to TenderOfficer');

    // Segregated documents are registered against the bid.
    const docs = await db.query('SELECT "Category" FROM "BidDocument" WHERE "BidID" = $1', [activeBidID]);
    assert.equal(docs.rows.length, 4, 'four categorized documents stored');
    assert.deepEqual(docs.rows.map(r => r.Category).sort(), ['Declaration', 'EMD', 'Financial', 'Technical']);

    assert.ok(await hasAudit(eid, 'BID_SUBMITTED'), 'submission audited');
  });

  it('enforces the window on the server clock (early and auto-expired reject)', async () => {
    // Tender not yet open → early bids rejected.
    const estEarly = await createEstimate(); const eidE = estEarly.EstimateID || estEarly.estimateId;
    trackEstimate(eidE); await advanceToTSApproved(eidE);
    const early = await makeTender(eidE, draftPayload({ BidStartDate: day(+5), BidEndDate: day(+10), TechnicalBidOpeningDate: day(+10) }));
    await request('POST', `/api/tender/${early.TenderID}/publish`, {}, tenderToken);
    const earlyBid = await request('POST', `/api/bids/tender/${early.TenderID}`, { ContractorName: 'Too Soon', FinancialBidAmount: 100 }, tenderToken);
    assert.equal(earlyBid.status, 400, 'early bid must be rejected: ' + JSON.stringify(earlyBid.body));

    // Window already over → the write path persists the close, then rejects.
    const estExpired = await createEstimate(); const eidX = estExpired.EstimateID || estExpired.estimateId;
    trackEstimate(eidX); await advanceToTSApproved(eidX);
    const expired = await makeTender(eidX, draftPayload({ BidEndDate: day(-1), TechnicalBidOpeningDate: day(-1) }));
    await request('POST', `/api/tender/${expired.TenderID}/publish`, {}, tenderToken);
    const lateBid = await request('POST', `/api/bids/tender/${expired.TenderID}`, { ContractorName: 'Too Late', FinancialBidAmount: 100 }, tenderToken);
    assert.equal(lateBid.status, 400, 'late bid must be rejected: ' + JSON.stringify(lateBid.body));

    const row = await db.query('SELECT "Status","BidsClosedAt" FROM "Tender" WHERE "TenderID" = $1', [expired.TenderID]);
    assert.equal(row.rows[0].Status, 'BidsClosed', 'expiry persisted BidsClosed');
    assert.ok(row.rows[0].BidsClosedAt, 'expiry stamped BidsClosedAt');
    assert.ok(await hasAudit(eidX, 'BID_SUBMISSION_CLOSED'), 'auto-close audited');
    const n = await notificationToPo(eidX, 'BidOpening');
    assert.ok(n && n.Designation === 'TenderOfficer', 'opening authority (owner) notified on close');
  });

  it('manual close + GET reports effective status from the window', async () => {
    const est = await createEstimate(); const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid); await advanceToTSApproved(eid);
    const tender = await makeTender(eid, draftPayload());
    await request('POST', `/api/tender/${tender.TenderID}/publish`, {}, tenderToken);
    const tid = tender.TenderID;

    const openGet = await request('GET', `/api/tender/${tid}`, null, tenderToken);
    assert.ok(['Published', 'BidSubmissionOpen'].includes(openGet.body.effectiveStatus),
      'window open status computed: ' + openGet.body.effectiveStatus);

    const closed = await request('POST', `/api/tender/${tid}/close`, {}, tenderToken);
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.equal(closed.body.effectiveStatus, 'BidsClosed');

    const after = await request('GET', `/api/tender/${tid}`, null, tenderToken);
    assert.equal(after.body.effectiveStatus, 'BidsClosed');

    const late = await request('POST', `/api/bids/tender/${tid}`, { ContractorName: 'After Close', FinancialBidAmount: 100 }, tenderToken);
    assert.equal(late.status, 400, 'bid after close rejected');
    assert.ok(await hasAudit(eid, 'BID_SUBMISSION_CLOSED'), 'close audited');
  });

  it('bid opening: TenderOfficer owns opening (Option 1) → complete → TechnicalEvaluationPending', async () => {
    const est = await createEstimate(); const eid = est.EstimateID || est.estimateId;
    trackEstimate(eid); await advanceToTSApproved(eid);
    const tender = await makeTender(eid, draftPayload());
    await request('POST', `/api/tender/${tender.TenderID}/publish`, {}, tenderToken);
    const tid = tender.TenderID;
    const b = await request('POST', `/api/bids/tender/${tid}`, { ContractorName: 'Opening Bidder', FinancialBidAmount: 1000000 }, tenderToken);
    assert.equal(b.status, 201);
    const bidId = b.body.BidID;
    await request('POST', `/api/tender/${tid}/close`, {}, tenderToken);

    // Director may view the opening screen (bid.view retained) but must not drive it.
    const viewAsDir = await request('GET', `/api/tender/${tid}/bid-opening`, null, directorToken);
    assert.equal(viewAsDir.status, 200, JSON.stringify(viewAsDir.body));
    assert.equal(viewAsDir.body.counts.received, 1);

    const startAsDir = await request('POST', `/api/tender/${tid}/bid-opening/start`, {}, directorToken);
    assert.equal(startAsDir.status, 403, 'Director must not start opening (canonical owner is TenderOfficer)');

    const start = await request('POST', `/api/tender/${tid}/bid-opening/start`, {}, tenderToken);
    assert.equal(start.status, 200, JSON.stringify(start.body));
    assert.equal(start.body.effectiveStatus, 'BidOpeningInProgress');

    const opened = await request('POST', `/api/bids/${bidId}/open`, {}, tenderToken);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert.equal(opened.body.OpeningStatus, 'Opened');
    const openedAgain = await request('POST', `/api/bids/${bidId}/open`, {}, tenderToken);
    assert.equal(openedAgain.status, 200);
    assert.equal(openedAgain.body.alreadyOpened, true, 'open is idempotent');

    const asDir = await request('POST', `/api/bids/${bidId}/open`, {}, directorToken);
    assert.equal(asDir.status, 403, 'opening a bid requires bid.open (TenderOfficer, not Director)');

    const complete = await request('POST', `/api/tender/${tid}/bid-opening/complete`, { remarks: 'sealed' }, tenderToken);
    assert.equal(complete.status, 200, JSON.stringify(complete.body));
    assert.equal(complete.body.effectiveStatus, 'TechnicalEvaluationPending');
    assert.ok(await hasAudit(eid, 'BID_OPENING_COMPLETED'));
    assert.ok(await hasAudit(eid, 'TECHNICAL_EVALUATION_PENDING'));
    const inv = await notificationToPo(eid, 'BidOpening');
    assert.ok(inv && inv.Designation === 'TenderOfficer', 'opening-authority (owner) notified after completion');
  });

  it('dashboard KPIs reflect the T3 pipeline after all transitions', async () => {
    const dash = await request('GET', '/api/dashboard/stats', null, tenderToken);
    const m = dash.body.tenderOfficerDashboard.metrics;
    for (const key of ['tenderDrafts', 'published', 'bidOpen', 'closingSoon', 'bidsClosed', 'bidOpeningInProgress', 'technicalEvaluationPending', 'underTechnicalEvaluation', 'financialEvaluationPending', 'financialEvaluation', 'l1Identified', 'bidOpening', 'evaluationHandoff', 'inPipeline', 'totalBids', 'readyForTender']) {
      assert.ok(key in m, `metric ${key} present`);
    }
    assert.ok(m.bidsClosed >= 1, 'at least one closed-for-submission tender counted (got ' + m.bidsClosed + ')');
    assert.ok(m.technicalEvaluationPending >= 1, 'opening completion counted (got ' + m.technicalEvaluationPending + ')');
    assert.ok(m.totalBids >= 2, 'submitted bids counted (got ' + m.totalBids + ')');
  });
});