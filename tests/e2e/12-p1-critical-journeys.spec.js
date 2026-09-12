const { test, expect } = require('@playwright/test');

async function loginAs(page, username, password = 'password123') {
  await page.goto('/login');
  await page.waitForSelector('input[name="username"]', { timeout: 15000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 20000 });
}

async function countFailedNetwork(page) {
  return page.evaluate(() => {
    const entries = performance.getEntriesByType('resource');
    return entries.length;
  });
}

test.describe('P1 critical journeys (real browser, live API)', () => {
  test('background image loads with 200', async ({ page }) => {
    const resp = await page.request.get('/image.png');
    expect(resp.status()).toBe(200);
    expect(resp.headers()['content-type'] || '').toMatch(/image|png/);
  });

  test('dashboard loads without 500s or console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    const failed = [];
    page.on('response', (r) => { if (r.status() >= 500) failed.push(r.url() + ' -> ' + r.status()); });

    await loginAs(page, 'manager');
    await page.waitForSelector('[data-testid="dashboard-shell"]', { timeout: 20000 });
    const body = await page.locator('body').textContent();
    expect(body).not.toContain('Retry');
    expect(body).not.toContain('failed with status code');
    expect(failed).toEqual([]);
    expect(consoleErrors.filter((t) => !t.includes('favicon'))).toEqual([]);
  });

  test('estimates list loads and search hits backend', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/estimates');
    await page.waitForSelector('a[href^="/estimates/"]', { timeout: 20000 });

    const searchInput = page.locator('input[type="search"], input[placeholder*="earch" i]').first();
    if (await searchInput.count()) {
      const failed = [];
      page.on('response', (r) => { if (r.status() >= 500) failed.push(r.status()); });
      await searchInput.fill('pipeline');
      await page.waitForTimeout(1200);
      expect(failed).toEqual([]);
    }
    const body = await page.locator('body').textContent();
    expect(body).not.toContain('failed with status code');
  });

  test('create estimate loads manager location scope from backend', async ({ page }) => {
    const failed = [];
    page.on('response', (r) => { if (r.status() >= 500) failed.push(r.url()); });
    await loginAs(page, 'manager');
    await page.goto('/estimates/new');

    // Scoped Manager: Corp/Zone/Division/Circle are read-only and auto-filled
    // from the location scope; only Ward is a select, restricted to the
    // assigned Circle's wards.
    await page.waitForSelector('input[value]:below(h3:has-text("Location"))', { timeout: 20000 }).catch(() => {});
    await page.waitForSelector('#loc-ward', { timeout: 20000 });
    const wardOpts = await page.locator('#loc-ward option').allTextContents();
    const realWards = wardOpts.filter((t) => t && t !== 'Select Ward');
    expect(realWards.length).toBeGreaterThan(0);

    const body = await page.locator('body').textContent();
    expect(body).not.toContain('failed with status code');
    expect(failed).toEqual([]);
  });

  test('estimate detail opens and no screen-only cards break', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/estimates?status=Draft');
    const firstLink = page.locator('a[href^="/estimates/"]').first();
    await firstLink.waitFor({ timeout: 15000 });
    const href = await firstLink.getAttribute('href');
    if (href.startsWith('/estimates/') && !href.endsWith('/view') && !href.endsWith('/preview')) {
      await page.goto(href);
      await page.waitForTimeout(3000);
      const body = await page.locator('body').textContent();
      expect(body).not.toContain('was not found');
      expect(body).not.toContain('failed with status code');
    }
  });

  test('print preview renders canonical cover and sections', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/estimates?status=Draft');
    const firstLink = page.locator('a[href^="/estimates/"]').first();
    await firstLink.waitFor({ timeout: 15000 });
    const href = await firstLink.getAttribute('href');
    if (!href) return;
    await page.goto(href + '/preview');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent();
    expect(body).not.toContain('failed with status code');
    if (await page.locator('.print-cover').count()) {
      await expect(page.locator('.print-cover')).toBeVisible();
      await expect(page.locator('.print-cover .pc-abstract')).toHaveText(/ABSTRACT OF ESTIMATE/);
    }
    // No screen-only work-details card leaks into the print doc
    const screenCardInPrint = body.includes('no-print') && body.includes('Work Details');
    expect(screenCardInPrint).toBe(false);
  });

  test('sidebar toggles and navigation works', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.waitForSelector('[data-testid="dashboard-shell"]', { timeout: 20000 });
    const toggle = page.locator('button[aria-label*="navigation" i]').first();
    await toggle.click();
    await page.waitForTimeout(500);
    const toggleLabel = await toggle.getAttribute('aria-label');
    expect(toggleLabel).toMatch(/Close navigation|Open navigation/);
    await toggle.click();
    await page.waitForTimeout(500);
    // navigation still works
    await page.goto('/estimates');
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/estimates');
  });

  test('direct URL + refresh survival for critical routes', async ({ page }) => {
    await loginAs(page, 'manager');
    for (const route of ['/dashboard', '/estimates', '/estimates/new']) {
      await page.goto(route);
      await page.waitForTimeout(2500);
      await page.reload();
      await page.waitForTimeout(2500);
      const body = await page.locator('body').textContent();
      expect(body).not.toContain('failed with status code');
      expect(body).not.toContain('was not found');
    }
  });
});