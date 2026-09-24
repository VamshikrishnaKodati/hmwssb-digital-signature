// Work-execution chain (estimate side): startWork -> progress/measurement ->
// completeWork, hardened per migration 052. Asserts the positives, the
// duplicates (idempotent re-submission), the owner-scope 403s, the completion
// persistence (dates/by) and the SLA start/resolve bookends.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const db = require('../config/db');
const { resolveLocation } = require('./helpers');
const { cleanupTrackedData, trackEstimate } = require('./cleanup');

const PORT = 5560;
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
    NameOfWork: name || 'Exec Test ' + Date.now(),
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

// Drive an estimate through the full approval chain, publish, agency record and
// agency selection — stopping at AgencySelected (owner: SiteEngineer) so the
// test controls the startWork/completeWork hand-offs itself.
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
  const sg = await request('POST', `/api/workflow/${estimateID}/sign`, { otpCode: signCode[1], certificateId: 'HMWSSB-DSC-EXEC-' + estimateID }, tokens.gm);
  assert.equal(sg.status, 200, 'gm sign failed');
  await step('/cgm-submit', tokens.cgm);
  await step('/dop-approve', tokens.dop);
  await step('/ed-approve', tokens.ed);
  await step('/md-final', tokens.md);
  await request('POST', `/api/workflow/${estimateID}/generate-fcn`, {}, tokens.director_admin);
  await request('POST', `/api/workflow/${estimateID}/generate-admin-sanction`, { sanctionNo: 'AS-EXEC-' + estimateID }, tokens.director_admin);
  const assign = await request('POST', `/api/workflow/${estimateID}/assign-ts-authority`, { AuthorityRole: 'GM' }, tokens.director_admin);
  assert.equal(assign.status, 200, 'assign-ts-authority: ' + JSON.stringify(assign.body));
  const approve = await request('POST', `/api/workflow/${estimateID}/approve-ts`, { remarks: 'TS ok' }, tokens.gm);
  assert.equal(approve.status, 200, 'approve-ts: ' + JSON.stringify(approve.body));

  await request('POST', `/api/workflow/${estimateID}/publish-tender`, {}, tokens.tender_officer);

  const agency = await request('POST', '/api/agency', {
    EstimateID: estimateID, AgencyName: 'Exec Agency', AgencyCode: 'AGY-EXEC',
    AgreementNo: 'AGT-EXEC', AgreementDate: new Date().toISOString().slice(0, 10),
    TenderValue: 1000000, CompletionPeriod: '6 months',
    SecurityDeposit: 50000, PerformanceGuarantee: 100000,
    ContractorName: 'Exec Contractor', ContactDetails: 'exec@test',
    WorkOrderNo: 'WO-EXEC-001', WorkOrderDate: new Date().toISOString().slice(0, 10),
  }, tokens.director_admin);
  assert.equal(agency.status, 201, 'createAgency: ' + JSON.stringify(agency.body));

  const select = await request('POST', `/api/workflow/${estimateID}/select-agency`, {}, tokens.director_admin);
  assert.equal(select.status, 200, 'select-agency: ' + JSON.stringify(select.body));
}

const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

