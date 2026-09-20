const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');

const SERVER_PORT = 5566;
const BASE_URL = 'http://127.0.0.1:' + SERVER_PORT;
const JWT_SECRET = process.env.JWT_SECRET || 'hmwssb-jwt-secret-key-2024';

function makeToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

const tokens = {
  sorAdmin: makeToken({ UserID: 12, Username: 'sor_admin', Name: 'SoR Admin', Designation: 'SoRAdmin' }),
  manager:  makeToken({ UserID: 1, Username: 'manager', Name: 'Rajesh Kumar', Designation: 'Manager' }),
  md:       makeToken({ UserID: 7, Username: 'md', Name: 'MD User', Designation: 'MD' }),
};

function request(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const opts = {
      hostname: '127.0.0.1', port: SERVER_PORT,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let app, server;
let mdRoleId;
let mdGrantedKeys = [];

before(async () => {
  app = require('../app');
  server = app.listen(SERVER_PORT);
  await new Promise(r => setTimeout(r, 500));
});

after(async () => {
  if (mdRoleId) {
    const held = await request('GET', `/api/roles/${mdRoleId}/permissions`, null, tokens.sorAdmin);
    const current = (held.body?.data?.permissions || []).filter(p => p.Access === 'ALLOWED' && mdGrantedKeys.includes(p.PermissionKey) !== true)
      .map(p => p.PermissionKey);
    const desired = [...new Set([...current, ...mdGrantedKeys])];
    if (desired.length) await request('PUT', `/api/roles/${mdRoleId}/permissions`, { permissions: desired }, tokens.sorAdmin);
  }
  if (server) { server.closeAllConnections(); server.close(); }
});

describe('Role & Permission Management', () => {
  it('SoRAdmin can list all 16 roles', async () => {
    const res = await request('GET', '/api/roles', null, tokens.sorAdmin);
    assert.equal(res.status, 200);
    const roles = res.body?.data ?? res.body;
    assert.equal(roles.length, 16);
    const names = new Set(roles.map(r => r.RoleName));
    for (const n of ['Manager', 'DGM', 'GM', 'CGM', 'DOP', 'ED', 'MD', 'TenderOfficer', 'DirectorOfAdministration', 'SiteEngineer', 'BillingOfficer', 'FinanceClerk', 'FinanceManager', 'FinanceHead', 'Administrator', 'SoRAdmin']) {
      assert.ok(names.has(n), `missing role ${n}`);
    }
    mdRoleId = roles.find(r => r.RoleName === 'MD').RoleID;
  });

  it('non-SoRAdmin is blocked from role management', async () => {
    const res = await request('GET', '/api/roles', null, tokens.manager);
    assert.equal(res.status, 403);
    const put = await request('PUT', `/api/roles/${mdRoleId}/permissions`, { permissions: [] }, tokens.manager);
    assert.equal(put.status, 403);
  });

  it('unknown permission key is rejected with 400', async () => {
    const get = await request('GET', `/api/roles/${mdRoleId}/permissions`, null, tokens.sorAdmin);
    const base = (get.body?.data?.permissions || []).filter(p => p.Access === 'ALLOWED').map(p => p.PermissionKey);
    const res = await request('PUT', `/api/roles/${mdRoleId}/permissions`, { permissions: [...base, 'does.not.exist'] }, tokens.sorAdmin);
    assert.equal(res.status, 400);
  });

  it('MD cannot create tenders before the grant', async () => {
    const res = await request('POST', '/api/tender', {}, tokens.md);
    assert.equal(res.status, 403);
  });

  it('granting tender.create lets MD pass the tender route gate', async () => {
    const get = await request('GET', `/api/roles/${mdRoleId}/permissions`, null, tokens.sorAdmin);
    assert.equal(get.status, 200);
    const base = (get.body?.data?.permissions || []).filter(p => p.Access === 'ALLOWED').map(p => p.PermissionKey);
    assert.ok(!base.includes('tender.create'), 'MD should not already hold tender.create');

    const res = await request('PUT', `/api/roles/${mdRoleId}/permissions`, { permissions: [...base, 'tender.create'] }, tokens.sorAdmin);
    assert.equal(res.status, 200);
    const changes = res.body?.data?.changes || [];
    assert.ok(changes.some(c => c.PermissionKey === 'tender.create' && c.Action === 'GRANT'), 'audit must record the GRANT');
    mdGrantedKeys = ['tender.create'];

    const post = await request('POST', '/api/tender', {}, tokens.md);
    assert.notEqual(post.status, 403, 'MD must no longer be blocked by RBAC after grant (got 400/404/…, not 403)');
  });

  it('revoking tender.create restores the 403', async () => {
    const get = await request('GET', `/api/roles/${mdRoleId}/permissions`, null, tokens.sorAdmin);
    const desired = (get.body?.data?.permissions || []).filter(p => p.Access === 'ALLOWED').map(p => p.PermissionKey);
    const res = await request('PUT', `/api/roles/${mdRoleId}/permissions`, { permissions: desired.filter(k => k !== 'tender.create') }, tokens.sorAdmin);
    assert.equal(res.status, 200);
    mdGrantedKeys = [];

    const post = await request('POST', '/api/tender', {}, tokens.md);
    assert.equal(post.status, 403, 'RBAC must block MD again after revoke');
  });

  it('audit trail records the grant + revoke', async () => {
    const res = await request('GET', '/api/roles/audit', null, tokens.sorAdmin);
    assert.equal(res.status, 200);
    const rows = res.body?.data ?? res.body;
    const tc = rows.filter(r => r.PermissionKey === 'tender.create' && r.RoleName === 'MD');
    assert.ok(tc.some(r => r.Action === 'GRANT'), 'audit must contain the GRANT');
    assert.ok(tc.some(r => r.Action === 'REVOKE'), 'audit must contain the REVOKE');
  });
});