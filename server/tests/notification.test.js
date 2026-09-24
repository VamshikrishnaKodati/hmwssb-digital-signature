// Notification + Terminology tests: verifies workflow notifications are created
// on each transition, email templates render without errors, and response messages
// use the new workflow terminology.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const db = require('../config/db');
const { resolveLocation } = require('./helpers');
const { cleanupTrackedData, trackEstimate } = require('./cleanup');
const { buildWorkflowEmailHtml, buildWorkflowEmailText } = require('../utils/emailTemplate');

const PORT = 5398;
let server;
let items;
let location;
const tokens = {};

function request(method, path, body, authToken) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
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
  assert.equal(r.status, 200, `login ${username}: ${JSON.stringify(r.body)}`);
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
  try {
    const result = await action();
    return { result, captured };
  } finally {
    console.log = original;
  }
}

async function createEstimate(token) {
  const item = items.find(i => i.FormulaType === 'N');
  assert.ok(item, 'an N-formula item must be seeded');
  const res = await request('POST', '/api/estimates', {
    NameOfWork: `Notification Test ${Date.now()}`,
    WorkCategory: 'Water Supply',
    RegionID: location.RegionID,
    WardID: location.WardID,
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

async function getNotifications(token) {
  return request('GET', '/api/notifications', null, token);
}

async function getUnreadCount(token) {
  return request('GET', '/api/notifications/unread-count', null, token);
}

before(async () => {
  await new Promise(resolve => { server = app.listen(PORT, resolve); });
  tokens.manager = await login('manager');
  tokens.dgm = await login('dgm');
  tokens.gm = await login('gm');
  tokens.cgm = await login('cgm');
  tokens.dop = await login('dop');
  tokens.ed = await login('ed');
  tokens.md = await login('md');
  tokens.site_engineer = await login('site_engineer');
  tokens.billing_officer = await login('billing_officer');
  tokens.admin = await login('admin_officer');
  tokens.tender_officer = await login('tender_officer');
  tokens.director_admin = await login('director_admin');
  const itemRes = await request('GET', '/api/items?limit=1000', null, tokens.manager);
  items = itemRes.body;
  location = await resolveLocation(request, tokens.manager);
});

after(async () => {
  await cleanupTrackedData();
  server.closeAllConnections();
  server.close();
});

describe('Email Template Rendering', () => {
  it('workflow email HTML renders without error', () => {
    const html = buildWorkflowEmailHtml({
      recipientName: 'Test User',
      estimateNo: 'EST/2026-27/001/001',
      workName: 'Road Repair Works',
      action: 'Forwarded to DGM for review',
      fromUser: 'Manager',
      fromDesignation: 'Manager',
      remarks: 'Please review urgently',
      dateTime: new Date().toLocaleString('en-IN'),
    });
    assert.ok(html.includes('HMWSSB'), 'should contain HMWSSB header');
    assert.ok(html.includes('Test User'), 'should contain recipient name');
    assert.ok(html.includes('EST/2026-27/001/001'), 'should contain estimate no');
    assert.ok(html.includes('Road Repair Works'), 'should contain work name');
    assert.ok(html.includes('Forwarded to DGM'), 'should contain action');
    assert.ok(html.includes('Manager'), 'should contain from user');
    assert.ok(html.includes('Please review urgently'), 'should contain remarks');
  });

  it('workflow email text renders without error', () => {
    const text = buildWorkflowEmailText({
      recipientName: 'Test User',
      estimateNo: 'EST/2026-27/001/001',
      workName: 'Road Repair Works',
      action: 'Verified by DGM',
      fromUser: 'DGM',
      fromDesignation: 'DGM',
      dateTime: new Date().toLocaleString('en-IN'),
    });
    assert.ok(text.includes('Test User'), 'should contain recipient name');
    assert.ok(text.includes('EST/2026-27/001/001'), 'should contain estimate no');
    assert.ok(text.includes('Verified by DGM'), 'should contain action');
  });

  it('workflow email HTML renders without remarks', () => {
    const html = buildWorkflowEmailHtml({
      recipientName: 'User',
      estimateNo: 'EST-001',
      workName: 'Work',
      action: 'Tender Published',
      fromUser: 'TO',
      fromDesignation: 'Tender Officer',
      dateTime: new Date().toLocaleString('en-IN'),
    });
    assert.ok(html.includes('Tender Published'), 'should contain action without remarks');
  });

  it('workflow email text handles missing optional fields', () => {
    const text = buildWorkflowEmailText({
      estimateNo: 'EST-001',
      workName: 'Work',
    });
    assert.ok(text.includes('User'), 'should default recipient name');
    assert.ok(text.includes('System'), 'should default from user');
  });
});

describe('Notification Workflow Integration', () => {
  let est;

  it('submit creates notification for DGM', async () => {
    est = await createEstimate(tokens.manager);
    const countBefore = await getUnreadCount(tokens.dgm);

    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, tokens.manager));
    const m = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'submit OTP should be captured, got: ' + captured);
    const res = await request('POST', `/api/workflow/${est.EstimateID}/submit`, { otpCode: m[1] }, tokens.manager);
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const countAfter = await getUnreadCount(tokens.dgm);
    assert.ok(countAfter.body.count > countBefore.body.count, 'DGM unread count should increase after submit');
  });

  it('notification message contains estimate number', async () => {
    const res = await getNotifications(tokens.dgm);
    assert.equal(res.status, 200);
    const matching = res.body.find(n => n.EstimateID === est.EstimateID && n.Type === 'Submit');
    assert.ok(matching, 'should find submit notification for DGM');
    assert.ok(matching.Message.includes(est.EstimateNo), 'message should contain estimate number');
  });

  it('response messages use new terminology', async () => {
    const submitRes = await request('POST', `/api/workflow/${est.EstimateID}/submit`, { otpCode: 'invalid' }, tokens.manager);
    // The response message on success uses "verified" not "approved"
    // Check the DGM approve response (will fail with wrong OTP but we can check the non-OTP path)
    const revertRes = await request('POST', `/api/workflow/${est.EstimateID}/revert`, { remarks: 'Check terminology' }, tokens.dgm);
    assert.equal(revertRes.status, 200, JSON.stringify(revertRes.body));
    assert.ok(revertRes.body.message.includes('reverted'), 'revert message should use lowercase');
  });

  it('revert creates notification for creator', async () => {
    // Revert already happened in previous test, verify notification exists
    const res = await getNotifications(tokens.manager);
    assert.equal(res.status, 200);
    const matching = res.body.find(n => n.EstimateID === est.EstimateID && n.Type === 'Revert');
    assert.ok(matching, 'should find revert notification for manager');
    assert.ok(matching.Message.includes('returned') || matching.Message.includes('Reverted'), 'message should describe reversion');
  });

  it('resubmit + DGM approve creates notification for GM', async () => {
    // Persist the Action Taken Report first — resubmission validates the saved ATR.
    const atrSave = await request('PUT', `/api/estimates/${est.EstimateID}`,
      { ActionTakenReport: 'Corrected quantities as per reversion remarks' }, tokens.manager);
    assert.equal(atrSave.status, 200, JSON.stringify(atrSave.body));

    // Resubmit
    const { captured: subCap } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${est.EstimateID}/submit/request-otp`, {}, tokens.manager));
    const subM = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(subCap);
    assert.ok(subM, 'submit OTP captured, got: ' + subCap);
    const sub = await request('POST', `/api/workflow/${est.EstimateID}/submit`, { otpCode: subM[1], remarks: 'Resubmitting with corrections' }, tokens.manager);
    assert.equal(sub.status, 200, JSON.stringify(sub.body));

    // DGM approve
    const { captured: apprCap } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${est.EstimateID}/approve/request-otp`, {}, tokens.dgm));
    const apprM = /\[OTP\]\[DEV\] DGM Approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(apprCap);
    assert.ok(apprM, 'dgm approve OTP captured');
    const appr = await request('POST', `/api/workflow/${est.EstimateID}/approve`, { otpCode: apprM[1] }, tokens.dgm);
    assert.equal(appr.status, 200, JSON.stringify(appr.body));
    assert.ok(appr.body.message.includes('verified') || appr.body.message.includes('forwarded'), 'should use new terminology');

    // Check GM notification
    const countBefore = await getUnreadCount(tokens.gm);
    const notifRes = await getNotifications(tokens.gm);
    const matching = notifRes.body.find(n => n.EstimateID === est.EstimateID);
    assert.ok(matching, 'should find notification for GM after DGM approve');
  });

  it('mark notification as read', async () => {
    const list = await getNotifications(tokens.gm);
    assert.equal(list.status, 200);
    const unread = list.body.find(n => n.EstimateID === est.EstimateID && !n.IsRead);
    if (unread) {
      const mark = await request('PUT', `/api/notifications/${unread.NotificationID}/read`, null, tokens.gm);
      assert.equal(mark.status, 200, JSON.stringify(mark.body));
      const verify = await getNotifications(tokens.gm);
      const recheck = verify.body.find(n => n.NotificationID === unread.NotificationID);
      assert.ok(recheck.IsRead, 'notification should be marked as read');
    }
  });

  it('mark all as read clears unread count', async () => {
    const markAll = await request('PUT', '/api/notifications/read-all', null, tokens.gm);
    assert.equal(markAll.status, 200, JSON.stringify(markAll.body));
    const after = await getUnreadCount(tokens.gm);
    assert.equal(after.body.count, 0, 'unread count should be 0 after mark-all-read');
  });
});
