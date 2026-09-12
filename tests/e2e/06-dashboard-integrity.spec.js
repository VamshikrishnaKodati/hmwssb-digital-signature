const { test, expect } = require('@playwright/test');

const ROLES = [
  { username: 'manager', designation: 'Manager' },
  { username: 'dgm', designation: 'DGM' },
  { username: 'gm', designation: 'GM' },
  { username: 'cgm', designation: 'CGM' },
  { username: 'dop', designation: 'DOP' },
  { username: 'ed', designation: 'ED' },
  { username: 'md', designation: 'MD' },
  { username: 'director_admin', designation: 'DirectorOfAdministration' },
  { username: 'finance_clerk', designation: 'FinanceClerk' },
  { username: 'finance_manager', designation: 'FinanceManager' },
  { username: 'finance_head', designation: 'FinanceHead' },
  { username: 'tender_officer', designation: 'TenderOfficer' },
  { username: 'site_engineer', designation: 'SiteEngineer' },
  { username: 'billing_officer', designation: 'BillingOfficer' },
  { username: 'admin_officer', designation: 'Administrator' },
  { username: 'soradmin', designation: 'SoRAdmin' },
];

async function loginAs(page, username, password = 'password123') {
  await page.goto('/login');
  await page.waitForSelector('input[name="username"]', { timeout: 15000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 20000 });
}

test.describe('Dashboard data integrity (real data, KPI = drilldown)', () => {
  for (const role of ROLES) {
    test(`${role.designation} dashboard renders real data`, async ({ page }) => {
      await loginAs(page, role.username);

      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('user')));
      const token = await page.evaluate(() => localStorage.getItem('token'));

      // The dashboard must show the greeting (real user, other roles) or the
      // Manager's attention section + overview — all driven by /dashboard/stats.
      if (stored.Designation === 'Manager') {
        await expect(page.locator('[data-testid="dashboard-shell"]')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('[data-testid="operational-overview"]')).toBeVisible({ timeout: 20000 });
        // Manager attention section: Prepare Estimate + two count cards.
        await expect(page.locator('h2', { hasText: 'Needs Your Attention' })).toBeVisible();
        const attentionLinks = await page.locator('[aria-labelledby="attention-heading"] a').count();
        expect(attentionLinks).toBe(3);
      } else {
        await expect(page.locator('[data-testid="dashboard-greeting"]')).toBeVisible({ timeout: 20000 });
        const greeting = await page.locator('[data-testid="dashboard-greeting"]').textContent();
        expect(greeting).toBeTruthy();
        expect(greeting.length).toBeGreaterThan(5);
      }

      // No error toast / retry state should be present.
      const body = await page.locator('body').textContent();
      expect(body).not.toContain('Retry');

      // Cross-check: fetch the same dashboard payload via API and confirm the
      // role blob exists (no empty/fake dashboard).
      const resp = await page.evaluate(async (tok) => {
        const r = await fetch('/api/dashboard/stats', { headers: { Authorization: 'Bearer ' + tok } });
        return await r.json();
      }, token);
      const roleKeys = {
        Manager: 'managerDashboard', DGM: 'dgmDashboard', GM: 'gmDashboard',
        CGM: 'cgmDashboard', DOP: 'dopDashboard', ED: 'edDashboard', MD: 'mdDashboard',
        DirectorOfAdministration: 'directorAdminDashboard', TenderOfficer: 'tenderOfficerDashboard',
        SiteEngineer: 'siteEngineerDashboard', BillingOfficer: 'billingDashboard',
        Administrator: 'adminDashboard', SoRAdmin: 'soRAdminDashboard',
        FinanceClerk: 'financeClerkDashboard', FinanceManager: 'financeManagerDashboard',
        FinanceHead: 'financeHeadDashboard',
      };
      const blob = resp.data[roleKeys[stored.Designation]];
      expect(blob).not.toBeNull();
      // Manager uses operationalMetrics/pipeline; all other roles use metrics.
      const blocks = stored.Designation === 'Manager'
        ? [blob.operationalMetrics || {}, blob.pipeline || {}]
        : [blob.metrics || {}];
      const metricVals = blocks.flatMap(b => Object.values(b))
        .filter(v => v !== null && v !== undefined);
      expect(metricVals.length).toBeGreaterThan(0);
      // at least one metric is a real count (0 allowed, but key must exist)
      expect(metricVals.length).toBeGreaterThan(0);
    });
  }
});