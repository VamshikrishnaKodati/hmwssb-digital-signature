const { test, expect } = require('@playwright/test');

const USERS = [
  { username: 'manager', password: 'password123', designation: 'Manager', name: 'Rajesh Kumar' },
  { username: 'dgm', password: 'password123', designation: 'DGM', name: 'Srinivas Reddy' },
  { username: 'gm', password: 'password123', designation: 'GM', name: 'Venkatesh Rao' },
  { username: 'cgm', password: 'password123', designation: 'CGM', name: 'CGM Officer' },
  { username: 'dop', password: 'password123', designation: 'DOP', name: 'DOP Officer' },
  { username: 'ed', password: 'password123', designation: 'ED', name: 'ED Officer' },
  { username: 'md', password: 'password123', designation: 'MD', name: 'MD Officer' },
  { username: 'tender_officer', password: 'password123', designation: 'TenderOfficer', name: 'Tender Officer' },
  { username: 'site_engineer', password: 'password123', designation: 'SiteEngineer', name: 'Site Engineer' },
  { username: 'billing_officer', password: 'password123', designation: 'BillingOfficer', name: 'Billing Officer' },
  { username: 'admin_officer', password: 'password123', designation: 'Administrator', name: 'Administrator' },
  { username: 'soradmin', password: 'password123', designation: 'SoRAdmin', name: 'Anil Sharma' },
  { username: 'finance_clerk', password: 'password123', designation: 'FinanceClerk', name: 'Finance Clerk' },
  { username: 'finance_manager', password: 'password123', designation: 'FinanceManager', name: 'Finance Manager' },
  { username: 'finance_head', password: 'password123', designation: 'FinanceHead', name: 'Finance Head' },
  { username: 'director_admin', password: 'password123', designation: 'DirectorOfAdministration', name: 'Dr. Priya Nair' },
];

async function loginAs(page, username, password) {
  await page.goto('/login');
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

async function logout(page) {
  const menuBtn = page.locator('button').filter({ hasText: /user|profile|menu|logout/i }).first();
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    const logoutBtn = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    } else {
      await page.evaluate(() => { localStorage.clear(); });
      await page.goto('/login');
    }
  } else {
    await page.evaluate(() => { localStorage.clear(); });
    await page.goto('/login');
  }
}

test.describe('PART 1: All Role Logins', () => {
  for (const user of USERS) {
    test(`Login as ${user.designation} (${user.username})`, async ({ page }) => {
      await loginAs(page, user.username, user.password);
      await expect(page).toHaveURL(/\/dashboard/);
      const storedUser = await page.evaluate(() => {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : null;
      });
      expect(storedUser).not.toBeNull();
      expect(storedUser.Designation).toBe(user.designation);
      expect(storedUser.Username).toBe(user.username);
      await page.evaluate(() => { localStorage.clear(); });
      await page.goto('/login');
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('Wrong password rejected', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'manager');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/login/);
  });

  test('Empty fields show validation', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    const errorText = await page.textContent('body');
    expect(errorText).toMatch(/required/i);
  });
});
