const { test, expect } = require('@playwright/test');

async function loginAs(page, username, password = 'password123') {
  await page.goto('/login');
  await page.waitForSelector('input[name="username"]', { timeout: 15000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 20000 });
}

test.describe('Error state verification', () => {
  test('404 shows "was not found" message (not generic)', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/estimates/99999999');
    await page.waitForTimeout(2500);
    const body = await page.locator('body').textContent();
    expect(body).toContain('was not found');
  });

  test('Real estimate detail still loads', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/estimates?status=Draft');
    await page.waitForTimeout(3000);
    // grab first estimate link
    const firstLink = page.locator('a[href^="/estimates/"]').first();
    await firstLink.waitFor({ timeout: 15000 });
    const href = await firstLink.getAttribute('href');
    await page.goto(href);
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent();
    expect(body).not.toContain('was not found');
    expect(body).not.toContain('error-context');
  });
});