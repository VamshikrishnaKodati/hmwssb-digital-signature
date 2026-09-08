const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { loginAs, readOtp, clearOtps, configureTender } = require('./helpers');

const API_LOG = path.join(os.tmpdir(), 'opencode', 'api-out.log');

// Billing OTPs are console-only ([OTP][DEV] Bill ... line in api-out.log), so
// tail that file for the latest matching code instead of dev-otp.json.
async function readConsoleOtp(billIdent, timeoutMs = 12000) {
  const bytesBefore = (() => { try { return fs.statSync(API_LOG).size; } catch { return 0; } })();
  const deadline = Date.now() + timeoutMs;
  let lastOffset = bytesBefore;
  while (Date.now() < deadline) {
    try {
      const size = fs.statSync(API_LOG).size;
      if (size > lastOffset) {
        const fd = fs.openSync(API_LOG, 'r');
        const buf = Buffer.alloc(size - lastOffset);
        fs.readSync(fd, buf, 0, buf.length, lastOffset);
        fs.closeSync(fd);
        lastOffset = size;
        const data = buf.toString('utf8');
        const lines = data.split('\n').filter(l => l.includes('[OTP][DEV] Bill') && l.includes(billIdent));
        if (lines.length) {
          const m = lines[lines.length - 1].match(/:\s*(\d{4,8})\s*$/);
          if (m) return m[1];
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 400));
  }
  return null;
}

// Bill OTP modal step: open modal via testid, request OTP, fill digits, verify.
async function billOtpAction(page, billIdent, { openTestId }) {
  await page.locator(`[data-testid="${openTestId}"]`).first().click();
  await page.waitForTimeout(700);
  await page.locator('button:has-text("Send OTP")').first().click();
  await page.waitForTimeout(1500);
  const code = await readConsoleOtp(billIdent);
  if (!code) throw new Error('Bill OTP not captured for ' + billIdent);
  const digits = String(code);
  const inputs = page.locator('input[inputmode="numeric"]');
  for (let i = 0; i < 6 && i < digits.length; i++) await inputs.nth(i).fill(digits[i]);
  await page.locator('[data-testid="otp-verify"]').first().click();
  await page.waitForTimeout(3500);
}

// Wait for a specific option (by value) to appear in a select, then select it.
async function selectOptionByValue(page, selectId, value, timeoutMs = 20000) {
  const opt = page.locator(`#${selectId} option[value="${value}"]`);
  await opt.waitFor({ state: 'attached', timeout: timeoutMs });
  await page.locator(`#${selectId}`).selectOption(value);
}

// GOLDEN LIFECYCLE — one real estimate driven by the browser through the full
// canonical chain: Manager draft → DGM/GM/CGM/DOP/ED/MD approvals → Director
// FCN/AdminSanction/TS → Tender → Bid Open → Eval → Award → WO → Agreement →
// SiteEngineer Start/Progress/Measurement/Complete → BillingOfficer bill →
// Manager/DGM/GM check → Finance Clerk Inward → Manager Verify → Head
// Approve/Cheque. State is shared across serial tests via module vars.

let EID;       // estimate id
let EST_NO;    // estimate number
let TID;       // tender id
let AID;       // agency id
let BILL_ID;   // billing id

const OTP_EST_ERR = (purpose, estNo) => `OTP not captured for ${estNo || '?'} ${purpose}`;

async function apiStatus(page, path, query = '') {
  return await page.evaluate(async ({ path, query }) => {
    const token = localStorage.getItem('token');
    const r = await fetch(`/api/${path}${query}`, { headers: { Authorization: 'Bearer ' + token } });
    const j = await r.json().catch(() => ({}));
    const d = j.data || j;
    return (d && (d.effectiveStatus || d.Status)) || null;
  }, { path, query });
}

async function waitForStatus(page, path, expected, tries = 20, query = '') {
  for (let i = 0; i < tries; i++) {
    const s = await apiStatus(page, path, query);
    if (expected.includes(s)) return s;
    await page.waitForTimeout(800);
  }
  const got = await apiStatus(page, path, query);
  throw new Error(`Status never became ${JSON.stringify(expected)} (got ${got}) for ${path}`);
}

// OTP flow for an estimate detail modal. Clicks the action button, then the
// prompt's "Send OTP", fills the numeric inputs, clicks the verify button.
async function estOtpAction(page, purpose, { actionBtn, sendBtn = 'Send OTP', verifyBtn }) {
  await clearOtps();
  await page.locator(`button:has-text("${actionBtn}")`).first().click();
  await page.waitForTimeout(700);
  await page.locator(`button:has-text("${sendBtn}")`).first().click();
  await page.waitForTimeout(1200);
  const code = await readOtp(EST_NO, purpose, 10000);
  if (!code) throw new Error(OTP_EST_ERR(purpose, EST_NO));
  const digits = String(code);
  const inputs = page.locator('input[inputmode="numeric"]');
  const count = await inputs.count();
  for (let i = 0; i < count && i < 6 && i < digits.length; i++) await inputs.nth(i).fill(digits[i]);
  await page.locator(`button:has-text("${verifyBtn}")`).first().click();
  await page.waitForTimeout(4000);
}

// In-app confirm modal: opens after clicking the action button. Optionally
// fills required fields (admin sanction Sanction No, assign-ts authority) then
// clicks the modal's "Confirm" button.
async function confirmModal(page, actionBtn, { sanctionNo } = {}, extra) {
  await page.locator(`button:has-text("${actionBtn}")`).first().click();
  await page.waitForTimeout(700);
  if (sanctionNo) {
    await page.locator('#procurementNo').fill(sanctionNo);
    await page.waitForTimeout(200);
  }
  if (extra && extra.tsAuthority) {
    await page.locator('#tsAuthority').selectOption(extra.tsAuthority);
    await page.waitForTimeout(200);
  }
  await page.locator('button:has-text("Confirm")').last().click();
  await page.waitForTimeout(3500);
}

test.describe('GOLDEN LIFECYCLE: full canonical officer chain (browser E2E)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon') && !m.text().includes('401')) console.log('CONSOLE_ERR:', m.text()); });
  });

  test('STEP 1: Manager creates estimate with one item and submits to DGM', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/estimates/new');
    await page.waitForSelector('textarea', { timeout: 20000 });

    // Location: Corp -> Zone -> Division -> Circle -> Ward (matching select)
    const loc = page.locator('#loc-region');
    await loc.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await page.locator('#loc-zone').selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await page.locator('#loc-division').selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await page.locator('#loc-circle').selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await page.locator('#loc-ward').selectOption({ index: 1 });
    await page.waitForTimeout(400);

    // Work details
    await page.locator('#work-category').selectOption({ index: 1 });
    await page.locator('#name-of-work').fill('Golden Lifecycle E2E ' + Date.now());

    // Item row: the new-estimate form seeds one draft row with a search box.
    const searchInput = page.locator('input.ec-search-row-input').first();
    await searchInput.fill('water');
    await page.waitForTimeout(1200);
    const result = page.locator('[data-result-index="0"]').first();
    await result.click();
    await page.waitForTimeout(500);

    // Provide a quantity (N) on the row so the estimate totals > 0.
    const qtyInput = page.locator('input.ec-dim-input').first();
    if (await qtyInput.isVisible()) await qtyInput.fill('100');

    // Save
    await page.locator('button:has-text("Save")').first().click();
    await page.waitForTimeout(3000);

    // Capture EstimateNo from the page header (regenerate pattern EST/fy/ward/seq)
    const body = await page.locator('body').textContent();
    const m = body.match(/EST\/\d{4}-\d{2}\/[^/]+\/\d+/i);
    EST_NO = m ? m[0] : null;
    expect(EST_NO).toBeTruthy();
    // resolve estimate id via API
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const res = await page.evaluate(async ({ token, estNo }) => {
      const r = await fetch('/api/estimates?limit=500', { headers: { Authorization: 'Bearer ' + token } });
      const j = await r.json();
      return (j.data || j).find(e => e.EstimateNo === estNo);
    }, { token, estNo: EST_NO });
    expect(res && res.EstimateID).toBeTruthy();
    EID = res.EstimateID;
    console.log('GOLDEN Estimate', EST_NO, 'id', EID);
  });

  test('STEP 1b: Manager submits estimate to DGM (OTP)', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto(`/estimates/${EID}`);
    await page.waitForTimeout(2000);
    await estOtpAction(page, 'submission', { actionBtn: 'Submit to DGM', sendBtn: 'Send OTP to Submit', verifyBtn: 'Verify & Submit' });
    await waitForStatus(page, `estimates/${EID}`, ['Submitted']);
    await expect(page.locator('body')).toContainText('Submitted');
  });

  test('STEP 2: DGM approves -> GM', async ({ page }) => {
    await loginAs(page, 'dgm');
    await page.goto(`/estimates/${EID}`);
    await page.waitForTimeout(2000);
    await estOtpAction(page, 'dgm_approve', { actionBtn: 'Forward to GM', verifyBtn: 'Verify & Approve' });
    await waitForStatus(page, `estimates/${EID}`, ['DGM_Approved']);
  });

  test('STEP 3: GM reviews and forwards to CGM', async ({ page }) => {
    await loginAs(page, 'gm');
    await page.goto(`/estimates/${EID}`);
    await page.waitForTimeout(2000);
    await estOtpAction(page, 'signature', { actionBtn: 'Recommend to CGM', sendBtn: 'Digital Sign', verifyBtn: 'Verify OTP' });
    await waitForStatus(page, `estimates/${EID}`, ['GM_Recommended']);
  });

  test('STEP 4: CGM submits to DOP', async ({ page }) => {
    await loginAs(page, 'cgm');
    await page.goto(`/estimates/${EID}`);
    await page.waitForTimeout(2000);
    await estOtpAction(page, 'cgm_submit', { actionBtn: 'Forward to DOP', verifyBtn: 'Verify & Submit' });
    await waitForStatus(page, `estimates/${EID}`, ['CGM_Submitted']);
  });

  test('STEP 5: DOP approves -> ED', async ({ page }) => {
    await loginAs(page, 'dop');
    await page.goto(`/estimates/${EID}`);
    await page.waitForTimeout(2000);
    await estOtpAction(page, 'dop_approve', { actionBtn: 'Approve & Forward to ED', verifyBtn: 'Verify & Approve' });
    await waitForStatus(page, `estimates/${EID}`, ['DOP_Approved']);
  });

  test('STEP 6: ED approves -> MD', async ({ page }) => {
    await loginAs(page, 'ed');
    await page.goto(`/estimates/${EID}`);
    await page.waitForTimeout(2000);
    await estOtpAction(page, 'ed_approve', { actionBtn: 'Approve & Forward to MD', verifyBtn: 'Verify & Approve' });
    await waitForStatus(page, `estimates/${EID}`, ['ED_Approved']);
  });

  test('STEP 7: MD final approves', async ({ page }) => {
    await loginAs(page, 'md');
    await page.goto(`/estimates/${EID}`);
    await page.waitForTimeout(2000);
    await estOtpAction(page, 'md_final', { actionBtn: 'Final Approve', sendBtn: 'Send OTP for Final Approval', verifyBtn: 'Verify & Final Approve' });
    await waitForStatus(page, `estimates/${EID}`, ['FinalApproved']);
  });

  test('STEP 8: Director generates FCN', async ({ page }) => {
    await loginAs(page, 'director_admin');
    await page.goto(`/estimates/${EID}`);
    await page.waitForTimeout(2000);
    await confirmModal(page, 'Generate FCN');
    await waitForStatus(page, `estimates/${EID}`, ['FCNGenerated']);
  });

  test('STEP 9: Director generates Admin Sanction', async ({ page }) => {
    await loginAs(page, 'director_admin');
    await page.goto(`/estimates/${EID}`);
    await page.waitForTimeout(2000);
    await confirmModal(page, 'Generate Admin Sanction', { sanctionNo: 'AS/2026-27/001' });
    await waitForStatus(page, `estimates/${EID}`, ['AdminSanctionGenerated']);
  });

  test('STEP 10: GM assigned as TS authority approves TS', async ({ page }) => {
    // Assign the TS authority (GM) via the confirm modal, then GM approves.
    await loginAs(page, 'director_admin');
    await page.goto(`/estimates/${EID}`);
    await page.waitForTimeout(2000);
    await confirmModal(page, 'Assign TS Authority', {}, { tsAuthority: 'GM' });
    await waitForStatus(page, `estimates/${EID}`, ['TSPending', 'AdminSanctionGenerated']);
    await page.screenshot({ path: 'test-results/step10-assign-ts.png' });

    // Clear auth so the next login actually shows the login form.
    await page.evaluate(() => localStorage.clear());
    await loginAs(page, 'gm');
    await page.goto(`/estimates/${EID}`);
    await page.waitForTimeout(2000);
    await confirmModal(page, 'Forward for TS');
    await waitForStatus(page, `estimates/${EID}`, ['TSApproved']);
    await page.screenshot({ path: 'test-results/step10-ts-approved.png' });
  });

  test('STEP 11: Tender Officer publishes auto-created tender & opens bids', async ({ page }) => {
    await loginAs(page, 'tender_officer');

    // MD final approval auto-created a 'Draft' tender; look it up via API.
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const tr = await page.evaluate(async ({ token, eid }) => {
      const r = await fetch(`/api/tender?estimateId=${eid}`, { headers: { Authorization: 'Bearer ' + token } });
      const j = await r.json();
      const arr = j.data || j;
      return Array.isArray(arr) ? (arr[0] ? arr[0].TenderID : null) : null;
    }, { token, eid: EID });
    expect(tr).toBeTruthy();
    TID = tr;
    console.log('GOLDEN Tender id', TID);

    // Complete the auto-created draft via the real TenderForm (fills all mandatory
    // fields and promotes 'Draft' -> 'TenderDraft'), then publish from the detail view.
    const tidAfterConfig = await configureTender(page, EID);
    expect(tidAfterConfig).toBeTruthy();
    expect(tidAfterConfig).toBe(TID);
    TID = tidAfterConfig;

    await page.goto(`/tenders/${TID}`);
    await page.waitForTimeout(2500);
    await page.locator('button:has-text("Publish Tender")').click();
    await page.waitForTimeout(600);
    await page.locator('button:has-text("Confirm Publish")').click();
    await page.waitForTimeout(3000);

    // Submit a bid via API (time-window safe), then open + complete.
    const bidRes = await page.evaluate(async ({ token, tid }) => {
      const r = await fetch(`/api/bids/tender/${tid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          ContractorName: 'Golden Civil Works LLP',
          ContractorGSTIN: 'GST' + Date.now(),
          FinancialBidAmount: 800000,
          TechnicalBid: 'Qualified contractor with 10 years experience',
          Documents: [{ Category: 'Technical', DocumentName: 'Bid security', FilePath: 'uploads/tech.pdf' }],
        }),
      });
      return r.status;
    }, { token, tid: TID });
    expect(bidRes).toBe(201);

    await page.goto(`/tenders/${TID}`);
    await page.waitForTimeout(2000);
    // Close the submission window (BidEndDate is in the future) before opening bids.
    page.on('dialog', d => d.accept());
    const closeBtn = page.locator('button:has-text("Close Submission")');
    if (await closeBtn.isVisible().catch(() => false)) { await closeBtn.click(); await page.waitForTimeout(2500); }
    await waitForStatus(page, `tender/${TID}`, ['BidsClosed']);
    await page.goto(`/tenders/${TID}`);
    await page.waitForTimeout(2000);
    const startBtn = page.locator('button:has-text("Start Bid Opening")');
    if (await startBtn.isVisible().catch(() => false)) { await startBtn.click(); await page.waitForTimeout(2500); }
    const openBtn = page.locator('button:has-text("Open Bid")').first();
    if (await openBtn.isVisible().catch(() => false)) { await openBtn.click(); await page.waitForTimeout(2500); }
    const completeBtn = page.locator('button:has-text("Complete Bid Opening")');
    if (await completeBtn.isVisible().catch(() => false)) { await completeBtn.click(); await page.waitForTimeout(3000); }
    await waitForStatus(page, `tender/${TID}`, ['TechnicalEvaluationPending']);
  });

  test('STEP 12: Tender Officer tech + fin eval, L1 identified', async ({ page }) => {
    await loginAs(page, 'tender_officer');
    await page.goto(`/tenders/${TID}`);
    await page.waitForTimeout(2000);
    const qualifyBtn = page.getByRole('button', { name: 'Qualify', exact: true });
    if (await qualifyBtn.isVisible().catch(() => false)) {
      for (let i = 0; i < 5; i++) {
        if (!(await qualifyBtn.isVisible().catch(() => false))) break;
        await qualifyBtn.click();
        await page.waitForTimeout(1500);
      }
    }
    const finBtn = page.locator('button:has-text("Run Financial Evaluation")');
    if (await finBtn.isVisible().catch(() => false)) { await finBtn.click(); await page.waitForTimeout(3000); }
    const l1Btn = page.locator('button:has-text("Identify L1")');
    if (await l1Btn.isVisible().catch(() => false)) { page.on('dialog', d => d.accept()); await l1Btn.click(); await page.waitForTimeout(3000); }
    await waitForStatus(page, `tender/${TID}`, ['L1Identified', 'WorkAwarded']);
  });

  test('STEP 13: Director awards & issues WO & records agreement', async ({ page }) => {
    await loginAs(page, 'director_admin');
    await page.goto(`/tenders/${TID}`);
    await page.waitForTimeout(2000);
    page.on('dialog', d => d.accept());
    const awardBtn = page.locator('button:has-text("Award Work")');
    if (await awardBtn.isVisible().catch(() => false)) { await awardBtn.click(); await page.waitForTimeout(3000); }
    // Issue Work Order (required input first)
    const woBtn = page.locator('button:has-text("Issue Work Order")');
    if (await woBtn.isVisible().catch(() => false)) {
      await page.locator('.ec-form-group', { has: page.locator('label', { hasText: 'Work Order No' }) })
        .locator('input').fill('WO-' + Date.now());
      await woBtn.click();
      await page.waitForTimeout(3000);
    }
    // Record Agreement (required input first)
    page.on('dialog', d => d.accept());
    const agBtn = page.locator('button:has-text("Record Agreement")');
    if (await agBtn.isVisible().catch(() => false)) {
      await page.locator('.ec-form-group', { has: page.locator('label', { hasText: 'Agreement No' }) })
        .locator('input').fill('AG-' + Date.now());
      await agBtn.click();
      await page.waitForTimeout(3000);
    }
    await waitForStatus(page, `tender/${TID}`, ['AgreementExecuted']);

    // Award auto-creates the agency; if it already exists (409), reuse it.
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const ar = await page.evaluate(async ({ token, tid, eid }) => {
      const r = await fetch('/api/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ EstimateID: eid, TenderID: tid, AgencyName: 'Golden Civil Works LLP' }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 201) return { status: r.status, AID: (j.data || j).AgencyID };
      if (r.status === 409) {
        const g = await fetch('/api/agency?tenderId=' + tid, { headers: { Authorization: 'Bearer ' + token } });
        const gj = await g.json().catch(() => ({}));
        const rows = gj.data || gj;
        const row = (Array.isArray(rows) ? rows : []).find(a => a.TenderID == tid);
        return { status: r.status, AID: row ? row.AgencyID : null };
      }
      return { status: r.status, AID: null };
    }, { token, tid: TID, eid: EID });
    console.log('GOLDEN createAgency', ar.status, 'AID', ar.AID);
    expect(ar.status === 201 || ar.status === 409).toBe(true);
    AID = ar.AID || null;
    expect(AID).toBeTruthy();
  });

  test('STEP 14: SiteEngineer starts work, records progress + measurement, completes', async ({ page }) => {
    await loginAs(page, 'site_engineer');
    await page.goto(`/estimates/${EID}`);
    await page.waitForTimeout(2000);
    const startBtn = page.locator('button:has-text("Start Work")');
    if (await startBtn.isVisible().catch(() => false)) { await startBtn.click(); await page.waitForTimeout(3000); }

    // Progress
    await page.goto(`/progress`);
    await page.waitForTimeout(1500);
    await page.locator('button:has-text("Add Progress")').first().click();
    await page.waitForTimeout(600);
    await selectOptionByValue(page, 'EstimateID', String(EID)).catch(() => {});
    await page.locator('#Percentage').selectOption({ label: '50%' }).catch(() => {});
    await page.locator('#Date').fill('2026-09-07');
    await page.locator('button:has-text("Save")').first().click();
    await page.waitForTimeout(2500);

    // Measurement
    await page.goto(`/measurements`);
    await page.waitForTimeout(1500);
    const addMeas = page.locator('button:has-text("Record Measurement")').first();
    if (await addMeas.isVisible()) { await addMeas.click(); await page.waitForTimeout(500); }
    await selectOptionByValue(page, 'EstimateID', String(EID)).catch(() => {});
    await page.waitForTimeout(600);
    await page.locator('#CurrentQty').fill('150');
    await page.locator('#MeasuredDate').fill('2026-09-07');
    await page.locator('button:has-text("Save")').first().click();
    await page.waitForTimeout(2500);

    // Complete work
    await page.goto(`/estimates/${EID}`);
    await page.waitForTimeout(1500);
    const completeBtn = page.locator('button:has-text("Complete Work")');
    if (await completeBtn.isVisible().catch(() => false)) { await completeBtn.click(); await page.waitForTimeout(3000); }
    await waitForStatus(page, `estimates/${EID}`, ['WorkCompleted'], 25);
  });

  test('STEP 15: BillingOfficer creates a bill and submits to Manager', async ({ page }) => {
    await loginAs(page, 'billing_officer');
    await page.goto('/billing');
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Add Bill")').first().click();
    await page.waitForTimeout(800);
    const billEstGroup = page.locator('.ec-form-group', { has: page.locator('label', { hasText: 'Estimate' }) }).first();
    await billEstGroup.locator(`select option[value="${EID}"]`).waitFor({ state: 'attached', timeout: 20000 });
    await billEstGroup.locator('select').selectOption(String(EID));
    await page.waitForTimeout(800);
    await page.locator('[data-testid="bill-save"]').first().click();
    await page.waitForTimeout(2500);

    // find the bill id
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const br = await page.evaluate(async ({ token, eid }) => {
      const r = await fetch('/api/billing', { headers: { Authorization: 'Bearer ' + token } });
      const j = await r.json();
      const arr = j.data || j;
      const bill = (Array.isArray(arr) ? arr : []).filter(b => b.EstimateID == eid)[0];
      return bill ? bill.BillID || bill.id : null;
    }, { token, eid: EID });
    BILL_ID = br;
    console.log('GOLDEN Bill id', BILL_ID);
    expect(BILL_ID).toBeTruthy();

    // Submit the bill (biller OTP — console-only)
    await page.goto(`/billing/${BILL_ID}`);
    await page.waitForTimeout(2000);
    await billOtpAction(page, String(BILL_ID), { openTestId: 'bill-submit' });
  });

  test('STEP 16: Manager -> DGM -> GM check bill to finance', async ({ page }) => {
    const checkers = [
      ['manager'],
      ['dgm'],
      ['gm'],
    ];
    for (const [who] of checkers) {
      await loginAs(page, who);
      await page.goto(`/billing/${BILL_ID}`);
      await page.waitForTimeout(1500);
      const checkBtn = page.locator('[data-testid="bill-check"]');
      if (await checkBtn.isVisible().catch(() => false)) {
        await billOtpAction(page, String(BILL_ID), { openTestId: 'bill-check' });
      }
      await page.waitForTimeout(1500);
    }
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const st = await page.evaluate(async ({ token, id }) => {
      const r = await fetch('/api/billing/' + id, { headers: { Authorization: 'Bearer ' + token } });
      const j = await r.json();
      return ((j.bill) && j.bill.Status) || ((j.data || j).Status) || null;
    }, { token, id: BILL_ID });
    console.log('GOLDEN bill final status', st);
    expect(['SubmittedToFinance', 'Finance', 'ChequeIssued', 'Inward', 'SubmittedToManager']).toContain(st);
  });

  test('STEP 17: Finance clerk inward+verify, manager recommend, head approve+cheque', async ({ page }) => {
    // Clerk: record inward (per-row button opens modal), then verify.
    await loginAs(page, 'finance_clerk');
    await page.goto('/finance');
    await page.waitForTimeout(2500);
    const inwardBtn = page.locator('[data-testid="record-inward"]').first();
    if (await inwardBtn.isVisible().catch(() => false)) {
      await inwardBtn.click();
      await page.waitForTimeout(600);
      const modal = page.locator('h3:has-text("Record Inward")').locator('..').locator('..');
      await modal.locator('input[type="number"]').first().fill(String(BILL_ID));
      // amount already prefilled; inward number + submit
      await modal.locator('input[type="text"]').fill('IN-' + Date.now());
      await modal.locator('button[type="submit"]').click();
      await page.waitForTimeout(2500);
    }
    await page.locator('button:has-text("Verify")').first().click();
    await page.waitForTimeout(2000);

    // Manager: recommend
    await loginAs(page, 'finance_manager');
    await page.goto('/finance');
    await page.waitForTimeout(2500);
    await page.locator('button:has-text("Recommend")').first().click();
    await page.waitForTimeout(2000);

    // Head: approve then issue cheque
    await loginAs(page, 'finance_head');
    await page.goto('/finance');
    await page.waitForTimeout(2500);
    await page.locator('button:has-text("Approve")').first().click();
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Issue Cheque")').first().click();
    await page.waitForTimeout(600);
    const chequeModal = page.locator('h3:has-text("Issue Cheque")').locator('..').locator('..');
    await chequeModal.locator('input[type="text"]').first().fill('CHQ-' + Date.now());
    await chequeModal.locator('input[type="date"]').fill('2026-09-07');
    await chequeModal.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);

    const token = await page.evaluate(() => localStorage.getItem('token'));
    const st = await page.evaluate(async ({ token, id }) => {
      const r = await fetch('/api/finance?billId=' + id, { headers: { Authorization: 'Bearer ' + token } });
      const j = await r.json().catch(() => ({}));
      const arr = j.data || j;
      const row = (Array.isArray(arr) ? arr : []).find(x => x.BillID == id);
      return row ? row.Status : null;
    }, { token, id: BILL_ID });
    console.log('GOLDEN FINANCE final status', st);
    expect(st).toBe('ChequeIssued');
  });
});
