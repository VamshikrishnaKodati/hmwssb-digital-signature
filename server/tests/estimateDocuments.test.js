const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const { trackEstimate, cleanupTrackedData } = require('./cleanup');
const { resolveLocation } = require('./helpers');

let server;
let managerToken, agencyToken;
let location, itemId, estimateId;
let pendingKey;

const SERVER_PORT = 5437;
const PDF_BYTES = Buffer.from('PDF test content');

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
        const parsed = JSON.parse(data);
        if (parsed.success === true) return resolve({ status: res.statusCode, headers: res.headers, body: parsed.data });
        return resolve({
          status: res.statusCode,
          headers: res.headers,
          body: (parsed.error && parsed.success === false && typeof parsed.error === 'object')
            ? parsed.error.message
            : parsed.error || parsed,
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Raw (non-JSON) response for the file endpoint.
function rawRequest(path, authToken) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1', port: SERVER_PORT, path, method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    };
    if (authToken) opts.headers['Authorization'] = 'Bearer ' + authToken;
    const req = http.request(opts, (res) => {
      res.setEncoding('utf8');
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(SERVER_PORT, resolve); });
  const login = async (u) => (await request('POST', '/api/auth/login', { username: u, password: 'password123' })).body.token;
  managerToken = await login('manager');
  agencyToken = await login('site_engineer');
  location = await resolveLocation(request, managerToken);
  const itemsRes = await request('GET', '/api/items?limit=1000', null, managerToken);
  itemId = itemsRes.body.find((i) => i.FormulaType === 'N').ItemID;
});

after(async () => {
  await cleanupTrackedData();
  await new Promise((resolve) => server.close(resolve));
});

describe('estimate documents', () => {
  it('manager uploads a pending document for an unsaved estimate', async () => {
    pendingKey = `pk-${Date.now()}`;
    const res = await request('POST', '/api/estimate-documents/upload', {
      pendingKey,
      fileName: 'drawing.png',
      mimeType: 'image/png',
      data: PDF_BYTES.toString('base64'),
    }, managerToken);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.OriginalName, 'drawing.png');
    assert.equal(res.body.EstimateID, null);
  });

  it('rejects unsupported file types', async () => {
    const res = await request('POST', '/api/estimate-documents/upload', {
      pendingKey: `pk-${Date.now()}`,
      fileName: 'notes.exe',
      mimeType: 'application/octet-stream',
      data: Buffer.from('nope').toString('base64'),
    }, managerToken);
    assert.equal(res.status, 400);
  });

  it('rejects upload from a non-manager role', async () => {
    const res = await request('POST', '/api/estimate-documents/upload', {
      pendingKey: `pk-${Date.now()}`,
      fileName: 'x.pdf',
      mimeType: 'application/pdf',
      data: PDF_BYTES.toString('base64'),
    }, agencyToken);
    assert.equal(res.status, 403);
  });

  it('assigns the pending document to a newly created estimate', async () => {
    const e = await request('POST', '/api/estimates', {
      NameOfWork: `Docs ${Date.now()}`,
      WorkCategory: 'Water Supply',
      RegionID: location.RegionID,
      WardID: location.WardID,
      GSTPercent: 18,
      LSProvision: 0,
      AdditionalItems: [],
      Items: [{ ItemID: itemId, Category: 'Civil', FormulaType: 'N', Unit: 'each', Rate: 10, N: 1, L: null, B: null, D: null }],
    }, managerToken);
    assert.equal(e.status, 201, JSON.stringify(e.body));
    estimateId = e.body.EstimateID;
    trackEstimate(estimateId);

    const assign = await request('POST', '/api/estimate-documents/assign', { pendingKey, estimateId }, managerToken);
    assert.equal(assign.status, 200, JSON.stringify(assign.body));
    assert.equal(assign.body.attached, 1);
  });

  it('lists documents and serves the file bytes', async () => {
    const list = await request('GET', `/api/estimate-documents/?estimateId=${estimateId}`, null, managerToken);
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].OriginalName, 'drawing.png');

    const file = await rawRequest(`/api/estimate-documents/${list.body[0].DocumentID}/file`, managerToken);
    assert.equal(file.status, 200);
    assert.match(file.headers['content-type'], /image\/png/);
    assert.equal(file.body, PDF_BYTES.toString('utf8'));
  });

  it('blocks listing without a valid token', async () => {
    const res = await request('GET', `/api/estimate-documents/?estimateId=${estimateId}`, null, null);
    assert.equal(res.status, 401);
  });

  it('uploads a second document directly to the estimate and deletes it', async () => {
    const up = await request('POST', '/api/estimate-documents/upload', {
      estimateId,
      fileName: 'plan.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('plan v2').toString('base64'),
    }, managerToken);
    assert.equal(up.status, 201, JSON.stringify(up.body));

    let list = await request('GET', `/api/estimate-documents/?estimateId=${estimateId}`, null, managerToken);
    assert.equal(list.body.length, 2);

    const del = await request('DELETE', `/api/estimate-documents/${up.body.DocumentID}`, null, managerToken);
    assert.equal(del.status, 200);

    list = await request('GET', `/api/estimate-documents/?estimateId=${estimateId}`, null, managerToken);
    assert.equal(list.body.length, 1);
  });

  it('rejects delete from a non-manager role', async () => {
    const list = await request('GET', `/api/estimate-documents/?estimateId=${estimateId}`, null, managerToken);
    const id = list.body[0].DocumentID;
    const del = await request('DELETE', `/api/estimate-documents/${id}`, null, agencyToken);
    assert.equal(del.status, 403);
  });
});