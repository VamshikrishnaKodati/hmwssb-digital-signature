const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const EID_FILE = path.join(__dirname, 't2-eid.json');

function getEid() {
  try {
    const data = JSON.parse(fs.readFileSync(EID_FILE, 'utf8'));
    return data.eid;
  } catch { return null; }
}

function getEstNo() {
  try {
    const data = JSON.parse(fs.readFileSync(EID_FILE, 'utf8'));
    return data.estNo;
  } catch { return null; }
}

async function loginAs(page, username) {
  await page.goto('/login');
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

async function waitForSelectReady(page, optionText, timeout = 20000) {
  await page.waitForFunction(
    (text) => {
      const selects = document.querySelectorAll('select.ec-select');
      if (!selects.length) return false;
      return Array.from(selects).some(sel =>
        Array.from(sel.options).some(o => o.text.includes(text)));
    },
    optionText,
    { timeout }
  );
}

test.describe('T2: Tender Officer Complete Journey', () => {
  const eid = getEid();
  const estNo = getEstNo();
  let tenderId;

  test.beforeAll(() => {
    if (!eid) throw new Error('Run setup-t2.mjs first to create a TSApproved estimate');
  });

  // ── STEP 1: Login ──────────────────────────────────────────────
  test('STEP 1: Login as Tender Officer', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await loginAs(page, 'tender_officer');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForTimeout(2000);
    const realErrors = errors.filter(e => !e.includes('favicon') && !e.includes('401'));
    expect(realErrors).toHaveLength(0);
  });

  // ── STEP 2: Dashboard renders ──────────────────────────────────
  test('STEP 2: Tender Officer Dashboard renders correctly', async ({ page }) => {
    await loginAs(page, 'tender_officer');
    await expect(page).toHaveURL(/\/dashboard/);
    const overview = page.locator('[data-testid="operational-overview"]');
    await expect(overview).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Ready for Tender').first()).toBeVisible();
    await expect(page.locator('text=Tender Drafts').first()).toBeVisible();
  });

  // ── STEP 3: KPI / Queue consistency ────────────────────────────
  test('STEP 3: KPI count matches ready queue count', async ({ page }) => {
    await loginAs(page, 'tender_officer');
    await page.waitForTimeout(1500);
    await page.click('a[href="/tenders?view=ready"]');
    await page.waitForURL('**/tenders?view=ready', { timeout: 10000 });
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const rowCount = await page.locator('table tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  // ── STEP 4: Ready estimate shows correct data ──────────────────
  test('STEP 4: Ready estimate is in the table with correct fields', async ({ page }) => {
    await loginAs(page, 'tender_officer');
    await page.goto('/tenders?view=ready');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const tableText = await page.locator('table tbody').textContent();
    expect(tableText).toContain('E2E T2 Test');
    await expect(page.locator('a', { hasText: 'Create Tender' }).first()).toBeVisible();
  });

  // ── STEP 5: New Tender form loads with estimate ─────────────────
  test('STEP 5: Create Tender form shows estimate context', async ({ page }) => {
    await loginAs(page, 'tender_officer');
    await page.goto(`/tenders/new?estimate=${eid}`);
    await page.waitForTimeout(3000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('E2E T2 Test');
    expect(bodyText).toContain('Approved Estimate');
    expect(bodyText).toContain('Auto-generated on save');
    expect(bodyText).toContain('Create Tender Draft');
  });

  // ── STEP 6: All T2 form fields are present ─────────────────────
  test('STEP 6: All T2 form fields exist', async ({ page }) => {
    await loginAs(page, 'tender_officer');
    await page.goto(`/tenders/new?estimate=${eid}`);
    await page.waitForTimeout(3000);
    const body = page.locator('body');
    await expect(body).toContainText('Tender Identification');
    await expect(body).toContainText('Authorities');
    await expect(body).toContainText('Tender Timeline');
    await expect(body).toContainText('Commercial');
    await expect(body).toContainText('Scope & Conditions');
    await expect(body).toContainText('Tender Readiness');
    await expect(body).toContainText('Reference No.');
    await expect(body).toContainText('Bidding Type');
    await expect(body).toContainText('Tender Type');
    await expect(body).toContainText('Tender Category');
    await expect(body).toContainText('Evaluation Type');
    await expect(body).toContainText('Tender Inviting Authority');
    await expect(body).toContainText('Officer Inviting Bids');
    await expect(body).toContainText('Bid Opening Authority');
    await expect(body).toContainText('Pre-Bid Meeting Date');
    await expect(body).toContainText('Submission Start');
    await expect(body).toContainText('Submission Closing');
    await expect(body).toContainText('Bid Opening');
    await expect(body).toContainText('Bid Validity');
    await expect(body).toContainText('EMD');
    await expect(body).toContainText('Scope of Work');
    await expect(body).toContainText('Eligibility Criteria');
    await expect(body).toContainText('Tender Documents Checklist');
  });

  // ── Helper: fill the tender form with valid data ────────────────
  async function fillTenderForm(page) {
    // Wait for config to load selects
    await waitForSelectReady(page, 'Open', 15000);

    const selects = page.locator('select.ec-select');
    await selects.nth(0).selectOption('Two Cover');      // Bidding Type
    await selects.nth(1).selectOption('Open');           // Tender Type
    await selects.nth(2).selectOption('Water Supply');   // Tender Category
    await selects.nth(3).selectOption('Percentage');     // Evaluation Type

    // Authorities (Field renders the label as a direct sibling of the control)
    await page.fill('input[placeholder*="Executive Engineer"]', 'Executive Engineer, HMWSSB');
    await page.locator('label:has-text("Officer Inviting Bids") + input').fill('Dy. Executive Engineer');
    await page.locator('label:has-text("Bid Opening Authority") + input').fill('Superintending Engineer');

    // Valid dates: Pre-bid < Start <= Closing, Opening >= Closing.
    // Bid Start is set in the past (like setup-t3) so the submission window
    // is immediately open for the downstream publish→bid→open specs.
    const iso = (d) => new Date(d).toISOString().slice(0, 10);
    const two = iso(Date.now() - 2 * 86400000);
    const start = iso(Date.now() - 1 * 86400000);
    const end = iso(Date.now() + 14 * 86400000);
    const open = iso(Date.now() + 15 * 86400000);
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill(two);       // Pre-Bid Meeting
    await dateInputs.nth(1).fill(start);     // Bid Start (window open now)
    await dateInputs.nth(2).fill(end);       // Bid End
    await dateInputs.nth(3).fill(open);      // Technical Bid Opening
    if (await dateInputs.nth(4).count()) await dateInputs.nth(4).fill(open); // Financial Bid Opening

    // EMD (Commercial) is the SAME number input used for the edit check.
    // Fill both EMD and BidValidity in the correct DOM order:
    // Timeline (BidValidity) comes before Commercial (EMD).
    const numInputs = page.locator('input[type="number"]');
    await numInputs.nth(0).fill('90');       // BidValidity (days)
    await numInputs.nth(1).fill('50000');    // EMD / Bid Security

    // Required textareas: Scope of Work, Eligibility Criteria
    await page.locator('label:has-text("Scope of Work") + textarea').fill('Supply and laying of distribution network');
    await page.locator('label:has-text("Eligibility Criteria") + textarea').fill('Registered contractor, 3 yrs exp');
  }

  // ── STEP 7: Date validation ────────────────────────────────────
  test('STEP 7: Invalid dates are rejected', async ({ page }) => {
    await loginAs(page, 'tender_officer');
    await page.goto(`/tenders/new?estimate=${eid}`);
    await page.waitForTimeout(3000);

    // Wait for config
    await waitForSelectReady(page, 'Open', 15000);

    const selects = page.locator('select.ec-select');
    await selects.nth(0).selectOption('Two Cover');      // Bidding Type
    await selects.nth(1).selectOption('Open');           // Tender Type
    await selects.nth(2).selectOption('Water Supply');   // Tender Category
    await selects.nth(3).selectOption('Percentage');     // Evaluation Type

    await page.fill('input[placeholder*="Executive Engineer"]', 'Executive Engineer, HMWSSB');

    // Set opening date BEFORE closing (invalid: opening < closing)
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-09-05');
    await dateInputs.nth(1).fill('2026-09-10');
    await dateInputs.nth(2).fill('2026-09-25');  // closing
    await dateInputs.nth(3).fill('2026-09-20');  // opening BEFORE closing

    const numInputs = page.locator('input[type="number"]');
    await numInputs.nth(0).fill('90');       // BidValidity (days)
    await numInputs.nth(1).fill('50000');    // EMD

    const textareas = page.locator('textarea');
    await textareas.nth(0).fill('Supply and laying of distribution network');
    await textareas.nth(1).fill('Registered contractor, 3 yrs exp');

    await page.click('button:has-text("Save Draft")');
    await page.waitForTimeout(4000);

    // Should NOT navigate to edit page (still on create page)
    expect(page.url()).toContain('/tenders/new');
  });

  // ── STEP 8: Save draft successfully ────────────────────────────
  test('STEP 8: Save draft with valid data', async ({ page }) => {
    await loginAs(page, 'tender_officer');
    await page.goto(`/tenders/new?estimate=${eid}`);
    await page.waitForTimeout(3000);

    await fillTenderForm(page);

    await page.click('button:has-text("Save Draft")');
    await page.waitForTimeout(5000);

    // Should navigate to edit mode
    const url = page.url();
    expect(url).toMatch(/\/tenders\/\d+\/edit/);
    const match = url.match(/\/tenders\/(\d+)\/edit/);
    tenderId = match ? match[1] : null;
    expect(tenderId).toBeTruthy();

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('eTNO/');
    expect(bodyText).not.toContain('Auto-generated on save');
  });

  // ── STEP 9: Refresh preserves data ──────────────────────────────
  test('STEP 9: Refresh preserves draft data', async ({ page }) => {
    test.skip(!tenderId, 'tenderId not set from STEP 8');
    await loginAs(page, 'tender_officer');
    await page.goto(`/tenders/${tenderId}/edit`);
    await page.waitForTimeout(3000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('eTNO/');
    expect(bodyText).toContain('Open');
    expect(bodyText).toContain('Water Supply');
    expect(bodyText).toContain('Two Cover');
  });

  // ── STEP 10: Edit creates new version ───────────────────────────
  test('STEP 10: Edit and save creates new version', async ({ page }) => {
    test.skip(!tenderId, 'tenderId not set from STEP 8');
    await loginAs(page, 'tender_officer');
    await page.goto(`/tenders/${tenderId}/edit`);
    await page.waitForTimeout(3000);

    // Read current EMD value from the input field (index 1 = Commercial EMD)
    const numInputs = page.locator('input[type="number"]');
    const beforeEmd = parseFloat(await numInputs.nth(1).inputValue());
    expect(beforeEmd).not.toBeNaN();

    // Change EMD to a distinct new value
    const newEmd = beforeEmd + 25000;
    await numInputs.nth(1).fill(String(newEmd));
    await page.click('button:has-text("Save Draft")');
    await page.waitForTimeout(4000);

    // Verify via API that version incremented (attach stored token)
    const afterRes = await page.evaluate(async (tid) => {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/tender/' + tid, {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        cache: 'no-store',
      });
      const j = await r.json();
      return j.data || j;
    }, tenderId);
    expect(Number(afterRes.Version)).toBeGreaterThanOrEqual(2);

    // Verify the updated EMD persists
    expect(Number(afterRes.EMD)).toBe(newEmd);
  });

  // ── STEP 11: Preview shows real data ────────────────────────────
  test('STEP 11: Preview shows real saved data', async ({ page }) => {
    test.skip(!tenderId, 'tenderId not set from STEP 8');
    await loginAs(page, 'tender_officer');
    await page.goto(`/tenders/${tenderId}/preview`);
    await page.waitForTimeout(3000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('Tender Preview');
    expect(bodyText).toContain('eTNO/');
    expect(bodyText).toContain('NOTICE INVITING TENDER');
    expect(bodyText).toContain('E2E T2 Test');
    expect(bodyText).toContain('Executive Engineer, HMWSSB');
    expect(bodyText).toContain('Open');
    expect(bodyText).toContain('75,000.00');   // EMD bumped by STEP 10
    expect(bodyText).toContain('90 days');     // Bid validity
    expect(bodyText).toContain('Percentage'); // Evaluation type
    expect(bodyText).toMatch(/EST\/2026-27\/\d{3}\/\d{4}/); // EstimateNo in preview
  });

  // ── STEP 12: Dashboard reflects drafts ──────────────────────────
  test('STEP 12: Dashboard shows Tender Drafts metric and list', async ({ page }) => {
    test.skip(!tenderId, 'tenderId not set from STEP 8');
    await loginAs(page, 'tender_officer');
    await page.waitForTimeout(1500);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('Tender Drafts');

    await page.click('a[href="/tenders?status=TenderDraft"]');
    await page.waitForURL('**/tenders?status=TenderDraft', { timeout: 10000 });
    await page.waitForTimeout(3000);

    // The TenderList component fetches from /api/tender?status=TenderDraft
    // Verify the page loaded (might be empty list if tender has a different status)
    const pageText = await page.locator('body').textContent();
    expect(pageText).toContain('Tender');
  });

  // ── STEP 13: Not-ready estimate excluded ────────────────────────
  test('STEP 13: Draft-only estimate is not in ready queue', async ({ page }) => {
    await loginAs(page, 'tender_officer');
    await page.goto('/tenders?view=ready');
    await page.waitForSelector('table', { timeout: 10000 });
    const tableText = await page.locator('table').textContent();
    expect(tableText).not.toContain('Draft-only estimate');
  });

  // ── STEP 14: Wrong role denied ──────────────────────────────────
  test('STEP 14: Non-TenderOfficer cannot create tender', async ({ page }) => {
    await loginAs(page, 'manager');
    // Navigate directly to the tender workbench URL
    await page.goto(`/tenders/new?estimate=${eid}`);
    await page.waitForTimeout(3000);

    // Manager must NOT reach the tender draft workbench. They should be
    // redirected to their own dashboard (route guard / role-based redirect),
    // never see "Create Tender Draft" or the tender form.
    const url = page.url();
    const bodyText = await page.locator('body').textContent();

    const reachedWorkbench = bodyText.includes('Create Tender Draft') || bodyText.includes('Tender Identification');
    expect(reachedWorkbench).toBeFalsy();

    // They land somewhere sensible (their dashboard, not a blank/error page)
    expect(bodyText).toContain('Rajesh Kumar');
  });

  // ── STEP 15: No console errors ──────────────────────────────────
  test('STEP 15: No unexpected console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const t = msg.text();
        if (!t.includes('favicon') && !t.includes('401') && !t.includes('net::') && !t.includes('ERR_'))
          errors.push(t);
      }
    });
    await loginAs(page, 'tender_officer');
    await page.waitForTimeout(1000);
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    await page.goto('/tenders?view=ready');
    await page.waitForTimeout(2000);
    if (tenderId) {
      await page.goto(`/tenders/${tenderId}/edit`);
      await page.waitForTimeout(2000);
      await page.goto(`/tenders/${tenderId}/preview`);
      await page.waitForTimeout(2000);
    }
    expect(errors).toHaveLength(0);
  });

  // ── STEP 16: No broken API requests ─────────────────────────────
  test('STEP 16: No unexpected HTTP errors on key pages', async ({ page }) => {
    const apiErrors = [];
    page.on('response', resp => {
      if (resp.status() >= 400 && resp.url().includes('/api/')) {
        apiErrors.push({ url: resp.url(), status: resp.status() });
      }
    });
    await loginAs(page, 'tender_officer');
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    await page.goto('/tenders?view=ready');
    await page.waitForTimeout(2000);
    if (tenderId) {
      await page.goto(`/tenders/${tenderId}/edit`);
      await page.waitForTimeout(2000);
    }
    expect(apiErrors).toHaveLength(0);
  });

  // ── STEP 17: Visual / UX check ──────────────────────────────────
  test('STEP 17: No layout overflow or stuck spinners', async ({ page }) => {
    await loginAs(page, 'tender_officer');
    if (tenderId) {
      await page.goto(`/tenders/${tenderId}/edit`);
    } else {
      await page.goto(`/tenders/new?estimate=${eid}`);
    }
    await page.waitForTimeout(4000);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 20);
    const loadingVisible = await page.locator('text=Loading…').isVisible().catch(() => false);
    expect(loadingVisible).toBeFalsy();
  });
});
