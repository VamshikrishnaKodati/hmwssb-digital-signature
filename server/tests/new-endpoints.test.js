// ponytail: throwaway sanity check for the new users + audit-logs endpoints.
// Run: node tests/new-endpoints.test.js  (standalone, not part of npm test)
const http = require('http');
const app = require('../app');
const { cleanupTrackedData, trackUser } = require('./cleanup');

const PORT = 3999;
const server = app.listen(PORT);

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port: PORT, path, method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        const body = JSON.parse(data || '{}');
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

(async () => {
  try {
    const admin = await request('POST', '/api/auth/login', { username: 'admin_officer', password: 'password123' });
    const token = admin.body.token;
    const a = (v) => { if (!v) throw new Error('assertion failed'); };

    a(admin.status === 200, 'admin login');

    // list users
    const list = await request('GET', '/api/users', null, token);
    a(list.status === 200 && list.body.length >= 9, 'list users');

    // fetch real location IDs for FK validity
    const regions = (await request('GET', '/api/lookups/regions', null, token)).body;
    const regionId = regions[0]?.RegionID;
    const zones = (await request('GET', `/api/lookups/zones?regionId=${regionId}`, null, token)).body;
    const zoneId = zones[0]?.ZoneID;
    const divisions = (await request('GET', `/api/lookups/divisions?zoneId=${zoneId}`, null, token)).body;
    const divisionId = divisions[0]?.DivisionID;
    const circles = (await request('GET', `/api/lookups/circles?divisionId=${divisionId}`, null, token)).body;
    const circleId = circles[0]?.CircleID;
    const wards = (await request('GET', `/api/lookups/wards?circleId=${circleId}`, null, token)).body;
    const wardId = wards[0]?.WardID;

    // non-admin forbidden
    const manager = await request('POST', '/api/auth/login', { username: 'manager', password: 'password123' });
    const forb = await request('GET', '/api/users', null, manager.body.token);
    a(forb.status === 403, 'list users forbidden for non-admin');

    // create user
    const uniq = `test_user_${Date.now()}`;
    const created = await request('POST', '/api/users', {
      Username: uniq, Password: 'pass1234', Name: 'Test User', Designation: 'SiteEngineer',
      RegionID: regionId, ZoneID: zoneId, DivisionID: divisionId, CircleID: circleId, WardID: wardId,
      Email: `${uniq}@hmwssb.gov.in`, MobileNumber: '9000000000',
    }, token);
    a(created.status === 201, `create user (got ${created.status})`);
    const uid = created.body.UserID;
    trackUser(uid);

    // duplicate username rejected
    const dup = await request('POST', '/api/users', { Username: uniq, Password: 'x', Name: 'Dup', Designation: 'GM' }, token);
    a(dup.status === 400, 'duplicate username rejected');

    // invalid designation rejected
    const bad = await request('POST', '/api/users', { Username: `bad_${Date.now()}`, Password: 'x', Name: 'Bad', Designation: 'CEO' }, token);
    a(bad.status === 400, 'invalid designation rejected');

    // update user (rename + reset password)
    const upd = await request('PUT', `/api/users/${uid}`, { Name: 'Renamed User', Designation: 'BillingOfficer', Password: 'newpass123' }, token);
    a(upd.status === 200 && upd.body.Name === 'Renamed User' && upd.body.Designation === 'BillingOfficer', 'update user');

    // login with the new password
    const relogin = await request('POST', '/api/auth/login', { username: uniq, password: 'newpass123' });
    a(relogin.status === 200, 'relogin with reset password');

    // audit logs
    const logs = await request('GET', '/api/audit-logs', null, token);
    a(logs.status === 200 && Array.isArray(logs.body), 'list audit logs');
    const logsFiltered = await request('GET', '/api/audit-logs?estimateId=202', null, token);
    a(logsFiltered.status === 200, 'filter audit logs by estimateId');

    console.log('ALL NEW ENDPOINT CHECKS PASSED');
  } catch (err) {
    console.error('FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await cleanupTrackedData();
    server.closeAllConnections();
    server.close();
  }
})();
