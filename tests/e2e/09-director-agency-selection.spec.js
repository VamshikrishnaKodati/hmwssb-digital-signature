const { test, expect } = require('@playwright/test');

async function loginAs(page, username) {
  await page.goto('/login');
  await page.waitForSelector('input[name="username"]', { timeout: 15000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 20000 });
}

test.describe('PHASE2: Director agency-selection queue (post-publish ownership)', () => {
  test('Director dashboard renders the agency-selection queue with publish-owner records', async ({ page }) => {
    await loginAs(page, 'director_admin');

    const queue = page.locator('[data-testid="agency-selection-queue"]');
    await expect(queue).toBeVisible({ timeout: 20000 });
    await expect(queue.getByText('Agency Selection — Pending')).toBeVisible();

    // Rows carry a TenderPublished status badge and a drill-down action.
    const rows = queue.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
    await expect(rows.first().getByText('Tender Publication', { exact: true })).toBeVisible();
    await expect(rows.first().locator('a').filter({ hasText: 'Open to select' })).toBeVisible();

    // Row actions open the estimate detail (read-only; no transition performed).
    await rows.first().locator('a').filter({ hasText: 'Open to select' }).click();
    await page.waitForURL('**/estimates/*', { timeout: 20000 });
    await expect(page.locator('[data-testid="workflow-progress"]')).toBeVisible({ timeout: 20000 });
  });
});