before(async () => {
  await new Promise((resolve) => { server = app.listen(PORT, resolve); });
  for (const u of ['manager', 'dgm', 'gm', 'cgm', 'dop', 'ed', 'md', 'tender_officer', 'site_engineer', 'director_admin']) {
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

describe('Work execution chain: start -> progress/measurement -> complete', () => {
  it('runs the execution chain with idempotency, owner scope and completion persistence', async () => {
    const est = await createEstimate('Exec Chain ' + Date.now());
    const eid = est.EstimateID;
    const detailID = est.Items[0].DetailID;
    await driveToAgencySelected(eid);

    const seId = (await db.query('SELECT "UserID" FROM "Users" WHERE "Username" = $1', ['site_engineer'])).rows[0].UserID;
    const boId = (await db.query('SELECT "UserID" FROM "Users" WHERE "Username" = $1', ['billing_officer'])).rows[0].UserID;

    // ── startWork: date/owner persistence + agency + SLA ──────────────────────
    const start = await request('POST', `/api/workflow/${eid}/start-work`, { remarks: 'begin' }, tokens.site_engineer);
    assert.equal(start.status, 200, JSON.stringify(start.body));
    const h1 = (await db.query(
      `SELECT "Status","CurrentOwner","StartedDate","StartedBy","SlaDueAt","SlaStatus"
       FROM "EstimateHeader" WHERE "EstimateID" = $1`, [eid])).rows[0];
    assert.equal(h1.Status, 'WorkStarted');
    assert.equal(h1.CurrentOwner, seId);
    assert.ok(h1.StartedDate, 'StartDate persisted');
    assert.equal(h1.StartedBy, seId);
    assert.ok(h1.SlaDueAt, 'execution SLA clock started');
    const agency1 = (await db.query(`SELECT "StartDate","CompletionDate" FROM "Agency" WHERE "EstimateID" = $1`, [eid])).rows[0];
    assert.ok(agency1.StartDate, 'agency stamped with start date');
    assert.equal(agency1.CompletionDate, null);

    const dupStart = await request('POST', `/api/workflow/${eid}/start-work`, {}, tokens.site_engineer);
    assert.equal(dupStart.status, 400, 'repeated start must be rejected');

    // ── progress: owner-scoped, idempotent ────────────────────────────────────
    const prog = await request('POST', '/api/progress', {
      EstimateID: eid, Stage: 'Foundation', Percentage: 50, Remarks: 'first slab',
    }, tokens.site_engineer);
    assert.equal(prog.status, 201, JSON.stringify(prog.body));
    const progReplay = await request('POST', '/api/progress', {
      EstimateID: eid, Stage: 'Foundation', Percentage: 50, Remarks: 'first slab',
    }, tokens.site_engineer);
    assert.equal(progReplay.status, 200, 'identical progress resubmission returns existing row');
    assert.equal(progReplay.body.ProgressID, prog.body.ProgressID, 'no duplicate progress row');
    const progressCount = (await db.query(
      `SELECT COUNT(*)::int AS n FROM "WorkProgress" WHERE "EstimateID" = $1`, [eid])).rows[0];
    assert.equal(progressCount.n, 1, 'exactly one progress row');
    assert.ok((await db.query(
      `SELECT 1 FROM "AuditLog" WHERE "EstimateID" = $1 AND "Action" = 'ProgressRecorded'`, [eid])).rows.length, 'progress audited');

    // ── measurement: owner-scoped, idempotent ─────────────────────────────────
    const mb = await request('POST', '/api/measurement', {
      EstimateID: eid, DetailID: detailID, PreviousQty: 0, CurrentQty: 4,
      MeasuredDate: day(0), Remarks: 'measured',
    }, tokens.site_engineer);
    assert.equal(mb.status, 201, JSON.stringify(mb.body));
    const mbReplay = await request('POST', '/api/measurement', {
      EstimateID: eid, DetailID: detailID, PreviousQty: 0, CurrentQty: 4,
      MeasuredDate: day(0), Remarks: 'measured',
    }, tokens.site_engineer);
    assert.equal(mbReplay.status, 200, 'identical measurement resubmission returns existing row');
    assert.equal(mbReplay.body.MeasurementID, mb.body.MeasurementID, 'no duplicate measurement row');
    const mbCount = (await db.query(
      `SELECT COUNT(*)::int AS n FROM "MeasurementBook" WHERE "EstimateID" = $1`, [eid])).rows[0];
    assert.equal(mbCount.n, 1, 'exactly one measurement row');

    // ── completeWork: persistence, agency stamp, SLA resolve, no replay ───────
    const complete = await request('POST', `/api/workflow/${eid}/complete-work`, { remarks: 'done' }, tokens.site_engineer);
    assert.equal(complete.status, 200, JSON.stringify(complete.body));
    const h2 = (await db.query(
      `SELECT "Status","CurrentOwner","CompletedDate","CompletedBy"
       FROM "EstimateHeader" WHERE "EstimateID" = $1`, [eid])).rows[0];
    assert.equal(h2.Status, 'WorkCompleted');
    assert.equal(h2.CurrentOwner, boId, 'work forwarded to Billing Officer');
    assert.ok(h2.CompletedDate, 'completion date persisted');
    assert.equal(h2.CompletedBy, seId, 'completion author persisted');
    const agency2 = (await db.query(`SELECT "CompletionDate" FROM "Agency" WHERE "EstimateID" = $1`, [eid])).rows[0];
    assert.ok(agency2.CompletionDate, 'agency stamped with completion date');
    const sla2 = (await db.query(`SELECT "SlaStatus" FROM "EstimateHeader" WHERE "EstimateID" = $1`, [eid])).rows[0];
    assert.equal(sla2.SlaStatus, 'Resolved', 'execution SLA resolved by completion');
    const wfRows = (await db.query(
      `SELECT "Action" FROM "Workflow" WHERE "EstimateID" = $1 AND "Action" = 'CompleteWork'`, [eid])).rows;
    const auditComplete = (await db.query(
      `SELECT "Action" FROM "AuditLog" WHERE "EstimateID" = $1 AND "Action" = 'CompleteWork'`, [eid])).rows;
    assert.equal(wfRows.length, 1, 'exactly one CompleteWork workflow row');
    assert.equal(auditComplete.length, 1, 'exactly one CompleteWork audit row');

    const dupComplete = await request('POST', `/api/workflow/${eid}/complete-work`, {}, tokens.site_engineer);
    assert.ok(dupComplete.status >= 400, 'repeated completion must be rejected');

    // ── owner scope: after handoff the SiteEngineer loses record rights ───────
    const progAfter = await request('POST', '/api/progress', {
      EstimateID: eid, Stage: 'Handover', Percentage: 100,
    }, tokens.site_engineer);
    assert.equal(progAfter.status, 403, 'progress after completion requires the new owner');
    const mbAfter = await request('POST', '/api/measurement', {
      EstimateID: eid, DetailID: detailID, CurrentQty: 1,
    }, tokens.site_engineer);
    assert.equal(mbAfter.status, 403, 'measurement after completion requires the new owner');
  });
});