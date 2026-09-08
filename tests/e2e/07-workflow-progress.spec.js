const { test, expect } = require('@playwright/test');

async function loginAs(page, username) {
  await page.goto('/login');
  await page.waitForSelector('input[name="username"]', { timeout: 15000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 20000 });
}

test.describe('Frozen WorkflowProgress — current-phase-only', () => {
  test('ESTIMATE record (Draft): only ESTIMATE tracker, NO future phase rows', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/estimates/2429'); // Draft
    const wf = page.locator('[data-testid="workflow-progress"]');
    await expect(wf).toBeVisible({ timeout: 20000 });

    // Only ESTIMATE renders as the active tracker
    await expect(page.locator('[data-testid="phase-active-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="phase-active-0"]')).toContainText('ESTIMATE');
    await expect(page.locator('[data-testid="phase-active-1"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="phase-active-2"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="phase-active-3"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="phase-active-4"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="phase-active-5"]')).toHaveCount(0);

    // No completed summaries, no future rows — nothing below the active card
    await expect(page.locator('[data-testid^="phase-"]:not([data-testid^="phase-active-"])')).toHaveCount(0);
    // Current stage = Draft, owner shown
    await expect(wf.getByText('Draft').first()).toBeVisible();
    await expect(wf.getByText('Current Owner')).toBeVisible();
  });

  test('PROCUREMENT record (FCNGenerated): ESTIMATE COMPLETE + PROCUREMENT tracker only', async ({ page }) => {
    await loginAs(page, 'director_admin');
    await page.goto('/estimates/2430'); // FCNGenerated
    const wf = page.locator('[data-testid="workflow-progress"]');
    await expect(wf).toBeVisible({ timeout: 20000 });

    // "ESTIMATE" is a compact complete summary (green)
    await expect(page.locator('[data-testid="phase-0"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="phase-0"]')).toContainText('ESTIMATE');
    await expect(page.locator('[data-testid="phase-0"]')).toContainText('Complete');
    // "PROCUREMENT" is the active tracker
    await expect(page.locator('[data-testid="phase-active-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="phase-active-1"]')).toContainText('PROCUREMENT');
    // Only procurement stages appear inside the active tracker
    const activeText = await page.locator('[data-testid="phase-active-1"]').textContent();
    expect(activeText).toContain('FCN Generation');
    expect(activeText).toContain('Administrative Sanction');
    expect(activeText).toContain('Technical Sanction');
    // No other trackers, no future rows
    await expect(page.locator('[data-testid^="phase-active-"]')).toHaveCount(1);
    await expect(page.locator('[data-testid^="phase-"]:not([data-testid^="phase-active-"])')).toHaveCount(1);
  });

  test('WORK EXECUTION record (WorkStarted): 4 completed summaries + WORK EXECUTION tracker only', async ({ page }) => {
    await loginAs(page, 'site_engineer');
    await page.goto('/estimates/2748'); // WorkStarted
    const wf = page.locator('[data-testid="workflow-progress"]');
    await expect(wf).toBeVisible({ timeout: 20000 });

    // Completed summaries for the 4 prior sections
    await expect(page.locator('[data-testid="phase-0"]')).toContainText('ESTIMATE');
    await expect(page.locator('[data-testid="phase-1"]')).toContainText('PROCUREMENT');
    await expect(page.locator('[data-testid="phase-2"]')).toContainText('TENDER');
    await expect(page.locator('[data-testid="phase-3"]')).toContainText('AGENCY SELECTION');
    // Active tracker is WORK EXECUTION only
    await expect(page.locator('[data-testid="phase-active-4"]')).toBeVisible();
    await expect(page.locator('[data-testid="phase-active-4"]')).toContainText('WORK EXECUTION');
    const activeText = await page.locator('[data-testid="phase-active-4"]').textContent();
    for (const s of ['Work Order', 'Agreement', 'Work Start', 'Work Progress', 'Measurement', 'Completion']) {
      expect(activeText).toContain(s);
    }
    // No future section rendered (BILLING & PAYMENT must NOT appear as a row or tracker)
    await expect(page.locator('[data-testid="phase-5"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="phase-active-5"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="phase-active-"]')).toHaveCount(1);
    await expect(page.locator('[data-testid^="phase-"]:not([data-testid^="phase-active-"])')).toHaveCount(4);
  });

  test('Stage click opens workflow stage detail drawer with canonical label', async ({ page }) => {
    await loginAs(page, 'director_admin');
    await page.goto('/estimates/2430'); // FCNGenerated
    const wf = page.locator('[data-testid="workflow-progress"]');
    await expect(wf).toBeVisible({ timeout: 20000 });

    const stageBtn = wf.locator('button', { hasText: 'Administrative Sanction' }).first();
    await stageBtn.click();
    // Drawer opens (fixed backdrop + right panel), header eyebrow + canonical h3 title
    await expect(page.locator('div.fixed.inset-0.z-50')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('div.fixed.inset-0.z-50').getByText('Workflow Stage')).toBeVisible();
    await expect(page.locator('div.fixed.inset-0.z-50 h3')).toHaveText('Administrative Sanction');
  });
});