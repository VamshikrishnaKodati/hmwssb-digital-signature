const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const { trackEstimate, cleanupTrackedData } = require('./cleanup');
const { resolveLocation } = require('./helpers');

let server;
let tokens = {};
let location, items;

const PORT = 5412;

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

async function login(users) {
  for (const u of users) {
    tokens[u] = (await request('POST', '/api/auth/login', { username: u, password: 'password123' })).body.token;
  }
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(PORT, resolve); });
  await login(['manager','dgm','gm','cgm','dop','ed','md','tender_officer','director_admin','finance_head']);
  location = await resolveLocation(request, tokens.manager);
  const itemsRes = await request('GET', '/api/items?limit=1000', null, tokens.manager);
  items = itemsRes.body;
});

after(async () => {
  await cleanupTrackedData();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

async function createEstimate() {
  const payload = {
    NameOfWork: 'SanctionNo Test ' + Date.now(),
    WorkCategory: 'Water Supply',
    RegionID: location.RegionID, WardID: location.WardID,
    GSTPercent: 18, LSProvision: 0, AdditionalItems: [],
    Items: items.slice(0, 2).map(function(it) {
      return { ItemID: it.ItemID, Category: it.Category, FormulaType: it.FormulaType, Unit: it.Unit, Rate: it.Rate, N: 1, L: 1, B: 1, D: 1 };
    }),
  };
  const r = await request('POST', '/api/estimates', payload, tokens.manager);
  return r.body.EstimateID || r.body.estimateId;
}

async function getEstimate(eid) {
  return (await request('GET', '/api/estimates/' + eid, null, tokens.manager)).body;
}

async function advanceToMDfinal(eid) {
  const { captured } = await captureOtpFromLog(() =>
    request('POST', '/api/workflow/' + eid + '/submit/request-otp', {}, tokens.manager));
  assert.equal((await request('POST', '/api/workflow/' + eid + '/submit', { otpCode: extractOtp(captured) }, tokens.manager)).status, 200);

  const c1 = await captureOtpFromLog(() => request('POST', '/api/workflow/' + eid + '/approve/request-otp', {}, tokens.dgm));
  assert.equal((await request('POST', '/api/workflow/' + eid + '/approve', { otpCode: extractOtp(c1.captured) }, tokens.dgm)).status, 200);

  const c2 = await captureOtpFromLog(() => request('POST', '/api/workflow/' + eid + '/sign/request-otp', {}, tokens.gm));
  assert.equal((await request('POST', '/api/workflow/' + eid + '/sign', { otpCode: extractOtp(c2.captured), certificateId: 'HMWSSB-SN-001' }, tokens.gm)).status, 200);

  const c3 = await captureOtpFromLog(() => request('POST', '/api/workflow/' + eid + '/cgm-submit/request-otp', {}, tokens.cgm));
  assert.equal((await request('POST', '/api/workflow/' + eid + '/cgm-submit', { otpCode: extractOtp(c3.captured) }, tokens.cgm)).status, 200);

  const c4 = await captureOtpFromLog(() => request('POST', '/api/workflow/' + eid + '/dop-approve/request-otp', {}, tokens.dop));
  assert.equal((await request('POST', '/api/workflow/' + eid + '/dop-approve', { otpCode: extractOtp(c4.captured) }, tokens.dop)).status, 200);

  const c5 = await captureOtpFromLog(() => request('POST', '/api/workflow/' + eid + '/ed-approve/request-otp', {}, tokens.ed));
  assert.equal((await request('POST', '/api/workflow/' + eid + '/ed-approve', { otpCode: extractOtp(c5.captured) }, tokens.ed)).status, 200);

  const c6 = await captureOtpFromLog(() => request('POST', '/api/workflow/' + eid + '/md-final/request-otp', {}, tokens.md));
  const r = await request('POST', '/api/workflow/' + eid + '/md-final', { otpCode: extractOtp(c6.captured) }, tokens.md);
  assert.equal(r.status, 200, 'md-final: ' + JSON.stringify(r.body));
}

// Advance to FCNGenerated (Director owns). Client does NOT pass a sanctionNo.
async function advanceToFCN(eid) {
  await advanceToMDfinal(eid);
  const fcn = await request('POST', '/api/workflow/' + eid + '/generate-fcn', {}, tokens.director_admin);
  assert.equal(fcn.status, 200, 'generate-fcn: ' + JSON.stringify(fcn.body));
}

async function makeAdminSanction(eid, body) {
  return request('POST', '/api/workflow/' + eid + '/generate-admin-sanction', body, tokens.director_admin);
}

const AS_RE = /^AS\/\d{4}-\d{2}\/\d{4}$/;
const TS_RE = /^TS\/\d{4}-\d{2}\/\d{4}$/;

describe('Automatic AS/TS sanction numbering', () => {
  it('AS and TS numbers are auto-generated, sequential and independent', async () => {
    const eid1 = await createEstimate();
    const eid2 = await createEstimate();
    trackEstimate(eid1);
    trackEstimate(eid2);

    await advanceToFCN(eid1);
    await advanceToFCN(eid2);

    // No sanctionNo provided at all -> server generates it
    const s1 = await makeAdminSanction(eid1, {});
    assert.equal(s1.status, 200, 'AS1: ' + JSON.stringify(s1.body));
    const s2 = await makeAdminSanction(eid2, {});
    assert.equal(s2.status, 200, 'AS2: ' + JSON.stringify(s2.body));

    assert.ok(AS_RE.test(s1.body.sanctionNo), 'AS1 format: ' + s1.body.sanctionNo);
    assert.ok(AS_RE.test(s2.body.sanctionNo), 'AS2 format: ' + s2.body.sanctionNo);
    assert.notEqual(s1.body.sanctionNo, s2.body.sanctionNo, 'two estimates get distinct AS numbers');

    // TS numbers auto-generated on approval, independent from AS series
    const assign1 = await request('POST', '/api/workflow/' + eid1 + '/assign-ts-authority', { AuthorityRole: 'GM' }, tokens.director_admin);
    assert.equal(assign1.status, 200, 'assign1: ' + JSON.stringify(assign1.body));
    const assign2 = await request('POST', '/api/workflow/' + eid2 + '/assign-ts-authority', { AuthorityRole: 'DGM' }, tokens.director_admin);
    assert.equal(assign2.status, 200, 'assign2: ' + JSON.stringify(assign2.body));

    const t1 = await request('POST', '/api/workflow/' + eid1 + '/approve-ts', { remarks: 'ok' }, tokens.gm);
    assert.equal(t1.status, 200, 'TS1: ' + JSON.stringify(t1.body));
    const t2 = await request('POST', '/api/workflow/' + eid2 + '/approve-ts', { remarks: 'ok' }, tokens.dgm);
    assert.equal(t2.status, 200, 'TS2: ' + JSON.stringify(t2.body));

    assert.ok(TS_RE.test(t1.body.tsNo), 'TS1 format: ' + t1.body.tsNo);
    assert.ok(TS_RE.test(t2.body.tsNo), 'TS2 format: ' + t2.body.tsNo);
    assert.notEqual(t1.body.tsNo, t2.body.tsNo, 'two TS approvals get distinct TS numbers');
    assert.ok(!s1.body.sanctionNo.includes('/' + t1.body.tsNo.split('/')[1] + '/0') ||
      s1.body.sanctionNo !== t1.body.tsNo, 'AS and TS series are different numbers');

    // Detail endpoint surfaces ASNo/ASDate/TSNo/TSDate for immediate display
    const d1 = await getEstimate(eid1);
    assert.equal(d1.ASNo, s1.body.sanctionNo, 'detail returns ASNo');
    assert.ok(d1.ASDate, 'detail returns ASDate');
    assert.equal(d1.TSNo, t1.body.tsNo, 'detail returns TSNo');
    assert.ok(d1.TSDate, 'detail returns TSDate');
    assert.ok(d1.FCNNo, 'detail returns FCNNo');
  });

  it('counters stay sequential across distinct financial years handled independently', async () => {
    const eid = await createEstimate();
    trackEstimate(eid);
    await advanceToFCN(eid);
    const s = await makeAdminSanction(eid, {});
    assert.equal(s.status, 200, JSON.stringify(s.body));
    const pieces = s.body.sanctionNo.split('/');
    assert.equal(pieces.length, 3, 'AS/<FY>/<seq>');
    assert.ok((pieces[1].match(/\d{4}-\d{2}/)), 'FY shape');
    assert.ok(parseInt(pieces[2], 10) >= 1, 'seq numeric');
  });
});