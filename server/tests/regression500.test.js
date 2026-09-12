// Regression coverage for the P1 500s:
//  1) GET /api/deleted-estimates crashed on an unquoted "u.Name" column
//     (PostgreSQL folds it to lower-case `u.name` which does not exist).
//  2) GET /api/estimates/abc fed a non-numeric id into an integer column
//     and exploded with 22P02 instead of a controlled 404.
// Both must never surface as HTTP 500.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');

const SERVER_PORT = 5107;
let server;
let tokens = {};

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
        let b;
        try { b = JSON.parse(data); } catch { return resolve({ status: res.statusCode, body: data }); }
        if (b && b.success === true) return resolve({ status: res.statusCode, body: b.data });
        if (b && b.success === false) return resolve({ status: res.statusCode, body: b.error || b });
        return resolve({ status: res.statusCode, body: b });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(SERVER_PORT, resolve); });
  for (const u of ['manager', 'admin_officer']) {
    const r = await request('POST', '/api/auth/login', { username: u, password: 'password123' });
    assert.equal(r.status, 200, `${u} login: ${JSON.stringify(r.body)}`);
    tokens[u] = r.body.token;
  }
});

after(async () => {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

describe('P1 regression: deleted estimates list', () => {
  it('returns 200 with rows for a Manager (was 500: column u.name does not exist)', async () => {
    const res = await request('GET', '/api/deleted-estimates?limit=10', null, tokens.manager);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body), 'body must be a list');
  });

  it('returns 200 with rows for an Administrator', async () => {
    const res = await request('GET', '/api/deleted-estimates?limit=10', null, tokens.admin_officer);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body));
  });

  it('denies non-authorized roles with 403 (not 500)', async () => {
    const r = await request('POST', '/api/auth/login', { username: 'site_engineer', password: 'password123' });
    assert.equal(r.status, 200, 'site_engineer login');
    const res = await request('GET', '/api/deleted-estimates?limit=10', null, r.body.token);
    assert.equal(res.status, 403, JSON.stringify(res.body));
  });
});

describe('P1 regression: malformed estimate id', () => {
  it('GET /api/estimates/abc returns 404 (was 500: invalid input syntax for integer)', async () => {
    const res = await request('GET', '/api/estimates/abc', null, tokens.manager);
    assert.equal(res.status, 404, JSON.stringify(res.body));
  });

  it('GET /api/estimates/999999 returns 404', async () => {
    const res = await request('GET', '/api/estimates/999999', null, tokens.manager);
    assert.equal(res.status, 404, JSON.stringify(res.body));
  });

  it('GET /api/estimates/0 returns 404', async () => {
    const res = await request('GET', '/api/estimates/0', null, tokens.manager);
    assert.equal(res.status, 404, JSON.stringify(res.body));
  });

  it('GET /api/estimates/-5 returns 404', async () => {
    const res = await request('GET', '/api/estimates/-5', null, tokens.manager);
    assert.equal(res.status, 404, JSON.stringify(res.body));
  });

  it('GET /api/estimates/213/versions with malformed id returns 404', async () => {
    const res = await request('GET', '/api/estimates/abc/versions', null, tokens.manager);
    assert.equal(res.status, 404, JSON.stringify(res.body));
  });

  it('GET /api/deleted-estimates/abc returns 404 (was 500 risk)', async () => {
    const res = await request('GET', '/api/deleted-estimates/abc', null, tokens.manager);
    assert.equal(res.status, 404, JSON.stringify(res.body));
  });
});