// Regression: MD final approval OTP verification returned HTTP 500 when the
// estimate already had a Tender row (uq_tender_estimate unique violation), and
// the OTP row was marked Verified=TRUE even though the approval never happened.
// The OTP claim now happens inside the approval transaction (so a DB error rolls
// it back) and an existing Tender is reused instead of re-inserted.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// Patch the tender-number generator before the app (and its controller) load so
// we can inject a failure and assert the OTP claim rolls back. The controller
// destructures this export at require time, so patching the cached module first
// is what it will pick up.
const tenderNoModule = require('../utils/tenderNo');
const realGenerateTenderNo = tenderNoModule.generateTenderNo;
let injectTenderFailure = false;
tenderNoModule.generateTenderNo = function (...args) {
  if (injectTenderFailure) throw new Error('injected tender-number failure');
  return realGenerateTenderNo(...args);
};

const app = require('../app');
const db = require('../config/db');
const { hashOtp } = require('../utils/otp');

const PORT = 5119;
let server;
let mdToken;
let mdUserId;
let dgmUserId;
const created = [];

function request(method, path, body, authToken) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port: PORT, path, method, headers: { 'Content-Type': 'application/json' } };
    if (authToken) opts.headers['Authorization'] = `Bearer ${authToken}`;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { return resolve({ status: res.statusCode, body: data }); }
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
  return r.body.data.token;
}

// Seeds an ED_Approved estimate owned by the MD, optionally with a pre-existing
// Tender and an OTP row. `otpUser`, `purpose` and `expired` let a test simulate a
// wrong user / wrong context / expired OTP.
async function seed({ withTender, otp, financialYear, ownerUserId, otpUser, purpose, expired, withOtp = true }) {
  const workId = 'MDTEST-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const ins = await db.query(
    `INSERT INTO "EstimateHeader"
       ("WorkID","NameOfWork","Status","Version","CurrentOwner","FinancialYear","EstimateNo")
     VALUES ($1,$2,'ED_Approved',1,$3,$4,$5) RETURNING "EstimateID"`,
    [workId, 'MD final 500 regression ' + workId, ownerUserId || mdUserId, financialYear || '2026-27', 'EST/TEST/' + workId]
  );
  const id = ins.rows[0].EstimateID;
  created.push(id);

  let tenderNo = null;
  if (withTender) {
    tenderNo = 'eTNO/TEST/' + id;
    await db.query(
      `INSERT INTO "Tender" ("EstimateID","TenderNo","TenderDate","EstimatedCost","Status")
       VALUES ($1,$2,CURRENT_DATE,$3,'Draft')`,
      [id, tenderNo, 1000]
    );
  }

  if (withOtp) {
    await db.query(
      `INSERT INTO "SignatureOTP" ("EstimateID","UserID","CodeHash","Purpose","ExpiresAt","Verified","Attempts")
       VALUES ($1,$2,$3,$4, now() + ($5 || ' seconds')::interval, FALSE, 0)`,
      [id, otpUser || mdUserId, hashOtp(otp), purpose || 'md_final', expired ? '-60' : '300']
    );
  }

  return { id, tenderNo };
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(PORT, resolve); });
  mdToken = await login('md');
  const u = await db.query(`SELECT "UserID" FROM "Users" WHERE "Username" = 'md'`);
  assert.ok(u.rows.length, 'md user must exist');
  mdUserId = u.rows[0].UserID;
  const d = await db.query(`SELECT "UserID" FROM "Users" WHERE "Username" = 'dgm'`);
  assert.ok(d.rows.length, 'dgm user must exist');
  dgmUserId = d.rows[0].UserID;
});

