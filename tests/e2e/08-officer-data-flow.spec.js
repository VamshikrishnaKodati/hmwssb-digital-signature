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
  test('KPI rule: DGM "Pending Review" card == queue rows == drilldown list; filters reach backend', async ({ page }) => {
    await loginAs(page, 'dgm');

    // 1) Read the Pending Review KPI value off the dashboard DOM.
    const kpiCard = page.locator('[data-testid="dashboard-metric-card"]', { hasText: 'Pending Review' }).first();
    await expect(kpiCard).toBeVisible({ timeout: 20000 });
    const kpiCardText = (await kpiCard.textContent()) || '';
    const match = kpiCardText.match(/([\d,]+)\s*Pending Review/);
    const kpiValue = match ? parseInt(match[1].replace(/,/g, ''), 10) : null;
    expect(kpiValue, `KPI value parse failed from "${kpiCardText}"`).not.toBeNull();

    // 2) The dashboard's own "My Queue — Pending Review" table shows that many rows.
    const queue = page.locator('[data-testid="dashboard-queue"]').filter({ hasText: 'My Queue — Pending Review' });
    const queueRows = await queue.locator('table tbody tr').count();
    expect(queueRows).toBe(kpiValue);

    // 3) Click the KPI → drilldown list carries status=Submitted&assignedTo=me and the backend received them.
    const apiRequests = [];
    page.on('request', req => { if (req.url().includes('/api/estimates/my')) apiRequests.push(req.url()); });
    await kpiCard.click();
    await page.waitForURL('**/estimates?**', { timeout: 20000 });
    expect(page.url()).toContain('status=Submitted');
    expect(page.url()).toContain('assignedTo=me');
    await expect.poll(() => apiRequests.length, { timeout: 10000 }).toBeGreaterThan(0);
    expect(apiRequests[apiRequests.length - 1]).toContain('status=Submitted');
    expect(apiRequests[apiRequests.length - 1]).toContain('assignedTo=me');

    // 4) Desktop table rows (mobile layout is a duplicate) == KPI value, and subtitle agrees.
    await expect(page.locator('table tbody tr[id^="est-row-"]')).toHaveCount(kpiValue);
    const subtitle = await page.locator('p.ec-page-subtitle').textContent();
    expect(subtitle || '').toContain(`${kpiValue} estimate`);
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

    // Status filter also hits the backend and narrows the desktop rows.
    await page.selectOption('select#status-filter', 'Draft');
    await expect.poll(() => got.length, { timeout: 10000 }).toBeGreaterThan(0);
    const filterReq = got[got.length - 1];
    expect(new URL(filterReq).searchParams.get('status')).toBe('Draft');
    expect(new URL(filterReq).searchParams.get('search')).toBe(term);
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

  test('Drill-down: dashboard queue row opens a real estimate detail (workflow + cards)', async ({ page }) => {
    await loginAs(page, 'dgm');
    const queue = page.locator('[data-testid="dashboard-queue"]').filter({ hasText: 'My Queue — Pending Review' });
    const firstRow = queue.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 20000 });
    await firstRow.click();
    await page.waitForURL('**/estimates/*', { timeout: 20000 });
    await expect(page.locator('[data-testid="workflow-progress"]')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Estimate Information', { exact: true })).toBeVisible();
    await expect(page.getByText('Financial Summary', { exact: true })).toBeVisible();
    await expect(page.getByText('Current Status', { exact: true }).first()).toBeVisible();
  });
});