const fs = require('fs');
const path = require('path');
const os = require('os');

const OTP_FILE = path.join(os.tmpdir(), 'hmwssb-e2e', 'dev-otp.json');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function loginAs(page, username, password = 'password123') {
  await page.goto('/login');
  await page.waitForSelector('input[name="username"]', { timeout: 15000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 20000 });
}

async function logout(page) {
  await page.goto('/dashboard');
  await sleep(600);
  try {
    const menuBtn = page.locator('button').filter({ hasText: /user|profile|menu|logout/i }).first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await sleep(300);
      const logoutBtn = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
      if (await logoutBtn.isVisible()) await logoutBtn.click();
      await page.waitForTimeout(2000);
    }
  } catch {}
  if (!/\/login/.test(page.url())) {
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
  }
}

async function readOtp(estimateNo, purpose, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const data = JSON.parse(fs.readFileSync(OTP_FILE, 'utf8'));
      const v = data[`${estimateNo}::${purpose}`];
      if (v) return v.code;
    } catch {}
    await sleep(300);
  }
  return null;
}

async function clearOtps() {
  try { fs.writeFileSync(OTP_FILE, '{}'); } catch {}
}

// Run a workflow OTP step: click action button → Send OTP → capture → fill → Verify.
async function performOtpAction(page, estimateNo, purpose, { buttonMatcher }) {
  await clearOtps();
  await page.locator(`button:has-text("${buttonMatcher}")`).first().click();
  await sleep(800);
  await page.locator('button:has-text("Send OTP")').first().click();
  await sleep(1200);
  const code = await readOtp(estimateNo, purpose, 10000);
  if (!code) throw new Error(`OTP not captured for ${estimateNo} ${purpose}`);
  const digits = String(code);
  const inputs = page.locator('input[inputmode="numeric"]');
  const count = await inputs.count();
  for (let i = 0; i < count && i < 6 && i < digits.length; i++) {
    await inputs.nth(i).fill(digits[i]);
  }
  await page.locator('button:has-text("Verify OTP")').first().click();
  await sleep(3000);
}

// Fill a TenderForm field (input/select/textarea) by its label, scoped to its .ec-form-group.
async function fillTenderField(page, label, value, kind = 'input') {
  const group = page.locator('.ec-form-group', { has: page.locator('label', { hasText: label }) }).first();
  await group.waitFor({ state: 'visible', timeout: 15000 });
  const el = group.locator(kind).first();
  if (kind === 'select') await el.selectOption({ label: value });
  else await el.fill(String(value));
}

async function fillTenderTextarea(page, label, value) {
  const group = page.locator('.ec-form-group', { has: page.locator('label', { hasText: label }) }).first();
  await group.waitFor({ state: 'visible', timeout: 15000 });
  await group.locator('textarea').first().fill(value);
}

// Drive the auto-created 'Draft' tender through the TenderForm to a publishable 'TenderDraft'.
async function configureTender(page, eid) {
  await page.goto(`/tenders/new?estimate=${eid}`);
  await page.waitForSelector('button:has-text("Save Draft")', { timeout: 20000 });
  await fillTenderField(page, 'Bidding Type', 'Two Cover', 'select');
  await fillTenderField(page, 'Tender Type', 'Open', 'select');
  await fillTenderField(page, 'Tender Category', 'Water Supply', 'select');
  await fillTenderField(page, 'Evaluation Type', 'Percentage', 'select');
  await fillTenderField(page, 'Tender Inviting Authority', 'Executive Engineer, HMWSSB');
  await fillTenderField(page, 'Officer Inviting Bids', 'Tender Officer');
  await fillTenderField(page, 'Bid Opening Authority', 'Director of Administration');

  const d = (n) => {
    const x = new Date(); x.setDate(x.getDate() + n);
    return x.toISOString().slice(0, 10);
  };
  await fillTenderField(page, 'Submission Start (Bid Start)', d(0), 'input');
  await fillTenderField(page, 'Submission Closing (Bid End)', d(20), 'input');
  await fillTenderField(page, 'Bid Opening (Technical)', d(21), 'input');
  await fillTenderField(page, 'Financial Bid Opening', d(35), 'input');
  await fillTenderField(page, 'Bid Validity (days)', '90');

  await fillTenderField(page, 'EMD / Bid Security', '100000');
  await fillTenderTextarea(page, 'Scope of Work', 'Execution of water supply pipeline works as per approved estimate.');
  await fillTenderTextarea(page, 'Eligibility Criteria', 'Registered contractor with valid GST and relevant prior experience.');

  await page.locator('button:has-text("Save Draft")').first().click();
  await page.waitForURL('**/tenders/*/edit', { timeout: 20000 });
  const m = page.url().match(/\/tenders\/(\d+)\/edit/);
  return m ? Number(m[1]) : null;
}

module.exports = { loginAs, logout, readOtp, clearOtps, performOtpAction, fillTenderField, fillTenderTextarea, configureTender };