after(async () => {
  injectTenderFailure = false;
  await db.query('ALTER TABLE "EstimateHeader" DISABLE TRIGGER IF EXISTS trg_block_in_place_edit').catch(() => {});
  for (const sql of [
    `DELETE FROM "Tender" WHERE "EstimateID" = ANY($1)`,
    `DELETE FROM "SignatureOTP" WHERE "EstimateID" = ANY($1)`,
    `DELETE FROM "Workflow" WHERE "EstimateID" = ANY($1)`,
    `DELETE FROM "AuditLog" WHERE "EstimateID" = ANY($1)`,
    `DELETE FROM "Versions" WHERE "EstimateID" = ANY($1)`,
    `DELETE FROM "Notification" WHERE "EstimateID" = ANY($1)`,
    `DELETE FROM "EstimateDetails" WHERE "EstimateID" = ANY($1)`,
    `DELETE FROM "Abstract" WHERE "EstimateID" = ANY($1)`,
    `DELETE FROM "EstimateHeader" WHERE "EstimateID" = ANY($1)`,
  ]) {
    try { await db.query(sql, [created]); } catch (_) { /* table absent in some envs */ }
  }
  await db.query('ALTER TABLE "EstimateHeader" ENABLE TRIGGER IF EXISTS trg_block_in_place_edit').catch(() => {});
  await db.pool.end();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

describe('MD final approval: existing tender is reused, not a 500', () => {
  it('returns 200 and keeps the pre-existing tender (was 500: uq_tender_estimate)', async () => {
    const { id, tenderNo } = await seed({ withTender: true, otp: '123456' });
    const res = await request('POST', `/api/workflow/${id}/md-final`, { otpCode: '123456' }, mdToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.tenderNo, tenderNo, 'must reuse the existing tender number');

    const h = await db.query('SELECT "Status" FROM "EstimateHeader" WHERE "EstimateID" = $1', [id]);
    assert.equal(h.rows[0].Status, 'FinalApproved');

    const t = await db.query('SELECT count(*)::int AS n FROM "Tender" WHERE "EstimateID" = $1', [id]);
    assert.equal(t.rows[0].n, 1, 'exactly one tender per estimate');

    const o = await db.query(`SELECT "Verified" FROM "SignatureOTP" WHERE "EstimateID" = $1 AND "Purpose" = 'md_final'`, [id]);
    assert.equal(o.rows[0].Verified, true);
  });
});

describe('MD final approval: OTP failure modes are controlled 4xx', () => {
  it('wrong OTP returns 400 and is not consumed', async () => {
    const { id } = await seed({ withTender: false, otp: '111111' });
    const res = await request('POST', `/api/workflow/${id}/md-final`, { otpCode: '000000' }, mdToken);
    assert.equal(res.status, 400, JSON.stringify(res.body));

    const o = await db.query(`SELECT "Verified","Attempts" FROM "SignatureOTP" WHERE "EstimateID" = $1 AND "Purpose" = 'md_final'`, [id]);
    assert.equal(o.rows[0].Verified, false, 'a wrong OTP must not consume the row');
    assert.equal(o.rows[0].Attempts, 1);
  });

  it('replaying an already-used OTP returns 4xx (not 500)', async () => {
    const { id } = await seed({ withTender: false, otp: '222222' });
    const first = await request('POST', `/api/workflow/${id}/md-final`, { otpCode: '222222' }, mdToken);
    assert.equal(first.status, 200, JSON.stringify(first.body));

    const second = await request('POST', `/api/workflow/${id}/md-final`, { otpCode: '222222' }, mdToken);
    assert.ok(second.status >= 400 && second.status < 500, `duplicate verify must be 4xx, got ${second.status} ${JSON.stringify(second.body)}`);
  });

  it('expired OTP returns 400 and is not consumed', async () => {
    const { id } = await seed({ withTender: false, otp: '444444', expired: true });
    const res = await request('POST', `/api/workflow/${id}/md-final`, { otpCode: '444444' }, mdToken);
    assert.equal(res.status, 400, JSON.stringify(res.body));

    const o = await db.query(`SELECT "Verified" FROM "SignatureOTP" WHERE "EstimateID" = $1 AND "Purpose" = 'md_final'`, [id]);
    assert.equal(o.rows[0].Verified, false);
  });

  it('OTP issued to a different user is rejected with 4xx', async () => {
    const { id } = await seed({ withTender: false, otp: '555555', otpUser: dgmUserId });
    const res = await request('POST', `/api/workflow/${id}/md-final`, { otpCode: '555555' }, mdToken);
    assert.ok(res.status >= 400 && res.status < 500, `got ${res.status} ${JSON.stringify(res.body)}`);
  });

  it('OTP issued for a different estimate is rejected with 4xx', async () => {
    const a = await seed({ withTender: false, otp: '666666' });
    const b = await seed({ withTender: false, withOtp: false });
    const res = await request('POST', `/api/workflow/${b.id}/md-final`, { otpCode: '666666' }, mdToken);
    assert.ok(res.status >= 400 && res.status < 500, `got ${res.status} ${JSON.stringify(res.body)}`);

    const o = await db.query(`SELECT "Verified" FROM "SignatureOTP" WHERE "EstimateID" = $1 AND "Purpose" = 'md_final'`, [a.id]);
    assert.equal(o.rows[0].Verified, false, 'the other estimate OTP must remain unused');
  });

  it('OTP issued for a different action/context is rejected with 4xx', async () => {
    const { id } = await seed({ withTender: false, otp: '777777', purpose: 'dgm_approve' });
    const res = await request('POST', `/api/workflow/${id}/md-final`, { otpCode: '777777' }, mdToken);
    assert.ok(res.status >= 400 && res.status < 500, `got ${res.status} ${JSON.stringify(res.body)}`);

    const o = await db.query(`SELECT "Verified" FROM "SignatureOTP" WHERE "EstimateID" = $1 AND "Purpose" = 'dgm_approve'`, [id]);
    assert.equal(o.rows[0].Verified, false);
  });

  it('a user who is not the current owner is rejected with 4xx', async () => {
    const { id } = await seed({ withTender: false, otp: '888888' });
    const dgmToken = await login('dgm');
    const res = await request('POST', `/api/workflow/${id}/md-final`, { otpCode: '888888' }, dgmToken);
    assert.ok(res.status >= 400 && res.status < 500, `got ${res.status} ${JSON.stringify(res.body)}`);
  });
});

describe('MD final approval: success writes movement history and audit', () => {
  it('records a FinalApprove Workflow row and AuditLog entry', async () => {
    const { id } = await seed({ withTender: false, otp: '999999' });
    const res = await request('POST', `/api/workflow/${id}/md-final`, { otpCode: '999999' }, mdToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const wf = await db.query(`SELECT "Action","OTPVerified" FROM "Workflow" WHERE "EstimateID" = $1 ORDER BY "WorkflowID" DESC LIMIT 1`, [id]);
    assert.equal(wf.rows[0].Action, 'FinalApprove');
    assert.equal(wf.rows[0].OTPVerified, true);

    const al = await db.query(`SELECT "Action" FROM "AuditLog" WHERE "EstimateID" = $1 ORDER BY "AuditID" DESC LIMIT 1`, [id]);
    assert.equal(al.rows[0].Action, 'FinalApprove');
  });
});

describe('MD final approval: DB error does not consume the OTP', () => {
  it('rolls back the OTP claim when the approval transaction fails', async () => {
    const { id } = await seed({ withTender: false, otp: '333333' });
    injectTenderFailure = true;
    try {
      const res = await request('POST', `/api/workflow/${id}/md-final`, { otpCode: '333333' }, mdToken);
      assert.equal(res.status, 500, JSON.stringify(res.body));
    } finally {
      injectTenderFailure = false;
    }

    const o = await db.query(`SELECT "Verified" FROM "SignatureOTP" WHERE "EstimateID" = $1 AND "Purpose" = 'md_final'`, [id]);
    assert.equal(o.rows[0].Verified, false, 'a failed approval must not mark the OTP used');

    const h = await db.query('SELECT "Status" FROM "EstimateHeader" WHERE "EstimateID" = $1', [id]);
    assert.equal(h.rows[0].Status, 'ED_Approved', 'failed approval must not change status');
  });
});
