// Location-scope enforcement: assignment, visibility, routing, and conflict
// rules for the 60 Manager (circle) and 24 DGM (division) mapping. Seeded
// demo users co-host nodes 1 so the golden flows stay green.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const db = require('../config/db');
const { resolveLocation } = require('./helpers');
const { trackEstimate, cleanupTrackedData } = require('./cleanup');

const SERVER_PORT = 5100;
let server;
let tokens = {};
let items;
let location;
let estimateID;
let demoDgmId;
let mgr039Id;

function request(method, path, body, authToken) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: SERVER_PORT,
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

before(async () => {
  await new Promise((resolve) => { server = app.listen(SERVER_PORT, resolve); });
  const login = async (u) => {
    const r = await request('POST', '/api/auth/login', { username: u, password: 'password123' });
    assert.equal(r.status, 200, `login ${u}: ${JSON.stringify(r.body)}`);
    return r.body.user;
  };
  const mgr = await login('manager');
  tokens.manager = (await request('POST', '/api/auth/login', { username: 'manager', password: 'password123' })).body.token;
  tokens.mgr001 = (await request('POST', '/api/auth/login', { username: 'mgr-001', password: 'password123' })).body.token;
  tokens.mgr039 = (await request('POST', '/api/auth/login', { username: 'mgr-039', password: 'password123' })).body.token;
  tokens.dgm016 = (await request('POST', '/api/auth/login', { username: 'dgm-016', password: 'password123' })).body.token;
  tokens.admin = (await request('POST', '/api/auth/login', { username: 'admin_officer', password: 'password123' })).body.token;

  items = (await request('GET', '/api/items?limit=1000', null, tokens.manager)).body;
  location = await resolveLocation(request, tokens.manager);
  const item = items[0];
  const payload = {
    NameOfWork: 'Scope Test Estimate',
    WorkCategory: 'Water Supply',
    RegionID: location.RegionID,
    WardID: location.WardID,
    GSTPercent: 18,
    LSProvision: 0,
    AdditionalItems: [],
    Items: [{ ItemID: item.ItemID, Category: item.Category, FormulaType: item.FormulaType, Unit: item.Unit, Rate: item.Rate, N: 1, L: null, B: null, D: null }],
  };
  const create = await request('POST', '/api/estimates', payload, tokens.manager);
  assert.equal(create.status, 201, JSON.stringify(create.body));
  estimateID = create.body.EstimateID;
  trackEstimate(estimateID);
  demoDgmId = (await login('dgm')).UserID;
  mgr039Id = (await login('mgr-039')).UserID;
});

after(async () => {
  await cleanupTrackedData();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

describe('Location scope', () => {
  it('A: mgr-001 sees 1 – Keesara as assigned circle', async () => {
    const scope = (await request('GET', '/api/users/me/scope', null, tokens.mgr001)).body;
    assert.equal(scope.role, 'Manager');
    assert.equal(scope.scopeType, 'Circle');
    assert.ok(scope.nodes.length >= 1, 'mgr-001 must have an assigned circle');
    assert.match(scope.nodes[0].nodeName, /^1\s*–\s*Keesara/);
  });

  it('B: dgm-016 sees Division 16 in scope', async () => {
    const scope = (await request('GET', '/api/users/me/scope', null, tokens.dgm016)).body;
    assert.equal(scope.role, 'DGM');
    assert.ok(scope.nodes.length >= 1, 'dgm-016 must have an assigned division');
    assert.match(scope.nodes[0].nodeName, /16/);
  });

  it('C: direct URL to an out-of-scope estimate is denied (403)', async () => {
    const res = await request('GET', `/api/estimates/${estimateID}`, null, tokens.mgr039);
    assert.equal(res.status, 403, JSON.stringify(res.body));
  });

  it('D: cannot create estimates outside assigned circle (403)', async () => {
    const item = items[0];
    const res = await request('POST', '/api/estimates', {
      NameOfWork: 'Out of scope create',
      WorkCategory: 'Water Supply',
      RegionID: location.RegionID,
      WardID: location.WardID,
      GSTPercent: 18,
      Items: [{ ItemID: item.ItemID, Category: item.Category, FormulaType: item.FormulaType, Unit: item.Unit, Rate: item.Rate, N: 1, L: null, B: null, D: null }],
    }, tokens.mgr039);
    assert.equal(res.status, 403, JSON.stringify(res.body));
  });

  it('E: assigning an already-held circle to another user is rejected (409)', async () => {
    const assignments = (await request('GET', '/api/users/admin/assignments', null, tokens.admin)).body;
    const circle = assignments.find(a => a.Role === 'Manager' && a.NodeType === 'Circle' && a.IsActive);
    assert.ok(circle, 'an active circle assignment must exist');
    const res = await request('PUT', `/api/users/${mgr039Id}/scope`,
      { AssignedRole: 'Manager', AssignedNodeId: circle.NodeID }, tokens.admin);
    assert.equal(res.status, 409, JSON.stringify(res.body));
  });

  it('F: list scoping — mgr-039 cannot see circle-1 estimates', async () => {
    const asMgr039 = (await request('GET', '/api/estimates', null, tokens.mgr039)).body;
    assert.ok(Array.isArray(asMgr039), 'mgr-039 list must be an array');
    assert.ok(!asMgr039.some(r => r.EstimateID === estimateID), 'out-of-scope estimate must be hidden');
    const asManager = (await request('GET', '/api/estimates', null, tokens.manager)).body;
    assert.ok(asManager.some(r => r.EstimateID === estimateID), 'in-scope creator sees own estimate');
  });

  it('G: submit routes to the DGM of the estimate division (demo dgm)', async () => {
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${estimateID}/submit/request-otp`, {}, tokens.manager));
    const m = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'submit OTP should be captured');
    const sub = await request('POST', `/api/workflow/${estimateID}/submit`, { otpCode: m[1] }, tokens.manager);
    assert.equal(sub.status, 200, JSON.stringify(sub.body));
    const row = (await db.query(`SELECT "CurrentOwner","Status" FROM "EstimateHeader" WHERE "EstimateID" = $1`, [estimateID])).rows[0];
    assert.equal(row.Status, 'Submitted');
    assert.equal(row.CurrentOwner, demoDgmId, 'division-1 DGM (demo dgm) must own the review');
  });

  it('H: board-wide roles report All scope', async () => {
    const scope = (await request('GET', '/api/users/me/scope', null, tokens.admin)).body;
    assert.equal(scope.role, 'Administrator');
    assert.equal(scope.scopeType, 'All');
  });
});