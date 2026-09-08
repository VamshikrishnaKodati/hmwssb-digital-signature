const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const TENDER_FILE = path.join(__dirname, 't3-tender.json');

function getTender() {
  try { return JSON.parse(fs.readFileSync(TENDER_FILE, 'utf8')); } catch { return null; }
}

async function loginAs(page, username) {
  await page.goto('/login');
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

const getStatus = async (page, tid) => page.evaluate(async (t) => {
  const token = localStorage.getItem('token');
  const r = await fetch(`/api/tender/${t}`, { headers: { Authorization: 'Bearer ' + token } });
  const j = await r.json();
  return (j.data || j).effectiveStatus || (j.data || j).Status;
}, tid);

const T = getTender();
const TENDER_ID = T?.tenderId;

test.describe('T3: Director award → work order → agreement (canonical pipeline)', () => {
  test.beforeAll(() => {
    if (!TENDER_ID) throw new Error('Run setup-t3.cjs first (needs t3-tender.json)');
  });

  test('STEP 1: Director sees L1 + Award action on the tender detail', async ({ page }) => {
    await loginAs(page, 'director_admin');
    const status = await getStatus(page, TENDER_ID);
    if (status !== 'L1Identified') {
      // Nothing to award yet — replay the prior spec first (03-tender-bid).
      console.log(`<<SKIP>> tender is ${status}, expected L1Identified (run 03-tender-bid.spec.js first)`);
      test.skip();
      return;
    }
    await page.goto(`/tenders/${TENDER_ID}`);
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toContainText('L1 identified');
    await expect(page.locator('button:has-text("Award Work")')).toBeVisible();
  });

  test('STEP 2: Director awards to the L1 bidder → WorkAwarded', async ({ page }) => {
    await loginAs(page, 'director_admin');
    const status = await getStatus(page, TENDER_ID);
    if (status !== 'L1Identified') { console.log(`<<SKIP>> status ${status} (not L1Identified)`); test.skip(); return; }

    await page.goto(`/tenders/${TENDER_ID}`);
    await page.waitForTimeout(3000);
    page.on('dialog', d => d.accept());
    await page.locator('button:has-text("Award Work")').click();
    await page.waitForTimeout(3000);

    const next = await getStatus(page, TENDER_ID);
    expect(['WorkAwarded', 'WorkOrderIssued', 'AgreementExecuted']).toContain(next);
    await expect(page.locator('body')).toContainText('Post-Award');
  });

  test('STEP 3: Director issues the work order → WorkOrderIssued', async ({ page }) => {
    await loginAs(page, 'director_admin');
    const status = await getStatus(page, TENDER_ID);
    if (status === 'L1Identified') { console.log(`<<SKIP>> award not yet done (STEP 2)`); test.skip(); return; }

    await page.goto(`/tenders/${TENDER_ID}`);
    await page.waitForTimeout(3000);
    const woBtn = page.locator('button:has-text("Issue Work Order")');
    if (await woBtn.isVisible().catch(() => false)) {
      await page.fill('input[value=""]', 'WO-E2E-' + Date.now());
      await woBtn.click();
      await page.waitForTimeout(2500);
    }
    const next = await getStatus(page, TENDER_ID);
    expect(['WorkOrderIssued', 'AgreementExecuted']).toContain(next);
  });

  test('STEP 4: Director records the agreement → AgreementExecuted', async ({ page }) => {
    await loginAs(page, 'director_admin');
    const status = await getStatus(page, TENDER_ID);
    if (['L1Identified', 'WorkAwarded'].includes(status)) { console.log(`<<SKIP>> earlier steps not done`); test.skip(); return; }

    await page.goto(`/tenders/${TENDER_ID}`);
    await page.waitForTimeout(3000);
    const agBtn = page.locator('button:has-text("Record Agreement")');
    if (await agBtn.isVisible().catch(() => false)) {
      await page.fill('input[value=""]', 'AG-E2E-' + Date.now());
      await agBtn.click();
      await page.waitForTimeout(2500);
    }
    const next = await getStatus(page, TENDER_ID);
    expect(next).toBe('AgreementExecuted');
    await expect(page.locator('body')).toContainText('Agreement');
  });

  test('STEP 5: Director dashboard shows the award pipeline KPIs', async ({ page }) => {
    await loginAs(page, 'director_admin');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent();
    expect(body).toContain('Tender Award Pipeline');
    expect(body).toContain('Awards Pending');
    expect(body).toContain('Agreements Executed');
  });
});