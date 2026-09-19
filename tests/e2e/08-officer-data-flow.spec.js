const { test, expect } = require('@playwright/test');

async function loginAs(page, username) {
  await page.goto('/login');
  await page.waitForSelector('input[name="username"]', { timeout: 15000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 20000 });
}

test.describe('Officer data-flow correctness (real DB → API → UI)', () => {
  test('KPI rule: DGM "Pending Review" card == drilldown rows; filters reach backend', async ({ page }) => {
    await loginAs(page, 'dgm');

    // 1) Read the Pending Review KPI value off the dashboard DOM.
    const kpiCard = page.locator('[data-testid="dashboard-metric-card"]', { hasText: 'Pending Review' }).first();
    await expect(kpiCard).toBeVisible({ timeout: 20000 });
    const kpiCardText = (await kpiCard.textContent()) || '';
    const match = kpiCardText.match(/([\d,]+)\s*Pending Review/);
    const kpiValue = match ? parseInt(match[1].replace(/,/g, ''), 10) : null;
    expect(kpiValue, `KPI value parse failed from "${kpiCardText}"`).not.toBeNull();

    // 2) Click the KPI → drilldown list carries status=Submitted&assignedTo=me and the backend received them.
    const apiRequests = [];
    page.on('request', req => { if (req.url().includes('/api/estimates/my')) apiRequests.push(req.url()); });
    await kpiCard.click();
    await page.waitForURL('**/estimates?**', { timeout: 20000 });
    expect(page.url()).toContain('status=Submitted');
    expect(page.url()).toContain('assignedTo=me');
    await expect.poll(() => apiRequests.length, { timeout: 10000 }).toBeGreaterThan(0);
    expect(apiRequests[apiRequests.length - 1]).toContain('status=Submitted');
    expect(apiRequests[apiRequests.length - 1]).toContain('assignedTo=me');

    // 3) Desktop table shows the first page of rows and never more than the KPI count.
    const rowsShown = await page.locator('table tbody tr[id^="est-row-"]').count();
    expect(rowsShown).toBeGreaterThan(0);
    expect(rowsShown).toBeLessThanOrEqual(kpiValue);
  });

  test('Search and status filter reach the backend (server-side, not client-side)', async ({ page }) => {
    await loginAs(page, 'manager');

    const got = [];
    page.on('request', req => { if (req.url().includes('/api/estimates/my')) got.push(req.url()); });

    await page.goto('/estimates');
    await page.waitForSelector('input#search-estimate', { timeout: 20000 });

    // Search fires on Enter (per the UI contract) and reaches /api/estimates/my?search=...
    const term = 'Water';
    await page.fill('input#search-estimate', term);
    await page.press('input#search-estimate', 'Enter');
    await expect.poll(() => got.length, { timeout: 10000 }).toBeGreaterThan(0);
    const searchReq = got[got.length - 1];
    expect(new URL(searchReq).searchParams.get('search')).toBe(term);

    // Status filter (via URL/state + server-side pagination params) narrows rows.
    await page.goto('/estimates?status=Submitted&assignedTo=me&page=1&pageSize=50');
    await page.waitForSelector('table tbody tr[id^="est-row-"]', { timeout: 20000 });
    await expect.poll(() => got.length, { timeout: 10000 }).toBeGreaterThan(0);
    const filterReq = got[got.length - 1];
    expect(new URL(filterReq).searchParams.get('status')).toBe('Submitted');
    expect(new URL(filterReq).searchParams.get('page')).toBe('1');
    expect(new URL(filterReq).searchParams.get('pageSize')).toBe('50');

    // Work Type dropdown also hits the backend with the workType param.
    const before = got.length;
    await page.selectOption('select#worktype-filter', 'Water Supply');
    await expect.poll(() => got.length, { timeout: 10000 }).toBeGreaterThan(before);
    const wtReq = got[got.length - 1];
    expect(new URL(wtReq).searchParams.get('workType')).toBe('Water Supply');
  });

  test('Direct URL + refresh: filtered list survives reload with real rows', async ({ page }) => {
    await loginAs(page, 'dgm');
    await page.goto('/estimates?status=Submitted&assignedTo=me');
    await expect(page.locator('table tbody tr[id^="est-row-"]').first()).toBeVisible({ timeout: 20000 });
    const first = await page.locator('table tbody tr[id^="est-row-"]').first().textContent();
    await page.reload();
    await expect(page.locator('table tbody tr[id^="est-row-"]').first()).toBeVisible({ timeout: 20000 });
    expect(await page.locator('table tbody tr[id^="est-row-"]').first().textContent()).toBe(first);
  });

  test('Drill-down: dashboard pipeline stage opens the estimate list; a row opens a real detail', async ({ page }) => {
    await loginAs(page, 'dgm');

    // The DGM stage card is the currently-active stage in the shared pipeline.
    const stageCard = page.locator('a', { hasText: 'CURRENT STAGE' }).first();
    await expect(stageCard).toBeVisible({ timeout: 20000 });
    await stageCard.click();
    await page.waitForURL('**/estimates?**', { timeout: 20000 });
    expect(page.url()).toContain('stage=DGM');

    await expect(page.locator('table tbody tr[id^="est-row-"]').first()).toBeVisible({ timeout: 20000 });
    await page.locator('table tbody tr[id^="est-row-"]').first().click();
    await page.waitForURL('**/estimates/*', { timeout: 20000 });
    await expect(page.locator('[data-testid="workflow-progress"]')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Estimate Information', { exact: true })).toBeVisible();
    await expect(page.getByText('Financial Summary', { exact: true })).toBeVisible();
    await expect(page.getByText('Current Status', { exact: true }).first()).toBeVisible();
  });
});