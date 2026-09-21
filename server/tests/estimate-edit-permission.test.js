// Permission-driven Estimate Edit rule:
//   PERMISSION CHECK → SCOPE CHECK → STATE CHECK → ALLOW API
// DGM now holds `estimate.edit` (migration 047 — it is an authoring role and
// must correct its own Draft). It may edit an in-scope, still-editable estimate
// (its own or a Manager's in the same division) and is rejected with 403 for an
// out-of-scope estimate or once the workflow state forbids editing. The same
// canPerform rule drives the frontend Edit button visibility (client util) and
// this API authorization — it is never a role-name-only check.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const db = require('../config/db');
const { resolveLocation } = require('./helpers');
const { cleanupTrackedData, trackEstimate } = require('./cleanup');

const PORT = 5255;
let server;
let items;
let managerToken, dgmToken, outScopeManagerToken;
let dgmDivisionId, dgmUserId;
let inScopeLoc, outScopeLoc;

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

async function createEstimate(token, name, loc) {
  const item = nItem();
  assert.ok(item, 'an N-formula item must be seeded');
  const res = await request('POST', '/api/estimates', {
    NameOfWork: name || `EditPerm ${Date.now()}`,
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
  assert.equal(res.status, 201, JSON.stringify(res.body));
  trackEstimate(res.body.EstimateID);
  return res.body;
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(PORT, resolve); });

  managerToken = (await login('manager')).token;
  dgmToken = (await login('dgm')).token;

  const itemsRes = await request('GET', '/api/items?limit=1000', null, managerToken);
  assert.equal(itemsRes.status, 200);
  items = itemsRes.body;
  inScopeLoc = await resolveLocation(request, managerToken);

  const dgmRow = (await db.query('SELECT "UserID", "DivisionID" FROM "Users" WHERE "Username" = \'dgm\'')).rows[0];
  dgmUserId = dgmRow.UserID;
  dgmDivisionId = dgmRow.DivisionID;
  assert.ok(dgmDivisionId, 'demo dgm must have an assigned DivisionID');

  // An estimate in another division, created by that division's mapped Manager.
  const outQ = await db.query(
    `SELECT w."WardID", w."CircleID", c."DivisionID", z."RegionID", u."Username"
     FROM "Wards" w
     JOIN "Circles" c ON c."CircleID" = w."CircleID"
     JOIN "Divisions" d ON d."DivisionID" = c."DivisionID"
     JOIN "Zones" z ON z."ZoneID" = d."ZoneID"
     JOIN "ManagerCircleAssignment" a ON a."CircleID" = c."CircleID" AND a."IsActive" = TRUE
     JOIN "Users" u ON u."UserID" = a."UserID" AND u."IsActive" IS NOT FALSE
     WHERE c."DivisionID" <> $1
     ORDER BY w."WardID" LIMIT 1`,
    [dgmDivisionId]
  );
  assert.ok(outQ.rows[0], 'a mapped Manager must exist in another division');
  const out = outQ.rows[0];
  outScopeLoc = { RegionID: out.RegionID, WardID: out.WardID };
  outScopeManagerToken = (await login(out.Username)).token;
  assert.notEqual(outScopeLoc.WardID, inScopeLoc.WardID, 'out-of-scope ward must differ from in-scope ward');
});

after(async () => {
  await cleanupTrackedData();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

describe('DGM Estimate Edit via estimate.edit permission', () => {
  it('login payload carries estimate.edit (drives Edit button visibility)', async () => {
    const { user } = await login('dgm');
    assert.ok(user.Permissions.includes('estimate.edit'), 'DGM permissions must include estimate.edit');
  });

  it('DGM can edit its OWN created draft (the task focus)', async () => {
    const est = await createEstimate(dgmToken, 'DgmOwn Draft', inScopeLoc);
    assert.equal(Number(est.DivisionID), dgmDivisionId, 'estimate must share the dgm division');
    assert.equal(est.CurrentOwner, dgmUserId, 'DGM must own its own Draft');

    const res = await request('PUT', `/api/estimates/${est.EstimateID}`, { NameOfWork: 'DgmOwn Draft v2' }, dgmToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.NameOfWork, 'DgmOwn Draft v2');
  });

  it('DGM can edit an in-scope, Manager-created draft estimate (200 + version snapshot)', async () => {
    const est = await createEstimate(managerToken, 'EditPerm InScope', inScopeLoc);
    assert.equal(Number(est.DivisionID), dgmDivisionId, 'estimate must share the dgm division');

    const before = await request('GET', `/api/estimates/${est.EstimateID}`, null, dgmToken);
    assert.equal(before.status, 200, JSON.stringify(before.body));

    const res = await request('PUT', `/api/estimates/${est.EstimateID}`,
      { NameOfWork: 'EditPerm InScope v2' }, dgmToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.NameOfWork, 'EditPerm InScope v2');

    const after = await request('GET', `/api/estimates/${est.EstimateID}`, null, dgmToken);
    assert.equal(Number(after.body.Version), Number(before.body.Version) + 1, 'edit must bump the version');

    const versions = (await request('GET', `/api/estimates/${est.EstimateID}/versions`, null, dgmToken)).body;
    const versionRow = versions.find((v) => Number(v.VersionNumber) === Number(after.body.Version));
    assert.ok(versionRow, 'a Versions snapshot must record the edited version');
    assert.equal(Number(versionRow.CreatedBy), dgmUserId, 'version must be attributed to the editing DGM');
  });

  it('DGM cannot edit an out-of-scope estimate (API rejects with 403)', async () => {
    const est = await createEstimate(outScopeManagerToken, 'EditPerm OutScope', outScopeLoc);
    assert.notEqual(Number(est.DivisionID), dgmDivisionId, 'estimate must be outside the dgm division');

    const get = await request('GET', `/api/estimates/${est.EstimateID}`, null, dgmToken);
    assert.equal(get.status, 403, 'out-of-scope estimate must not even be viewable');

    const res = await request('PUT', `/api/estimates/${est.EstimateID}`, { NameOfWork: 'nope' }, dgmToken);
    assert.equal(res.status, 403, JSON.stringify(res.body));

    const ownerView = await request('GET', `/api/estimates/${est.EstimateID}`, null, outScopeManagerToken);
    assert.equal(ownerView.body.NameOfWork, 'EditPerm OutScope', 'estimate must be unchanged');
  });

  it('DGM cannot edit an in-scope estimate once the workflow state forbids it (403)', async () => {
    const est = await createEstimate(managerToken, 'EditPerm Submitted', inScopeLoc);

    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, managerToken));
    const m = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'submit OTP should be captured from the dev log');
    const sub = await request('POST', `/api/workflow/${est.EstimateID}/submit`, { otpCode: m[1] }, managerToken);
    assert.equal(sub.status, 200, `submit: ${JSON.stringify(sub.body)}`);

    const res = await request('PUT', `/api/estimates/${est.EstimateID}`, { NameOfWork: 'blocked' }, dgmToken);
    assert.equal(res.status, 403, JSON.stringify(res.body));

    const view = await request('GET', `/api/estimates/${est.EstimateID}`, null, managerToken);
    assert.equal(view.body.Status, 'Submitted', 'estimate must remain in Submitted state');
  });
});