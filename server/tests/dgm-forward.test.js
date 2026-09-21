// Workflow forward-target resolution: the next authority for an estimate owned
// at the front of the approval pipeline comes from the CURRENT OWNER's position,
// not from the creator's role. A DGM-created Draft forwards to the GM
// (Status DGM_Approved / GM Recommendation), a GM-created one to the CGM, and a
// Manager-created one still goes to the DGM. OTP, audit, notification and SLA
// are all tied to the resolved transition. Mirrors the client-side
// resolveWorkflowPosition (workflowMapping.js) used for the "Forward to GM" button.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const db = require('../config/db');
const { resolveLocation } = require('./helpers');
const { cleanupTrackedData, trackEstimate } = require('./cleanup');

const PORT = 5256;
let server;
let items;
let managerToken, dgmToken, loc;

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
  return r.body;
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
    NameOfWork: name,
    WorkCategory: 'Water Supply',
    RegionID: loc.RegionID,
    WardID: loc.WardID,
    GSTPercent: 18,
    LSProvision: 0,
    AdditionalItems: [],
    Items: [{
      ItemID: item.ItemID, Category: item.Category, FormulaType: 'N', Unit: item.Unit,
      Rate: item.Rate, N: 2, L: null, B: null, D: null,
    }],
  }, token);
  assert.equal(res.status, 201, `create as ${name.split(' ')[0]}: ${JSON.stringify(res.body)}`);
  trackEstimate(res.body.EstimateID);
  return res.body;
}

async function submitAs(token, estimateId) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', `/api/workflow/${estimateId}/submit/request-otp`, {}, token));
  const m = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
  assert.ok(m, 'submit OTP should be captured from the dev log');
  return request('POST', `/api/workflow/${estimateId}/submit`, { otpCode: m[1] }, token);
}

async function currentOwnerDesignation(estimateId) {
  const { rows } = await db.query(
    `SELECT u."Designation" FROM "EstimateHeader" e
     JOIN "Users" u ON u."UserID" = e."CurrentOwner"
     WHERE e."EstimateID" = $1`,
    [estimateId]);
  return rows[0] ? rows[0].Designation : null;
}

async function submitNotifiedUser(estimateId) {
  const { rows } = await db.query(
    `SELECT u."Designation" AS "Designation"
     FROM "Notification" n JOIN "Users" u ON u."UserID" = n."ToUserID"
     WHERE n."EstimateID" = $1 AND n."Type" = 'Submit'
     ORDER BY n."NotificationID" DESC LIMIT 1`,
    [estimateId]);
  return rows[0] ? rows[0].Designation : null;
}

async function submitWorkflowRow(estimateId) {
  const { rows } = await db.query(
    `SELECT w."Action", w."Remarks", u."Designation" AS "ToDesignation"
     FROM "Workflow" w JOIN "Users" u ON u."UserID" = w."ToUserID"
     WHERE w."EstimateID" = $1 AND w."Action" = 'Submit'
     ORDER BY w."WorkflowID" DESC LIMIT 1`,
    [estimateId]);
  return rows[0] || null;
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(PORT, resolve); });
  managerToken = (await login('manager')).token;
  dgmToken = (await login('dgm')).token;
  const itemsRes = await request('GET', '/api/items?limit=1000', null, managerToken);
  assert.equal(itemsRes.status, 200);
  items = itemsRes.body;
  loc = await resolveLocation(request, managerToken);
});

after(async () => {
  await cleanupTrackedData();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

describe('Forward target resolved from the current owner', () => {
  it('DGM role holds the forward (estimate.submit) permission that drives button visibility', async () => {
    const { user } = await login('dgm');
    assert.ok(user.Permissions.includes('estimate.submit'),
      'DGM permissions must include estimate.submit for the Forward action to appear');
  });

  it('DGM-created estimate forwards to the GM (Status DGM_Approved, owner GM)', async () => {
    const est = await createEstimate(dgmToken, 'ForwardDGM');
    assert.equal(est.Status, 'Draft');
    assert.equal(est.CurrentOwner, est.CreatedBy, 'DGM owns its own Draft');

    const res = await submitAs(dgmToken, est.EstimateID);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.match(res.body.message, /GM/, 'response must name the resolved next authority');

    const row = (await db.query(
      `SELECT "Status", "CurrentOwner" FROM "EstimateHeader" WHERE "EstimateID" = $1`,
      [est.EstimateID])).rows[0];
    assert.equal(row.Status, 'DGM_Approved', 'stage must be GM Recommendation after the DGM forwards');
    assert.equal(await currentOwnerDesignation(est.EstimateID), 'GM');

    const wf = await submitWorkflowRow(est.EstimateID);
    assert.ok(wf, 'a Submit workflow row must exist');
    assert.equal(wf.ToDesignation, 'GM');
    assert.match(wf.Remarks, /GM/, 'workflow remarks must reference the resolved transition');

    const audit = (await db.query(
      `SELECT "Remarks" FROM "AuditLog" WHERE "EstimateID" = $1 AND "Action" = 'Submit'
       ORDER BY "AuditID" DESC LIMIT 1`,
      [est.EstimateID])).rows[0];
    assert.ok(audit && /forwarded to GM/i.test(audit.Remarks), 'audit must reference the resolved transition');

    const notif = await submitNotifiedUser(est.EstimateID);
    assert.equal(notif, 'GM', 'Submit notification must go to the resolved GM');
  });

  it('Manager-created estimate still submits to the DGM (Status Submitted, owner DGM)', async () => {
    const est = await createEstimate(managerToken, 'ForwardMgr');

    const res = await submitAs(managerToken, est.EstimateID);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.match(res.body.message, /DGM/, 'manager submit must still target the DGM');

    const row = (await db.query(
      `SELECT "Status" FROM "EstimateHeader" WHERE "EstimateID" = $1`,
      [est.EstimateID])).rows[0];
    assert.equal(row.Status, 'Submitted');
    assert.equal(await currentOwnerDesignation(est.EstimateID), 'DGM');
  });

  it('a non-owner cannot forward (ownership is persisted CurrentOwner)', async () => {
    const est = await createEstimate(managerToken, 'ForwardNoOwner');
    const res = await request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, dgmToken);
    assert.equal(res.status, 403, 'a DGM who does not own the Draft must be rejected');
  });
});