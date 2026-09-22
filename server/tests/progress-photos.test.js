const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const { trackEstimate, cleanupTrackedData } = require('./cleanup');
const { resolveLocation } = require('./helpers');

let server;
let tokens = {};
let location, items;

const PORT = 5414;

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

async function login(users) {
  for (const u of users) {
    tokens[u] = (await request('POST', '/api/auth/login', { username: u, password: 'password123' })).body.token;
  }
}

function pngImage() {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('test-work-progress-photo'),
  ]).toString('base64');
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(PORT, resolve); });
  await login(['manager']);
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
    NameOfWork: 'Work Progress Photos Test ' + Date.now(),
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

describe('Work progress photos', () => {
  it('requires authentication', async () => {
    const r = await request('GET', '/api/progress-photos?estimateId=1');
    assert.equal(r.status, 401);
  });

  it('uploads, lists, serves and deletes a photo for a work', async () => {
    const eid = await createEstimate();
    trackEstimate(eid);

    const empty = await request('GET', '/api/progress-photos?estimateId=' + eid, null, tokens.manager);
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body, []);

    // Valid PNG upload
    const up = await request('POST', '/api/progress-photos/upload', {
      estimateId: eid, fileName: 'site-photo.png', mimeType: 'image/png', data: pngImage(),
    }, tokens.manager);
    assert.equal(up.status, 201, JSON.stringify(up.body));
    assert.ok(up.body.PhotoID);
    assert.equal(up.body.OriginalName, 'site-photo.png');
    assert.equal(up.body.MimeType, 'image/png');
    assert.ok(up.body.WorkID, 'WorkID is copied from the estimate header');
    assert.ok(up.body.UploadedAt);
    assert.equal(up.body.SizeBytes, 32);

    // List shows it, newest first
    const list = await request('GET', '/api/progress-photos?estimateId=' + eid, null, tokens.manager);
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].PhotoID, up.body.PhotoID);
    assert.ok(list.body[0].UploadedByName, 'uploader name is surfaced');

    // Serve the stored image bytes
    const file = await request('GET', '/api/progress-photos/' + up.body.PhotoID + '/file', null, tokens.manager);
    assert.equal(file.status, 200);

    // A second upload appends, it does not replace
    const up2 = await request('POST', '/api/progress-photos/upload', {
      estimateId: eid, fileName: 'second.png', mimeType: 'image/png', data: pngImage(),
    }, tokens.manager);
    assert.equal(up2.status, 201);
    const list2 = await request('GET', '/api/progress-photos?estimateId=' + eid, null, tokens.manager);
    assert.equal(list2.body.length, 2);
    assert.equal(list2.body[0].PhotoID, up2.body.PhotoID);
    assert.equal(list2.body[1].PhotoID, up.body.PhotoID);

    // Delete one; the other is retained and the deleted one is gone from file API
    const del = await request('DELETE', '/api/progress-photos/' + up.body.PhotoID, null, tokens.manager);
    assert.equal(del.status, 200);
    assert.equal(del.body.deleted, true);
    assert.equal((await request('GET', '/api/progress-photos/' + up.body.PhotoID + '/file', null, tokens.manager)).status, 404);
    const list3 = await request('GET', '/api/progress-photos?estimateId=' + eid, null, tokens.manager);
    assert.equal(list3.body.length, 1);
    assert.equal(list3.body[0].PhotoID, up2.body.PhotoID);
  });

  it('rejects empty, corrupted and oversized images', async () => {
    const eid = await createEstimate();
    trackEstimate(eid);
    const base = { estimateId: eid };

    // Disallowed extension
    const badExt = await request('POST', '/api/progress-photos/upload', { ...base, fileName: 'notes.txt', mimeType: 'text/plain', data: Buffer.from('hello').toString('base64') }, tokens.manager);
    assert.equal(badExt.status, 400);
    assert.equal(badExt.body.error, 'Please upload a valid JPG, JPEG, PNG or WEBP image.');

    // Empty content
    const empty = await request('POST', '/api/progress-photos/upload', { ...base, fileName: 'empty.png', mimeType: 'image/png', data: '' }, tokens.manager);
    assert.equal(empty.status, 400);
    assert.equal(empty.body.error, 'Please upload a valid JPG, JPEG, PNG or WEBP image.');

    // Renamed non-image (valid extension, wrong magic bytes)
    const fake = await request('POST', '/api/progress-photos/upload', { ...base, fileName: 'fake.jpg', mimeType: 'image/jpeg', data: Buffer.from('not an image at all').toString('base64') }, tokens.manager);
    assert.equal(fake.status, 400);
    assert.equal(fake.body.error, 'Please upload a valid JPG, JPEG, PNG or WEBP image.');

    // Over 10 MB
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(10 * 1024 * 1024 + 1)]);
    const oversize = await request('POST', '/api/progress-photos/upload', { ...base, fileName: 'big.jpg', mimeType: 'image/jpeg', data: big.toString('base64') }, tokens.manager);
    assert.equal(oversize.status, 400);
    assert.equal(oversize.body.error, 'Image exceeds the 10 MB limit.');

    const list = await request('GET', '/api/progress-photos?estimateId=' + eid, null, tokens.manager);
    assert.deepEqual(list.body, [], 'no rejected file is stored');
  });

  it('accepts JPG, WEBP and GIF images and rejects missing estimates', async () => {
    const eid = await createEstimate();
    trackEstimate(eid);

    for (const f of [
      { fileName: 'a.jpg', mimeType: 'image/jpeg', build: () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('data')]) },
      { fileName: 'b.webp', mimeType: 'image/webp', build: () => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.from('data')]) },
      { fileName: 'c.gif', mimeType: 'image/gif', build: () => Buffer.from('GIF89adata') },
    ]) {
      const r = await request('POST', '/api/progress-photos/upload', {
        estimateId: eid, fileName: f.fileName, mimeType: f.mimeType, data: f.build().toString('base64'),
      }, tokens.manager);
      assert.equal(r.status, 201, f.fileName + ': ' + JSON.stringify(r.body));
    }

    // Unknown estimate id
    const missing = await request('POST', '/api/progress-photos/upload', {
      estimateId: 999999999, fileName: 'x.png', mimeType: 'image/png', data: pngImage(),
    }, tokens.manager);
    assert.equal(missing.status, 404);
  });
});