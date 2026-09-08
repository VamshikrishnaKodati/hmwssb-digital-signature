const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const { calcQty, calcAmount, calcAbstract } = require('../utils/calc');
const { resolveLocation } = require('./helpers');
const { cleanupTrackedData, trackEstimate } = require('./cleanup');

let server;
let token, managerToken, dgmToken, gmToken, cgmToken, dopToken, edToken, mdToken, tenderToken, procurementToken, siteEngineerToken, billingToken, adminToken, financeClerkToken, financeManagerToken, financeHeadToken, directorAdminToken;
let estimateID;
let tenderId;
let bidIds;
let billID;
let otpCode;
let items;
let location;

const SERVER_PORT = 5099;

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

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Captures the dev-only OTP log emitted by the server console while an action
// runs. The OTP is intentionally never returned to the client, so the test
// reads it from the backend log exactly like an operator would in development.
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

  const loginRes = await request('POST', '/api/auth/login', { username: 'manager', password: 'password123' });
  managerToken = loginRes.body.token;

  const itemsRes = await request('GET', '/api/items?limit=1000', null, managerToken);
  items = itemsRes.body;
  location = await resolveLocation(request, managerToken);
});

after(async () => {
  await cleanupTrackedData();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

describe('Golden Integration Test', () => {
  it('should login as all users', async () => {
    const r1 = await request('POST', '/api/auth/login', { username: 'manager', password: 'password123' });
    assert.equal(r1.status, 200);
    token = r1.body.token;

    const r2 = await request('POST', '/api/auth/login', { username: 'dgm', password: 'password123' });
    assert.equal(r2.status, 200);
    dgmToken = r2.body.token;

    const r3 = await request('POST', '/api/auth/login', { username: 'gm', password: 'password123' });
    assert.equal(r3.status, 200);
    gmToken = r3.body.token;

    const r4 = await request('POST', '/api/auth/login', { username: 'tender_officer', password: 'password123' });
    assert.equal(r4.status, 200);
    tenderToken = r4.body.token;

    const r5 = await request('POST', '/api/auth/login', { username: 'director_admin', password: 'password123' });
    assert.equal(r5.status, 200);
    procurementToken = r5.body.token;

    const r6 = await request('POST', '/api/auth/login', { username: 'site_engineer', password: 'password123' });
    assert.equal(r6.status, 200);
    siteEngineerToken = r6.body.token;

    const r7 = await request('POST', '/api/auth/login', { username: 'billing_officer', password: 'password123' });
    assert.equal(r7.status, 200);
    billingToken = r7.body.token;

    const r8 = await request('POST', '/api/auth/login', { username: 'admin_officer', password: 'password123' });
    assert.equal(r8.status, 200);
    adminToken = r8.body.token;

    const r9 = await request('POST', '/api/auth/login', { username: 'cgm', password: 'password123' });
    assert.equal(r9.status, 200);
    cgmToken = r9.body.token;

    const r10 = await request('POST', '/api/auth/login', { username: 'dop', password: 'password123' });
    assert.equal(r10.status, 200);
    dopToken = r10.body.token;

    const r11 = await request('POST', '/api/auth/login', { username: 'ed', password: 'password123' });
    assert.equal(r11.status, 200);
    edToken = r11.body.token;

    const r12 = await request('POST', '/api/auth/login', { username: 'md', password: 'password123' });
    assert.equal(r12.status, 200);
    mdToken = r12.body.token;

    const r13 = await request('POST', '/api/auth/login', { username: 'finance_clerk', password: 'password123' });
    assert.equal(r13.status, 200);
    financeClerkToken = r13.body.token;

    const r14 = await request('POST', '/api/auth/login', { username: 'finance_manager', password: 'password123' });
    assert.equal(r14.status, 200);
    financeManagerToken = r14.body.token;

    const r15 = await request('POST', '/api/auth/login', { username: 'finance_head', password: 'password123' });
    assert.equal(r15.status, 200);
    financeHeadToken = r15.body.token;

    const r16 = await request('POST', '/api/auth/login', { username: 'director_admin', password: 'password123' });
    assert.equal(r16.status, 200);
    directorAdminToken = r16.body.token;
  });

  it('should create estimate with correct calculation', async () => {
    assert.ok(items.length > 0, 'item master must be seeded');
    const get = (code) => items.find(i => i.ItemCode === code);
    assert.ok(get('BARR-HW-001'), 'BARR-HW-001 (Civil/L) must exist');
    assert.ok(get('PAINT-001'), 'PAINT-001 (Civil/LxB) must exist');
    assert.ok(get('EXC-001'), 'EXC-001 (Civil/LxBxD) must exist');
    assert.ok(get('CI-HW-001'), 'CI-HW-001 (Civil/N) must exist');
    assert.ok(get('REINF-001'), 'REINF-001 (Civil/NxL) must exist');
    assert.ok(get('AIRVALVE-50MM'), 'AIRVALVE-50MM (Material/N) must exist');
    assert.ok(get('FERRULE-20MM'), 'FERRULE-20MM (Material/N) must exist');
    assert.ok(get('DIP-100MM'), 'DIP-100MM (Material/L) must exist');
    assert.ok(get('PIPE-HDPE-63MM'), 'PIPE-HDPE-63MM (Material/L) must exist');

    const detailInputs = [
      { code: 'BARR-HW-001', n: null, l: 10.5, b: null, d: null },
      { code: 'PAINT-001', n: null, l: 8.0, b: 4.0, d: null },
      { code: 'EXC-001', n: null, l: 8.0, b: 4.0, d: 0.3 },
      { code: 'CI-HW-001', n: 2.5, l: null, b: null, d: null },
      { code: 'REINF-001', n: 25.0, l: 3.0, b: null, d: null },
      { code: 'AIRVALVE-50MM', n: 3.5, l: null, b: null, d: null },
      { code: 'FERRULE-20MM', n: 12.0, l: null, b: null, d: null },
      { code: 'DIP-100MM', n: null, l: 15.0, b: null, d: null },
      { code: 'PIPE-HDPE-63MM', n: null, l: 10.0, b: null, d: null },
    ];

    const expectedDetails = detailInputs.map((d) => {
      const item = get(d.code);
      const qty = round2(calcQty(item.FormulaType, { n: d.n, l: d.l, b: d.b, d: d.d }));
      const amount = round2(calcAmount(qty, item.Rate));
      return {
        itemID: item.ItemID,
        category: item.Category,
        qty,
        rate: item.Rate,
        amount,
        rateIncludesGST: item.RateIncludesGST,
      };
    });

    const lsProvision = 6121.77;
    const additionalItems = 8250;
    const gstPercent = 18;
    const expectedAbstract = calcAbstract(expectedDetails, gstPercent, lsProvision, additionalItems);

    const Items = detailInputs.map((d) => {
      const item = get(d.code);
      return {
        ItemID: item.ItemID,
        Category: item.Category,
        FormulaType: item.FormulaType,
        Unit: item.Unit,
        Rate: item.Rate,
        N: d.n,
        L: d.l,
        B: d.b,
        D: d.d,
      };
    });

    const payload = {
      NameOfWork: 'Golden Test Estimate',
      WorkCategory: 'Water Supply',
      RegionID: location.RegionID,
      WardID: location.WardID,
      GSTPercent: gstPercent,
      LSProvision: lsProvision,
      AdditionalItems: [{ Description: 'Additional items', Amount: additionalItems }],
      Items,
    };

    const res = await request('POST', '/api/estimates', payload, token);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.ok(res.body.EstimateID, 'response should carry EstimateID');
    estimateID = res.body.EstimateID;
    trackEstimate(estimateID);

    const abs = res.body.Abstract;
    assert.ok(abs, 'response should carry Abstract');

    console.log('\n=== GOLDEN TEST RESULTS ===');
    console.log(`CivilTotal:     ${abs.CivilTotal} (expected ${round2(expectedAbstract.civilTotal)})`);
    console.log(`MaterialTotal:  ${abs.MaterialTotal} (expected ${round2(expectedAbstract.materialTotal)})`);
    console.log(`CostOfEstimate: ${abs.CostOfEstimate} (expected ${round2(expectedAbstract.costOfEstimate)})`);
    console.log(`Subtotal:       ${abs.Subtotal} (expected ${round2(expectedAbstract.subtotal)})`);
    console.log(`GST (18%):      ${abs.GST} (expected ${round2(expectedAbstract.gst)})`);
    console.log(`AdditionalItems:${abs.AdditionalItemsTotal} (expected ${round2(expectedAbstract.additionalItems)})`);
    console.log(`LSProvision:    ${abs.LSProvision} (expected ${round2(expectedAbstract.lsProvision)})`);
    console.log(`GrandTotal:     ${abs.GrandTotal} (expected ${round2(expectedAbstract.grandTotal)})`);
    console.log('==========================\n');

    assert.ok(Math.abs(abs.CivilTotal - expectedAbstract.civilTotal) < 0.01);
    assert.ok(Math.abs(abs.MaterialTotal - expectedAbstract.materialTotal) < 0.01);
    assert.ok(Math.abs(abs.CostOfEstimate - expectedAbstract.costOfEstimate) < 0.01);
    assert.ok(Math.abs(abs.Subtotal - expectedAbstract.subtotal) < 0.01);
    assert.ok(Math.abs(abs.GST - expectedAbstract.gst) < 0.01);
    assert.ok(Math.abs(Number(abs.AdditionalItemsTotal) - expectedAbstract.additionalItems) < 0.01);
    assert.ok(Math.abs(abs.GrandTotal - expectedAbstract.grandTotal) < 0.01);
  });

  it('should apply GST once on the full cost even when an item is GST-inclusive', async () => {
    const gstInc = items.find(i => i.RateIncludesGST === true && i.FormulaType === 'N');
    const plain = items.find(i => i.RateIncludesGST === false && i.FormulaType === 'N');
    assert.ok(gstInc, 'a GST-inclusive N-formula item must be seeded');
    assert.ok(plain, 'a plain N-formula item must be seeded');

    const inputs = [
      { item: plain, n: 5, l: null, b: null, d: null },
      { item: gstInc, n: 7, l: null, b: null, d: null },
    ];

    const expectedDetails = inputs.map(({ item, ...d }) => {
      const qty = round2(calcQty(item.FormulaType, d));
      return {
        itemID: item.ItemID,
        category: item.Category,
        qty,
        rate: item.Rate,
        amount: round2(calcAmount(qty, item.Rate)),
        rateIncludesGST: item.RateIncludesGST,
      };
    });

    const gstPercent = 18;
    const expectedAbstract = calcAbstract(expectedDetails, gstPercent, 0, 0);

    const res = await request('POST', '/api/estimates', {
      NameOfWork: 'GST Guard Estimate',
      WorkCategory: 'Water Supply',
      RegionID: location.RegionID,
      WardID: location.WardID,
      GSTPercent: gstPercent,
      LSProvision: 0,
      AdditionalItems: [],
      Items: inputs.map(({ item, ...d }) => ({
        ItemID: item.ItemID,
        Category: item.Category,
        FormulaType: item.FormulaType,
        Unit: item.Unit,
        Rate: item.Rate,
        N: d.n,
        L: d.l,
        B: d.b,
        D: d.d,
      })),
    }, token);

    assert.equal(res.status, 201, JSON.stringify(res.body));
    const abs = res.body.Abstract;
    trackEstimate(res.body.EstimateID);

    assert.ok(Math.abs(abs.GST - round2(abs.CostOfEstimate * gstPercent / 100)) < 0.01,
      'GST must be computed once on the full cost of estimate (GST-inclusive item not double-counted)');
    const pairs = [['CostOfEstimate', 'costOfEstimate'], ['Subtotal', 'subtotal'], ['GST', 'gst'], ['GrandTotal', 'grandTotal']];
    for (const [apiKey, calcKey] of pairs) {
      assert.ok(Math.abs(abs[apiKey] - expectedAbstract[calcKey]) < 0.01,
        `${apiKey}: got ${abs[apiKey]}, expected ${expectedAbstract[calcKey]}`);
    }
  });

  it('should submit the estimate', async () => {
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${estimateID}/submit/request-otp`, {}, token));
    const m = /\[OTP\]\[DEV\] Submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'submit OTP should be captured from the dev log');
    const otp = m[1];

    const res = await request('POST', `/api/workflow/${estimateID}/submit`, { otpCode: otp }, token);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('should verify status Submitted', async () => {
    const res = await request('GET', `/api/estimates/${estimateID}`, null, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.Status, 'Submitted');
    assert.equal(res.body.Version, 1);
  });

  it('should approve (DGM escalate to GM)', async () => {
    // DGM approval is OTP-gated (workflowController.verifyDgmApprove).
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${estimateID}/approve/request-otp`, {}, dgmToken));
    const m = /\[OTP\]\[DEV\] DGM Approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'dgm approve OTP should be captured from the dev log');
    const res = await request('POST', `/api/workflow/${estimateID}/approve`, { otpCode: m[1] }, dgmToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('should verify status DGM_Approved', async () => {
    const res = await request('GET', `/api/estimates/${estimateID}`, null, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.Status, 'DGM_Approved');
  });

  it('should reject a separate GM approve step (digital sign is the GM authorization)', async () => {
    const res = await request('POST', `/api/workflow/${estimateID}/approve`, {}, gmToken);
    assert.equal(res.status, 403);
  });

  it('should request signature OTP (GM)', async () => {
    const { result, captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${estimateID}/sign/request-otp`, {}, gmToken));
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.devOtp, undefined, 'OTP must never be returned in API responses');
    assert.ok(result.body.sentTo, 'sentTo (recipient email) should be returned');
    assert.ok(result.body.sentTo.includes('*'), 'recipient email should be masked');
    const m = /\[OTP\]\[DEV\] Signature OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, `OTP should be logged to the server console in dev; got: ${captured}`);
    otpCode = m[1];
  });

  it('should enforce the resend cooldown', async () => {
    const res = await request('POST', `/api/workflow/${estimateID}/sign/request-otp`, {}, gmToken);
    assert.equal(res.status, 429, JSON.stringify(res.body));
    assert.ok(res.body.resendIn > 0, 'resendIn should be returned');
  });

  it('should digitally sign & audit (GM) after OTP verification', async () => {
    const res = await request('POST', `/api/workflow/${estimateID}/sign`,
      { otpCode, certificateId: 'HMWSSB-DSC-GOLDEN-0001' }, gmToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.message, 'response should have a message');
  });

  it('should prevent OTP reuse after successful verification', async () => {
    const res = await request('POST', `/api/workflow/${estimateID}/sign`,
      { otpCode, certificateId: 'HMWSSB-DSC-GOLDEN-0001' }, gmToken);
    assert.equal(res.status, 403, JSON.stringify(res.body));
    assert.match(res.body.error, /current owner/i);
  });

  it('should verify status GM_Recommended after GM sign', async () => {
    const res = await request('GET', `/api/estimates/${estimateID}`, null, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.Status, 'GM_Recommended');
  });

  it('should submit to DOP via CGM', async () => {
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${estimateID}/cgm-submit/request-otp`, {}, cgmToken));
    const m = /\[OTP\]\[DEV\] cgm_submit OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'cgm submit OTP should be captured');
    const res = await request('POST', `/api/workflow/${estimateID}/cgm-submit`, { otpCode: m[1] }, cgmToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('should verify status CGM_Submitted', async () => {
    const res = await request('GET', `/api/estimates/${estimateID}`, null, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.Status, 'CGM_Submitted');
  });

  it('should approve at DOP and forward to ED', async () => {
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${estimateID}/dop-approve/request-otp`, {}, dopToken));
    const m = /\[OTP\]\[DEV\] dop_approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'dop approve OTP should be captured');
    const res = await request('POST', `/api/workflow/${estimateID}/dop-approve`, { otpCode: m[1] }, dopToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('should verify status DOP_Approved', async () => {
    const res = await request('GET', `/api/estimates/${estimateID}`, null, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.Status, 'DOP_Approved');
  });

  it('should approve at ED and forward to MD', async () => {
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${estimateID}/ed-approve/request-otp`, {}, edToken));
    const m = /\[OTP\]\[DEV\] ed_approve OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'ed approve OTP should be captured');
    const res = await request('POST', `/api/workflow/${estimateID}/ed-approve`, { otpCode: m[1] }, edToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('should verify status ED_Approved', async () => {
    const res = await request('GET', `/api/estimates/${estimateID}`, null, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.Status, 'ED_Approved');
  });

  it('should final approve at MD (forwards to Director of Administration for FCN)', async () => {
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/workflow/${estimateID}/md-final/request-otp`, {}, mdToken));
    const m = /\[OTP\]\[DEV\] md_final OTP for estimate \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'md final OTP should be captured');
    const res = await request('POST', `/api/workflow/${estimateID}/md-final`, { otpCode: m[1] }, mdToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('should verify final status FinalApproved', async () => {
    const res = await request('GET', `/api/estimates/${estimateID}`, null, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.Status, 'FinalApproved');
  });

  it('should Director of Administration generate FCN', async () => {
    const res = await request('POST', `/api/workflow/${estimateID}/generate-fcn`, {}, directorAdminToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.fcnNo, 'FCN number should be returned');
    const est = await request('GET', `/api/estimates/${estimateID}`, null, token);
    assert.equal(est.body.Status, 'FCNGenerated');
  });

  it('should DirectorOfAdmin generate Administrative Sanction', async () => {
    const res = await request('POST', `/api/workflow/${estimateID}/generate-admin-sanction`, { sanctionNo: 'AS/2026-27/001' }, directorAdminToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const est = await request('GET', `/api/estimates/${estimateID}`, null, token);
    assert.equal(est.body.Status, 'AdminSanctionGenerated');
  });

  it('should Director assign TS authority to GM', async () => {
    const res = await request('POST', `/api/workflow/${estimateID}/assign-ts-authority`, { AuthorityRole: 'GM' }, directorAdminToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const est = await request('GET', `/api/estimates/${estimateID}`, null, token);
    assert.equal(est.body.Status, 'TSPending');
  });

  it('should assigned TS authority (GM) approve TS', async () => {
    const res = await request('POST', `/api/workflow/${estimateID}/approve-ts`, { remarks: 'TS approved' }, gmToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const est = await request('GET', `/api/estimates/${estimateID}`, null, token);
    assert.equal(est.body.Status, 'TSApproved');
  });

  it('should auto-create tender row after TSApproved', async () => {
    const res = await request('GET', '/api/tender', null, tenderToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const tender = res.body.find(t => t.EstimateID === estimateID);
    assert.ok(tender, 'auto-created tender not found');
    assert.ok(tender.TenderNo && tender.TenderNo.startsWith('eTNO/'), `unexpected TenderNo ${tender.TenderNo}`);
  });

  it('should publish the tender (TenderOfficer)', async () => {
    const res = await request('POST', `/api/workflow/${estimateID}/publish-tender`, {}, tenderToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('should capture tender id and verify tender fields', async () => {
    const res = await request('GET', '/api/tender', null, tenderToken);
    const tender = res.body.find(t => t.EstimateID === estimateID);
    assert.ok(tender, 'tender not found');
    tenderId = tender.TenderID;
    assert.equal(tender.Status, 'Published', 'publish should mark tender Published');
    assert.ok(Number(tender.EstimatedCost) > 0, 'EstimatedCost should be set');
  });

  it('should generate BOQ from approved estimate items', async () => {
    const res = await request('GET', `/api/tender/${tenderId}/boq`, null, tenderToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body) && res.body.length >= 9, 'BOQ should list all estimate items');
    const civil = res.body.filter(r => r.Category === 'Civil');
    const material = res.body.filter(r => r.Category === 'Material');
    assert.ok(civil.length > 0 && material.length > 0, 'BOQ should contain both civil and material items');
    assert.ok(res.body[0].SNo === 1 && res.body[0].Description, 'BOQ rows should be numbered with descriptions');
  });

  it('should update tender with NIT-specific fields', async () => {
    const res = await request('PUT', `/api/tender/${tenderId}`, {
      TenderType: 'Open',
      BidStartDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
      BidEndDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      CompletionPeriod: '6 months',
      EMD: 50000,
      TenderFee: 1000,
      BidValidity: 90,
      EligibilityCriteria: 'Registered contractor with minimum 3 years experience',
      RequiredDocuments: 'GST registration, PAN, registration certificate, EMD proof',
      PerformanceSecurity: '5% of contract value',
    }, tenderToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(Number(res.body.EMD), 50000);
    assert.ok(res.body.EligibilityCriteria, 'eligibility should persist');
  });

  it('should submit 3 bids (1 ineligible, 2 eligible)', async () => {
    const b1 = await request('POST', `/api/bids/tender/${tenderId}`, {
      ContractorName: 'Alpha Constructions', RegistrationNo: 'REG-ALPHA', Email: 'alpha@test.in',
      TechnicalBid: 'ISO 9001 certified, 10 water projects completed',
      FinancialBidAmount: 2485000, EMD: 50000,
    }, tenderToken);
    assert.equal(b1.status, 201, JSON.stringify(b1.body));

    const b2 = await request('POST', `/api/bids/tender/${tenderId}`, {
      ContractorName: 'Beta Infra Ltd', RegistrationNo: 'REG-BETA', Email: 'beta@test.in',
      TechnicalBid: '2 water projects completed',
      FinancialBidAmount: 2421000, EMD: 50000,
    }, tenderToken);
    assert.equal(b2.status, 201, JSON.stringify(b2.body));

    const b3 = await request('POST', `/api/bids/tender/${tenderId}`, {
      ContractorName: 'Gamma Engineering', RegistrationNo: 'REG-GAMMA', Email: 'gamma@test.in',
      TechnicalBid: 'ISO 9001, 5 major pipelines executed',
      FinancialBidAmount: 2511000, EMD: 50000,
    }, tenderToken);
    assert.equal(b3.status, 201, JSON.stringify(b3.body));

    bidIds = [b1.body.BidID, b2.body.BidID, b3.body.BidID];
    const list = await request('GET', `/api/bids/tender/${tenderId}`, null, tenderToken);
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 3);
    assert.ok(list.body.every(b => b.ContractorName), 'bids should join contractor names');
  });

  it('should close bid submission and complete bid opening (TenderOfficer owns opening)', async () => {
    const closed = await request('POST', `/api/tender/${tenderId}/close`, {}, tenderToken);
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    const started = await request('POST', `/api/tender/${tenderId}/bid-opening/start`, {}, tenderToken);
    assert.equal(started.status, 200, JSON.stringify(started.body));
    for (const id of bidIds) {
      const opened = await request('POST', `/api/bids/${id}/open`, {}, tenderToken);
      assert.equal(opened.status, 200, `bid ${id} must open: ${JSON.stringify(opened.body)}`);
    }
    const done = await request('POST', `/api/tender/${tenderId}/bid-opening/complete`, {}, tenderToken);
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.effectiveStatus, 'TechnicalEvaluationPending');
  });

  it('should evaluate bids technically (Beta disqualified, Alpha/Gamma qualified)', async () => {
    const res = await request('POST', `/api/bids/tender/${tenderId}/evaluate/technical`, {
      results: [
        { BidID: bidIds[0], Qualified: true, Remarks: 'Meets all eligibility criteria' },
        { BidID: bidIds[1], Qualified: false, Remarks: 'Insufficient experience (only 2 projects)' },
        { BidID: bidIds[2], Qualified: true, Remarks: 'Meets all eligibility criteria' },
      ],
    }, tenderToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.tenderStatus, 'FinancialEvaluationPending', 'all technical evals done → await financial evaluation');

    const bids = await request('GET', `/api/bids/tender/${tenderId}`, null, tenderToken);
    const beta = bids.body.find(b => b.BidID === bidIds[1]);
    assert.equal(beta.TechnicalStatus, 'Disqualified');
    assert.ok(beta.TechnicalRemarks, 'rejection must carry a reason');
  });

  it('should evaluate financially and rank eligible bids (Beta L3 excluded)', async () => {
    const res = await request('POST', `/api/bids/tender/${tenderId}/evaluate/financial`, {}, tenderToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { ranked } = res.body;
    assert.equal(ranked.length, 2, 'only eligible bidders are ranked');

    const bids = await request('GET', `/api/bids/tender/${tenderId}`, null, tenderToken);
    const alpha = bids.body.find(b => b.BidID === bidIds[0]);
    const gamma = bids.body.find(b => b.BidID === bidIds[2]);
    const beta = bids.body.find(b => b.BidID === bidIds[1]);
    assert.equal(alpha.Rank, 1, 'Alpha quoted lowest eligible → L1');
    assert.equal(gamma.Rank, 2, 'Gamma quoted higher than Alpha → L2');
    assert.equal(beta.Rank, null, 'rejected bidder is not ranked');
  });

  it('should identify L1 from the persisted evaluation and award it (Director)', async () => {
    const l1 = await request('POST', `/api/bids/tender/${tenderId}/l1`, {}, tenderToken);
    assert.equal(l1.status, 200, JSON.stringify(l1.body));
    assert.equal(l1.body.l1.BidID, bidIds[0], 'Alpha (lowest quote) is the persisted L1');

    const res = await request('POST', `/api/bids/tender/${tenderId}/award`, { BidID: bidIds[0] }, directorAdminToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.winner.ContractorName, 'Alpha Constructions');
    assert.equal(res.body.tenderStatus, 'WorkAwarded');

    const list = await request('GET', `/api/bids/tender/${tenderId}`, null, tenderToken);
    assert.equal(list.body.find(b => b.BidID === bidIds[0]).IsSelected, true);
  });

  it('should generate the NIT as a PDF', async () => {
    const res = await request('GET', `/api/tender/${tenderId}/nit`, null, tenderToken);
    assert.equal(res.status, 200, 'NIT should generate as PDF');
    assert.ok(res.body.includes('Tender No') || res.body.length > 1000, 'NIT should contain tender details');
  });

  it('should create the agency record (DirectorOfAdministration)', async () => {
    const res = await request('POST', '/api/agency', {
      EstimateID: estimateID,
      AgencyName: 'Golden Test Agency Pvt Ltd',
      AgencyCode: 'GTA-001',
      AgreementNo: 'AGT-GT-001',
      AgreementDate: new Date().toISOString().slice(0, 10),
      TenderValue: 1000000,
      CompletionPeriod: '6 months',
      SecurityDeposit: 50000,
      PerformanceGuarantee: 100000,
      ContractorName: 'Golden Contractor',
      ContactDetails: 'contractor@golden.test',
    }, procurementToken);
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });

  it('should select agency (DirectorOfAdministration)', async () => {
    const res = await request('POST', `/api/workflow/${estimateID}/select-agency`, {}, directorAdminToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('should start work (SiteEngineer)', async () => {
    const res = await request('POST', `/api/workflow/${estimateID}/start-work`, {}, siteEngineerToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('should complete work (SiteEngineer)', async () => {
    const res = await request('POST', `/api/workflow/${estimateID}/complete-work`, {}, siteEngineerToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('should create a bill (BillingOfficer) for WorkCompleted estimate', async () => {
    const est = await request('GET', `/api/estimates/${estimateID}`, null, token);
    const grandTotal = Number(est.body.Abstract.GrandTotal);
    const half = Math.round(grandTotal * 0.5 * 100) / 100;
    const billRes = await request('POST', '/api/billing', {
      EstimateID: estimateID,
      BillType: 'RA',
      BillNo: 'RA-001',
      BillDate: new Date().toISOString().slice(0, 10),
      GST: Math.round(half * 0.18 * 100) / 100,
      NetAmount: Math.round(half * 1.18 * 100) / 100,
      Measurements: 'MB 10/2026 pp. 12-14',
    }, billingToken);
    assert.equal(billRes.status, 201, JSON.stringify(billRes.body));
    billID = billRes.body.bill.BillID;
  });

  it('should reject inward for a bill not cleared to Finance', async () => {
    const res = await request('POST', '/api/finance/inward', {
      BillID: billID, Amount: 100000, InwardNumber: 'FIN-GOLD-EARLY',
    }, financeClerkToken);
    assert.ok(res.status >= 400, JSON.stringify(res.body));
  });

  it('should reject bill submission without OTP', async () => {
    const res = await request('POST', `/api/billing/${billID}/submit`, {}, billingToken);
    assert.ok(res.status >= 400, JSON.stringify(res.body));
  });

  it('should attach and remove a document on the draft (BillingOfficer)', async () => {
    const add = await request('POST', `/api/billing/${billID}/documents`, {
      DocType: 'Measurement Book', DocName: 'MB Page 12-14', FilePath: 'MB/10-2026',
    }, billingToken);
    assert.equal(add.status, 201, JSON.stringify(add.body));
    const det = await request('GET', `/api/billing/${billID}`, null, billingToken);
    assert.equal(det.body.documents.length, 1, 'document should appear on bill detail');
    const docId = det.body.documents[0].DocumentID;
    const rm = await request('DELETE', `/api/billing/${billID}/documents/${docId}`, null, billingToken);
    assert.equal(rm.status, 200, JSON.stringify(rm.body));
  });

  it('should submit the bill with OTP (BillingOfficer)', async () => {
    const { result, captured } = await captureOtpFromLog(() =>
      request('POST', `/api/billing/${billID}/submit/request-otp`, {}, billingToken));
    assert.equal(result.status, 200, JSON.stringify(result.body));
    const m = /\[OTP\]\[DEV\] Bill Submit OTP for bill \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'bill submit OTP should be captured from the dev log');
    const res = await request('POST', `/api/billing/${billID}/submit`, { otpCode: m[1] }, billingToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'SubmittedToManager');
    assert.equal(res.body.bill.Status, 'SubmittedToManager');
    assert.equal(res.body.bill.CurrentStep, 'Manager');
  });

  it('should notify the Manager of the submission', async () => {
    const notes = await request('GET', '/api/notifications', null, managerToken);
    assert.equal(notes.status, 200, JSON.stringify(notes.body));
    const hit = notes.body.find(n => n.Type === 'BillSubmitted' && n.EstimateID === estimateID);
    assert.ok(hit, 'Manager should have a BillSubmitted notification for this estimate');
  });

  it('should not allow Manager to check before OTP', async () => {
    const res = await request('POST', `/api/billing/${billID}/check`, {}, managerToken);
    assert.ok(res.status >= 400, JSON.stringify(res.body));
  });

  it('should reject return without remarks (Manager)', async () => {
    const res = await request('POST', `/api/billing/${billID}/return`, {}, managerToken);
    assert.equal(res.status, 400, JSON.stringify(res.body));
  });

  it('should return the bill to the Billing Officer (Manager)', async () => {
    const res = await request('POST', `/api/billing/${billID}/return`, { remarks: 'Quantities need re-check' }, managerToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const det = await request('GET', `/api/billing/${billID}`, null, billingToken);
    assert.equal(det.body.bill.Status, 'ReturnedToBiller', JSON.stringify(det.body.bill));
    assert.equal(det.body.bill.ReturnRemarks, 'Quantities need re-check');
    assert.equal(det.body.history[det.body.history.length - 1].Action, 'MANAGER_BILL_RETURNED');
  });

  it('should resubmit the returned bill (BillingOfficer)', async () => {
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/billing/${billID}/submit/request-otp`, {}, billingToken));
    const m = /\[OTP\]\[DEV\] Bill Submit OTP for bill \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'resubmit OTP should be captured from the dev log');
    const res = await request('POST', `/api/billing/${billID}/submit`, { otpCode: m[1] }, billingToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.bill.Status, 'SubmittedToManager');
    assert.ok(!res.body.bill.ReturnRemarks, 'return fields should be cleared on resubmit');
  });

  it('should check the bill at Manager (L1)', async () => {
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/billing/${billID}/check/request-otp`, {}, managerToken));
    const m = /\[OTP\]\[DEV\] Bill Check OTP for bill \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'manager check OTP should be captured from the dev log');
    const res = await request('POST', `/api/billing/${billID}/check`, { otpCode: m[1], remarks: 'L1 ok' }, managerToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'ManagerChecked');
    assert.equal(res.body.bill.CurrentStep, 'DGM');
  });

  it('should return the bill to Manager (DGM)', async () => {
    const res = await request('POST', `/api/billing/${billID}/return`, { remarks: 'Approved amount mismatch' }, dgmToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const det = await request('GET', `/api/billing/${billID}`, null, dgmToken);
    assert.equal(det.body.bill.Status, 'ReturnedToManager', JSON.stringify(det.body.bill));
    assert.equal(det.body.history[det.body.history.length - 1].Action, 'DGM_BILL_RETURNED');
  });

  it('should re-check the bill at Manager after return', async () => {
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/billing/${billID}/check/request-otp`, {}, managerToken));
    const m = /\[OTP\]\[DEV\] Bill Check OTP for bill \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'recheck OTP should be captured' + (captured ? ': ' + captured : ''));
    const res = await request('POST', `/api/billing/${billID}/check`, { otpCode: m[1] }, managerToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'ManagerChecked');
  });

  it('should check the bill at DGM (L2)', async () => {
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/billing/${billID}/check/request-otp`, {}, dgmToken));
    const m = /\[OTP\]\[DEV\] Bill Check OTP for bill \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'dgm check OTP should be captured from the dev log');
    const res = await request('POST', `/api/billing/${billID}/check`, { otpCode: m[1], remarks: 'L2 ok' }, dgmToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'DGMChecked');
    assert.equal(res.body.bill.CurrentStep, 'GM');
  });

  it('should return the bill to DGM (GM)', async () => {
    const res = await request('POST', `/api/billing/${billID}/return`, { remarks: 'Confirm measurement page refs' }, gmToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const det = await request('GET', `/api/billing/${billID}`, null, gmToken);
    assert.equal(det.body.bill.Status, 'ReturnedToDGM', JSON.stringify(det.body.bill));
    assert.equal(det.body.history[det.body.history.length - 1].Action, 'GM_BILL_RETURNED');
  });

  it('should re-check the bill at DGM after return', async () => {
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/billing/${billID}/check/request-otp`, {}, dgmToken));
    const m = /\[OTP\]\[DEV\] Bill Check OTP for bill \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    const res = await request('POST', `/api/billing/${billID}/check`, { otpCode: m[1] }, dgmToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'DGMChecked');
  });

  it('should check the bill at GM (L3), set ApprovedAmount, route to Finance', async () => {
    const { captured } = await captureOtpFromLog(() =>
      request('POST', `/api/billing/${billID}/check/request-otp`, {}, gmToken));
    const m = /\[OTP\]\[DEV\] Bill Check OTP for bill \S+ \(user [^)]+\): (\d{6})/.exec(captured);
    assert.ok(m, 'gm check OTP should be captured from the dev log');
    const res = await request('POST', `/api/billing/${billID}/check`, { otpCode: m[1], remarks: 'L3 ok' }, gmToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'SubmittedToFinance');
    assert.equal(res.body.bill.CurrentStep, 'FinanceClerk');
    assert.ok(res.body.bill.ApprovedAmount != null, 'ApprovedAmount should be set at GM check');
    assert.equal(Number(res.body.bill.ApprovedAmount), Number(res.body.bill.NetAmount), 'ApprovedAmount equals NetAmount');
    const det = await request('GET', `/api/billing/${billID}`, null, financeClerkToken);
    assert.ok(det.body.sla && det.body.sla.dueAt, 'billing SLA should be active after GM check');
    assert.ok(det.body.history.length >= 6, 'bill workflow history should accumulate events');
  });

  it('should create finance inward record (FinanceClerk)', async () => {
    const res = await request('POST', '/api/finance/inward', {
      BillID: billID, Amount: 100000, InwardNumber: 'FIN-GOLD-001',
    }, financeClerkToken);
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });

  it('should verify finance record (FinanceClerk)', async () => {
    const queue = await request('GET', '/api/finance?status=Inward', null, financeClerkToken);
    const item = queue.body.find(i => i.BillID == billID);
    assert.ok(item, 'inward record should exist');
    const res = await request('POST', `/api/finance/${item.FinanceID}/verify`, { Remarks: 'Verified' }, financeClerkToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('should recommend finance record (FinanceManager)', async () => {
    const queue = await request('GET', '/api/finance?status=Verification', null, financeManagerToken);
    const item = queue.body.find(i => i.BillID == billID);
    assert.ok(item, 'verification record should exist');
    const res = await request('POST', `/api/finance/${item.FinanceID}/recommend`, { Remarks: 'Recommended' }, financeManagerToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('should approve finance record (FinanceHead)', async () => {
    const queue = await request('GET', '/api/finance?status=Recommended', null, financeHeadToken);
    const item = queue.body.find(i => i.BillID == billID);
    assert.ok(item, 'recommended record should exist');
    const res = await request('POST', `/api/finance/${item.FinanceID}/approve`, { Remarks: 'Approved' }, financeHeadToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('should issue cheque (FinanceHead) and mark the bill Paid', async () => {
    const queue = await request('GET', '/api/finance?status=Approved', null, financeHeadToken);
    const item = queue.body.find(i => i.BillID == billID);
    assert.ok(item, 'approved record should exist');
    const res = await request('POST', `/api/finance/${item.FinanceID}/cheque`, {
      ChequeNumber: 'CHQ-2026-GOLDEN-001',
      ChequeDate: new Date().toISOString().slice(0, 10),
    }, financeHeadToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const bills = await request('GET', '/api/billing', null, financeHeadToken);
    const bill = bills.body.find(b => b.BillID === billID);
    assert.equal(bill.Status, 'Paid', 'bill should be marked Paid after cheque issue');
  });

  it('should expose dashboard module counts', async () => {
    const res = await request('GET', '/api/dashboard/stats', null, token);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.modules, 'dashboard stats should include modules');
    const expectedKeys = ['pendingTenders', 'agenciesAssigned', 'worksInProgress', 'billsPending', 'awardedTenders', 'billsPaid'];
    for (const k of expectedKeys) {
      assert.ok(k in res.body.modules, `modules.${k} missing`);
    }
  });

  it('should export the complete PDF', async () => {
    const res = await request('GET', `/api/exports/${estimateID}/pdf`, null, token);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.length > 1000, 'PDF should be a non-trivial binary');
  });

  it('should export the complete Excel workbook', async () => {
    const res = await request('GET', `/api/exports/${estimateID}/excel`, null, token);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.length > 1000, 'XLSX should be a non-trivial binary');
  });
});
