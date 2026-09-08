const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Negative-conditions spec (brief §16): every forbidden/short-circuited action
// across the Evaluation → L1 → Award chain is asserted at the API with its exact
// status code. UI hiding is already enforced by server `capabilities`, which the
// same endpoints back. Suite order: setup-t2 + setup-t3 → 03 → 10 → 11 (each
// consumes one fresh tender from t3-tender.json).

const TENDER_FILE = path.join(__dirname, 't3-tender.json');
const T = JSON.parse(fs.readFileSync(TENDER_FILE, 'utf8'));
const TENDER_ID = T.tenderId;

async function loginAs(page, username) {
  await page.evaluate(() => { localStorage.clear(); }).catch(() => {});
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      break;
    } catch (e) {
      if (attempt >= 2) throw e;
      await page.waitForTimeout(500);
    }
  }
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

// Drive one API call from the browser context using the logged-in token.
async function api(page, method, url, body) {
  return page.evaluate(async ({ method, url, body }) => {
    const token = localStorage.getItem('token');
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { method, url, body });
}

test.setTimeout(120000);

test.describe('T4: Evaluation → L1 → Award — negative conditions (§16)', () => {
  test.beforeAll(() => {
    if (!TENDER_ID) throw new Error('Run setup-t3.cjs first (needs t3-tender.json)');
  });

  test('every forbidden action across the chain is rejected with the right status', async ({ page }) => {
    await loginAs(page, 'tender_officer');
    const tid = TENDER_ID;

    // Publish the fresh draft, submit two bids (A cheap, B dear), close.
    const pub = await api(page, 'POST', `/api/tender/${tid}/publish`);
    expect(pub.status, 'publish must succeed on the fresh draft').toBe(200);
    const bidA = (await api(page, 'POST', `/api/bids/tender/${tid}`, {
      ContractorName: 'Alpha Negatives', RegistrationNo: 'NEG-REG-A', FinancialBidAmount: 2410000, EMD: 50000,
    })).body.data?.BidID;
    const bidB = (await api(page, 'POST', `/api/bids/tender/${tid}`, {
      ContractorName: 'Beta Negatives', RegistrationNo: 'NEG-REG-B', FinancialBidAmount: 2470000, EMD: 50000,
    })).body.data?.BidID;
    expect(bidA).toBeTruthy();
    expect(bidB).toBeTruthy();
    await api(page, 'POST', `/api/tender/${tid}/close`);

    // ── At BidsClosed: Director opening is forbidden; financial needs tech first ──
    await loginAs(page, 'director_admin');
    const dirOpen = await api(page, 'POST', `/api/tender/${tid}/bid-opening/start`);
    expect(dirOpen.status, 'Director must not open bids').toBe(403);

    await loginAs(page, 'tender_officer');
    const finBeforeTech = await api(page, 'POST', `/api/bids/tender/${tid}/evaluate/financial`);
    expect(finBeforeTech.status, 'financial evaluation before technical must be blocked').toBe(409);

    // ── Drive opening → TechnicalEvaluationPending ─────────────────────────────────
    await api(page, 'POST', `/api/tender/${tid}/bid-opening/start`);
    await api(page, 'POST', `/api/bids/${bidA}/open`);
    await api(page, 'POST', `/api/bids/${bidB}/open`);
    const opened = await api(page, 'POST', `/api/tender/${tid}/bid-opening/complete`);
    expect(opened.body?.data?.effectiveStatus).toBe('TechnicalEvaluationPending');

    // ── UI (brief §11 + §13): evaluation authority line + workflow section ─────────
    await page.goto(`/tenders/${tid}`);
    await page.waitForTimeout(2500);
    await expect(page.locator('body')).toContainText('Evaluation Authority');
    await expect(page.locator('[data-testid="workflow-progress"]')).toBeVisible();
    await expect(page.locator('body')).toContainText('Technical Evaluation');

    // ── Mid-chain: award/wo/agreement before their precondition are all rejected ───
    await loginAs(page, 'director_admin');
    const dirEval = await api(page, 'POST', `/api/bids/tender/${tid}/evaluate/technical`,
      { results: [{ BidID: bidA, Qualified: true }] });
    expect(dirEval.status, 'Director must not evaluate technical').toBe(403);

    await loginAs(page, 'tender_officer');
    const officerAward = await api(page, 'POST', `/api/bids/tender/${tid}/award`, { BidID: bidA });
    expect(officerAward.status, 'TenderOfficer must not award').toBe(403);

    await loginAs(page, 'director_admin');
    const awardBeforeL1 = await api(page, 'POST', `/api/bids/tender/${tid}/award`, { BidID: bidA });
    expect(awardBeforeL1.status, 'award before L1 must be blocked').toBe(409);
    const woBeforeAward = await api(page, 'POST', `/api/bids/tender/${tid}/work-order`, { WorkOrderNo: 'WO-early' });
    expect(woBeforeAward.status, 'work order before award must be blocked').toBe(409);
    const agBeforeWo = await api(page, 'POST', `/api/bids/tender/${tid}/agreement`, { AgreementNo: 'AGT-early' });
    expect(agBeforeWo.status, 'agreement before work order must be blocked').toBe(409);

    // ── Checklist-disqualified bidder cannot enter financial ranking (§16) ─────────
    await loginAs(page, 'tender_officer');
    const tech = await api(page, 'POST', `/api/bids/tender/${tid}/evaluate/technical`, {
      results: [
        { BidID: bidA, Qualified: true, Remarks: 'claims qualified', Checklist: [
          'Eligibility','Registration','Experience','Qualification','Financial Capacity','Technical Compliance','Required Documents'
        ].map(c => ({ Criterion: c, Passed: c === 'Experience' ? false : true })) },
        { BidID: bidB, Qualified: true, Remarks: 'all clear', Checklist: [
          'Eligibility','Registration','Experience','Qualification','Financial Capacity','Technical Compliance','Required Documents'
        ].map(c => ({ Criterion: c, Passed: true })) },
      ],
    });
    expect(tech.status).toBe(200);
    const fin = await api(page, 'POST', `/api/bids/tender/${tid}/evaluate/financial`);
    expect(fin.status).toBe(200);
    const ranked = fin.body.data?.ranked || fin.body.ranked || [];
    expect(ranked.length).toBe(1);
    expect(ranked[0].BidID).toBe(bidB);
    expect(ranked.map(r => r.BidID).includes(bidA)).toBe(false);

    // Disqualified bid left unranked on disk.
    const bids = await api(page, 'GET', `/api/bids/tender/${tid}`);
    const aRow = (bids.body.data || bids.body).find(b => b.BidID === bidA);
    expect(aRow.TechnicalStatus).toBe('Disqualified');
    expect(aRow.Rank).toBeNull();

    // ── Positive tail: L1 → award → work order → agreement completes the chain ─────
    await api(page, 'POST', `/api/bids/tender/${tid}/l1`);
    await loginAs(page, 'director_admin');
    const award = await api(page, 'POST', `/api/bids/tender/${tid}/award`, { BidID: bidB });
    expect(award.status).toBe(200);
    await api(page, 'POST', `/api/bids/tender/${tid}/work-order`, { WorkOrderNo: 'WO-NEG-1' });
    const agreement = await api(page, 'POST', `/api/bids/tender/${tid}/agreement`, { AgreementNo: 'AGT-NEG-1' });
    expect(agreement.status).toBe(200);
    expect(agreement.body?.data?.tenderStatus || agreement.body?.tenderStatus).toBe('AgreementExecuted');
  });
});