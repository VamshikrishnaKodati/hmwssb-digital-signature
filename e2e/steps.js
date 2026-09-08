'use strict'
const {
  ROLES, ROUTE, api, seedCheck, getEstimate, findEstimateByName, assert,
  login, goto, toast, shot, overflowCheck, modalByHeading, confirmModal,
  confirmEstimateAction, setLabelControl, selectLocation, addItem, findRowId,
  field,
} = require('./helpers')

const ITEMS = [
  { code: 'EXC-001', dims: { L: 8, B: 4, D: 0.3 } },
  { code: 'DIP-100MM', dims: { L: 15 } },
  { code: 'AIRVALVE-50MM', dims: { N: 3.5 } },
  { code: 'FERRULE-20MM', dims: { N: 12 } },
]

const today = () => new Date().toISOString().slice(0, 10)
const plusDays = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)

async function findTender(ctx) {
  const r = await api(ctx, 'tender', 'GET', '/tender')
  assert(r.ok, `list tenders failed: ${r.status} ${r.error}`)
  const t = r.data.find((x) => x.EstimateID === ctx.estimateId)
  assert(t, 'auto-created tender not found')
  return t
}

async function openEstimateDetail(ctx, roleKey) {
  await login(ctx, roleKey)
  await goto(ctx, `/estimates/${ctx.estimateId}/view`)
  await ctx.page.getByText(ctx.estimateName).first().waitFor({ timeout: 15000 })
}

async function openEstimateFromQueue(ctx, roleKey) {
  await login(ctx, roleKey)
  await goto(ctx, '/approvals')
  const card = ctx.page.locator('a[href*="' + ctx.estimateId + '"]').first()
  await card.waitFor({ timeout: 15000 })
  await card.click()
  await ctx.page.getByText(ctx.estimateName).first().waitFor({ timeout: 15000 })
}

const done = (actual, detail) => ({ actual, detail })

const STEPS = [
  {
    id: 'seed_check', name: 'Prerequisites', role: 'system', figmaRef: null,
    expected: 'All seeded roles log in; item master populated',
    async run(ctx) {
      await seedCheck(ctx)
      ctx.estimateName = `E2E Golden ${new Date().toISOString().replace(/[-:.T]/g, '').slice(0, 14)}`
      return done('tokens for 9 roles; ' + ctx.items.length + ' items in master')
    },
  },

  {
    id: 'create_estimate', name: 'Create Estimate (Draft)', role: 'Manager', figmaRef: 'create_estimate',
    expected: 'Draft estimate with 4 items saved via UI',
    async run(ctx) {
      await login(ctx, 'manager')
      await goto(ctx, '/estimates/new')
      await ctx.page.locator('#name-of-work').fill(ctx.estimateName)
      await ctx.page.locator('#work-category').selectOption('Water Supply')
      await ctx.page.locator('#gst').selectOption('18')
      await selectLocation(ctx)
      for (let i = 0; i < ITEMS.length; i++) {
        if (i > 0) await ctx.page.getByRole('button', { name: 'Add New Estimate Item' }).click()
        await addItem(ctx, ITEMS[i].code, ITEMS[i].dims)
      }
      const overflow = await overflowCheck(ctx)
      await shot(ctx, 'create_estimate_filled')
      await ctx.page.getByRole('button', { name: 'Save', exact: true }).click()
      await ctx.page.getByRole('button', { name: 'Saved' }).waitFor({ timeout: 20000 })
      const est = await findEstimateByName(ctx, ctx.estimateName)
      assert(est, 'estimate not found via API after save')
      ctx.estimateId = est.EstimateID
      ctx.estimateNo = est.EstimateNo
      return done(`Saved ${ctx.estimateNo} (Draft)`, overflow ? 'horizontal overflow present on form' : null)
    },
  },

  {
    id: 'submit_estimate', name: 'Submit for DGM review', role: 'Manager', figmaRef: 'submit_estimate',
    expected: 'Status Submitted, Version 1',
    async run(ctx) {
      await openEstimateDetail(ctx, 'manager')
      await ctx.page.getByRole('button', { name: 'Submit for Review' }).click()
      await confirmModal(ctx, 'submit')
      await toast(ctx, /submit/i, 15000)
      const e = await getEstimate(ctx, 'manager', ctx.estimateId)
      assert(e.Status === 'Submitted', `expected Submitted, got ${e.Status}`)
      return done(`${e.Status} v${e.Version}`)
    },
  },

  {
    id: 'dgm_review', name: 'DGM Approve', role: 'DGM', figmaRef: 'dgm_review',
    expected: 'Status DGM_Approved; estimate forwarded to GM',
    async run(ctx) {
      await openEstimateFromQueue(ctx, 'dgm')
      await ctx.page.getByRole('button', { name: 'Approve & Recommend to GM' }).click()
      await confirmModal(ctx, 'approve')
      await toast(ctx, /approved/i, 15000)
      const e = await expectAndGet(ctx, 'DGM_Approved')
      return done(e.Status)
    },
  },

  {
    id: 'gm_sign', name: 'GM Digital Sign + OTP', role: 'GM', figmaRef: 'gm_sign',
    expected: 'Wrong OTP rejected; correct OTP + cert signs, Status Signed, owner→TenderOfficer',
    async run(ctx) {
      await openEstimateFromQueue(ctx, 'gm')
      await ctx.page.getByRole('button', { name: 'Digital Sign' }).click()
      const modal = modalByHeading(ctx.page, 'Digital Signature')
      await modal.getByRole('button', { name: 'Digital Sign' }).click()
      const code = await ctx.otpFor(ctx.estimateNo)
      await ctx.page.locator('#certificateId').fill(`HMWSSB-DSC-${String(ctx.estimateId).padStart(6, '0')}`)
      const digits = modal.locator('input[aria-label^="OTP digit"]')
      for (let i = 0; i < 6; i++) await digits.nth(i).fill('0')
      await modal.getByRole('button', { name: 'Verify OTP' }).click()
      await ctx.page.getByRole('status').filter({ hasText: /invalid/i }).first().waitFor({ timeout: 10000 })
      for (let i = 0; i < 6; i++) await digits.nth(i).fill(code[i])
      await modal.getByRole('button', { name: 'Verify OTP' }).click()
      await ctx.page.getByText('OTP Verified Successfully').first().waitFor({ timeout: 15000 })
      const e = await getEstimate(ctx, 'gm', ctx.estimateId)
      assert(e.Status === 'Signed', `expected Signed, got ${e.Status}`)
      assert(e.IsDigitallySigned === true, 'IsDigitallySigned not set')
      assert(e.CertificateID, 'CertificateID missing')
      const t = await findTender(ctx)
      assert(t && t.TenderNo && String(t.TenderNo).startsWith('eTNO/'), 'auto-created tender missing')
      ctx.tenderId = t.TenderID
      ctx.tenderNo = t.TenderNo
      return done(`Signed (${e.CertificateID}), tender ${ctx.tenderNo}`)
    },
  },

  {
    id: 'otp_reuse_negative', name: 'OTP single-use guard', role: 'GM', figmaRef: null,
    expected: 'GM no longer owner → request-otp/sign rejected (403)',
    async run(ctx) {
      const r = await api(ctx, 'gm', 'POST', `/workflow/${ctx.estimateId}/sign/request-otp`, {})
      assert(r.status === 403, `expected 403 after sign, got ${r.status}: ${r.error || r.raw}`)
      return done('request-otp 403 after ownership transfer')
    },
  },

  {
    id: 'approved_immutability', name: 'Signed estimate read-only', role: 'Manager', figmaRef: null,
    expected: 'Manager cannot edit a Signed estimate; GET unchanged',
    async run(ctx) {
      const before = await getEstimate(ctx, 'manager', ctx.estimateId)
      const r = await api(ctx, 'manager', 'PUT', `/estimates/${ctx.estimateId}`, { NameOfWork: ctx.estimateName + ' tamper' })
      assert(r.status === 400 || r.status === 403, `expected 400/403 on edit, got ${r.status}`)
      const after = await getEstimate(ctx, 'manager', ctx.estimateId)
      assert(after.NameOfWork === before.NameOfWork, 'estimate content changed')
      assert(after.Status === 'Signed', 'status changed')
      return done('edit rejected; content unchanged')
    },
  },

  {
    id: 'tender_import_check', name: 'Tender BOQ mirrors approved estimate', role: 'TenderOfficer', figmaRef: 'tender_boq',
    expected: 'BOQ rows = 4 estimate items, amounts match',
    async run(ctx) {
      const t = await findTender(ctx)
      const r = await api(ctx, 'tender', 'GET', `/tender/${t.TenderID}/boq`)
      assert(r.ok, `boq failed: ${r.status} ${r.error}`)
      assert(r.data.length === ITEMS.length, `expected ${ITEMS.length} BOQ rows, got ${r.data.length}`)
      const codes = r.data.map((x) => x.ItemCode)
      for (const it of ITEMS) assert(codes.includes(it.code), `BOQ missing ${it.code}`)
      ctx.tenderId = t.TenderID
      return done(`${r.data.length} BOQ rows`)
    },
  },

  {
    id: 'tender_configure', name: 'Configure Tender (NIT fields)', role: 'TenderOfficer', figmaRef: 'tender_configure',
    expected: 'Tender config fields persist via PUT',
    async run(ctx) {
      await login(ctx, 'tender')
      await goto(ctx, `/tenders/${ctx.tenderId}`)
      await ctx.page.getByRole('button', { name: 'Configure Tender' }).click()
      await field(ctx.page, 'Tender Type').fill('Open')
      await field(ctx.page, 'Bid Start Date').fill(today())
      await field(ctx.page, 'Bid End Date').fill(plusDays(15))
      await field(ctx.page, 'Completion Period').fill('6 months')
      await field(ctx.page, 'EMD (₹)').fill('50000')
      await field(ctx.page, 'Bid Validity (days)').fill('90')
      await field(ctx.page, 'Eligibility Criteria', 'textarea').fill('Registered contractor, min 3 years experience')
      await ctx.page.getByRole('button', { name: 'Save', exact: true }).click()
      await toast(ctx, 'Tender updated', 15000)
      return done('config persisted')
    },
  },

  {
    id: 'publish_tender', name: 'Publish Tender', role: 'TenderOfficer', figmaRef: 'publish_tender',
    expected: 'Status TenderPublished; tender Status Published',
    async run(ctx) {
      await openEstimateDetail(ctx, 'tender')
      await ctx.page.getByRole('button', { name: 'Publish Tender' }).click()
      await confirmModal(ctx, 'publish tender')
      await toast(ctx, /published/i, 15000)
      const e = await expectAndGet(ctx, 'TenderPublished')
      const t = await findTender(ctx)
      assert(t.Status === 'Published', `tender Status expected Published, got ${t.Status}`)
      return done(e.Status + ' / tender ' + t.Status)
    },
  },

  {
    id: 'submit_bids', name: 'Submit 3 bids', role: 'TenderOfficer', figmaRef: 'submit_bids',
    expected: 'Alpha/Beta/Gamma bids recorded',
    async run(ctx) {
      const gt = (await getEstimate(ctx, 'tender', ctx.estimateId)).Abstract?.GrandTotal || 1
      const BIDS = [
        { name: 'Alpha Constructions', reg: 'REG-ALPHA', amt: Math.round(gt * 0.92) },
        { name: 'Beta Infra Ltd', reg: 'REG-BETA', amt: Math.round(gt * 0.88) },
        { name: 'Gamma Engineering', reg: 'REG-GAMMA', amt: Math.round(gt * 0.95) },
      ]
      await login(ctx, 'tender')
      await goto(ctx, `/tenders/${ctx.tenderId}`)
      for (const b of BIDS) {
        await ctx.page.getByRole('button', { name: 'Submit Bid' }).click()
        await field(ctx.page, 'Contractor Name *').fill(b.name)
        await field(ctx.page, 'Registration No').fill(b.reg)
        await field(ctx.page, 'Email').fill(b.name.toLowerCase().replace(/[^a-z]+/g, '') + '@test.in')
        await field(ctx.page, 'Financial Bid Amount (₹) *').fill(String(b.amt))
        await field(ctx.page, 'EMD (₹)').fill('50000')
        await field(ctx.page, 'Technical Bid').fill('ISO 9001 certified water projects')
        await ctx.page.locator('button[type="submit"]', { hasText: 'Submit Bid' }).click()
        await ctx.page.locator('form button[type="submit"]').waitFor({ state: 'detached', timeout: 15000 })
        await toast(ctx, 'Bid submitted', 15000)
      }
      const r = await api(ctx, 'tender', 'GET', `/bids/tender/${ctx.tenderId}`)
      assert(r.ok && r.data.length === 3, `expected 3 bids, got ${r.data.length}`)
      return done('3 bids submitted')
    },
  },

  {
    id: 'technical_eval', name: 'Technical evaluation', role: 'TenderOfficer', figmaRef: 'technical_eval',
    expected: 'Beta rejected w/ reason; Alpha/Gamma eligible',
    async run(ctx) {
      await login(ctx, 'tender')
      await goto(ctx, `/tenders/${ctx.tenderId}`)
      const row = (name) => ctx.page.locator('tr', { hasText: name }).first()
      await row('Beta Infra Ltd').getByTitle('Reject with reason').click()
      await toast(ctx, 'Bid rejected', 15000)
      await row('Alpha Constructions').getByTitle('Mark eligible').click()
      await toast(ctx, 'Marked eligible', 15000)
      await row('Gamma Engineering').getByTitle('Mark eligible').click()
      await toast(ctx, 'Marked eligible', 15000)
      const bids = await api(ctx, 'tender', 'GET', `/bids/tender/${ctx.tenderId}`)
      assert(bids.ok, 'list bids failed')
      const by = (n) => bids.data.find((b) => b.ContractorName.includes(n))
      assert(by('Beta').TechnicalStatus === 'Rejected' && by('Beta').TechnicalRemarks, 'Beta not rejected with reason')
      assert(by('Alpha').TechnicalStatus === 'Eligible', 'Alpha not eligible')
      assert(by('Gamma').TechnicalStatus === 'Eligible', 'Gamma not eligible')
      return done('2 eligible, 1 rejected')
    },
  },

  {
    id: 'financial_eval', name: 'Financial evaluation (L1)', role: 'TenderOfficer', figmaRef: 'financial_eval',
    expected: 'Alpha L1, Gamma L2; rejected Beta unranked',
    async run(ctx) {
      await login(ctx, 'tender')
      await goto(ctx, `/tenders/${ctx.tenderId}`)
      await ctx.page.getByRole('button', { name: 'Evaluate Financial' }).click()
      await toast(ctx, /Ranked/i, 15000)
      const bids = await api(ctx, 'tender', 'GET', `/bids/tender/${ctx.tenderId}`)
      const by = (n) => bids.data.find((b) => b.ContractorName.includes(n))
      assert(by('Alpha').Rank === 1, `Alpha rank ${by('Alpha').Rank}`)
      assert(by('Gamma').Rank === 2, `Gamma rank ${by('Gamma').Rank}`)
      assert(by('Beta').Rank === null, 'rejected bidder ranked')
      return done('Alpha L1 · Gamma L2')
    },
  },

  {
    id: 'award', name: 'Award tender to L1', role: 'TenderOfficer', figmaRef: 'award',
    expected: 'Alpha selected; tender Status Awarded',
    async run(ctx) {
      await login(ctx, 'tender')
      await goto(ctx, `/tenders/${ctx.tenderId}`)
      await ctx.page.locator('tr', { hasText: 'Alpha Constructions' }).first().getByTitle('Award tender').click()
      await toast(ctx, /Awarded to/i, 15000)
      const bids = await api(ctx, 'tender', 'GET', `/bids/tender/${ctx.tenderId}`)
      assert(bids.data.find((b) => b.ContractorName.includes('Alpha')).IsSelected === true, 'Alpha not selected')
      const t = await findTender(ctx)
      assert(t.Status === 'Awarded', `tender Status ${t.Status}`)
      return done('Alpha awarded')
    },
  },

  {
    id: 'agency_create_ui', name: 'Agency creation via UI', role: 'Procurement Officer', figmaRef: 'agency_create',
    expected: 'UI exposes TenderPublished estimate in Add Agency dropdown; agency created via form',
    async run(ctx) {
      await login(ctx, 'procurement')
      await goto(ctx, '/agencies')
      await ctx.page.getByRole('button', { name: 'Add Agency' }).click()
      const opts = await ctx.page.locator('#EstimateID option').allTextContents()
      assert(opts.some((o) => o.includes(ctx.estimateNo)), 'Add Agency dropdown does not expose the TenderPublished estimate')
      await ctx.page.locator('#EstimateID').selectOption({ label: ctx.estimateNo })
      const tenOpts = await ctx.page.locator('#TenderID option').allTextContents()
      assert(tenOpts.some((o) => o.includes(ctx.tenderNo)), 'Tender dropdown does not expose the golden tender')
      const tenOption = tenOpts.find((o) => o.includes(ctx.tenderNo))
      await ctx.page.locator('#TenderID').selectOption({ label: tenOption })
      await ctx.page.locator('#AgencyName').fill('E2E Golden Agency Pvt Ltd')
      await ctx.page.locator('#AgencyCode').fill('E2E-AG-001')
      await ctx.page.locator('#AgreementNo').fill('AGT-E2E-001')
      await ctx.page.locator('#AgreementDate').fill(today())
      await ctx.page.locator('#CompletionPeriod').fill('6 months')
      await ctx.page.locator('#SecurityDeposit').fill('5000')
      await ctx.page.locator('#PerformanceGuarantee').fill('10000')
      await ctx.page.locator('#ContractorName').fill('Alpha Constructions')
      await ctx.page.locator('#ContactDetails').fill('alpha@e2e.test')
      await ctx.page.locator('#StartDate').fill(today())
      await ctx.page.getByRole('button', { name: 'Save' }).click()
      await toast(ctx, 'Created', 15000)
      await ctx.page.locator('tr', { hasText: 'E2E Golden Agency Pvt Ltd' }).first().waitFor({ timeout: 10000 })
      const r = await api(ctx, 'procurement', 'GET', '/agency')
      const ag = r.data.find((a) => a.AgencyName === 'E2E Golden Agency Pvt Ltd')
      assert(ag, 'agency not persisted via UI')
      ctx.agencyId = ag.AgencyID
      return done('agency created via UI dropdown + form')
    },
  },

  {
    id: 'agency_select', name: 'Finalize Agency', role: 'Procurement Officer', figmaRef: 'agency_select',
    expected: 'Status AgencySelected; owner→SiteEngineer',
    async run(ctx) {
      await openEstimateDetail(ctx, 'procurement')
      await ctx.page.getByRole('button', { name: 'Finalize Agency' }).click()
      await confirmModal(ctx, 'select agency')
      await toast(ctx, /agency/i, 15000)
      const e = await expectAndGet(ctx, 'AgencySelected')
      return done(e.Status)
    },
  },

  {
    id: 'agency_persistence', name: 'Agency record persists across roles', role: 'Site Engineer', figmaRef: null,
    expected: 'Agency name visible to Site Engineer on estimate detail',
    async run(ctx) {
      await openEstimateDetail(ctx, 'site')
      await ctx.page.getByText('E2E Golden Agency Pvt Ltd').first().waitFor({ timeout: 10000 })
      return done('agency visible to Site Engineer')
    },
  },

  {
    id: 'start_work', name: 'Start Work', role: 'Site Engineer', figmaRef: 'start_work',
    expected: 'Status WorkStarted; StartedDate/StartedBy set; audit written',
    async run(ctx) {
      await openEstimateDetail(ctx, 'site')
      await ctx.page.getByRole('button', { name: 'Start Work' }).click()
      await confirmModal(ctx, 'start work')
      await toast(ctx, /started/i, 15000)
      const e = await getEstimate(ctx, 'site', ctx.estimateId)
      assert(e.Status === 'WorkStarted', `expected WorkStarted, got ${e.Status}`)
      assert(e.StartedDate, 'StartedDate missing')
      assert(e.StartedBy, 'StartedBy missing')
      return done(e.Status + ' by ' + e.StartedBy)
    },
  },

  {
    id: 'start_work_duplicate', name: 'Duplicate start-work guard', role: 'Site Engineer', figmaRef: null,
    expected: 'Second start-work rejected (400/409)',
    async run(ctx) {
      const r = await api(ctx, 'site', 'POST', `/workflow/${ctx.estimateId}/start-work`, {})
      assert(r.status === 400 || r.status === 409, `expected 400/409, got ${r.status}: ${r.error || r.raw}`)
      return done(`rejected ${r.status}: ${r.error}`)
    },
  },

  {
    id: 'add_progress', name: 'Record work progress (25%)', role: 'Site Engineer', figmaRef: 'add_progress',
    expected: 'Progress entry persists for WorkStarted estimate',
    async run(ctx) {
      const signed = await api(ctx, 'site', 'GET', '/estimates?status=Signed')
      assert(!signed.data.some((e) => e.EstimateID === ctx.estimateId), 'WorkStarted estimate leaked into Signed-only list')
      const active = await api(ctx, 'site', 'GET', '/estimates?status=AgencySelected,WorkStarted,WorkCompleted')
      assert(active.data.some((e) => e.EstimateID === ctx.estimateId), 'active work missing from eligibility list')
      await login(ctx, 'site')
      await goto(ctx, '/progress')
      await ctx.page.getByRole('button', { name: 'Add Progress' }).click()
      const opts = await ctx.page.locator('#EstimateID option').allTextContents()
      assert(opts.some((o) => o.includes(ctx.estimateNo)), 'Progress dropdown does not expose the active WorkStarted estimate')
      await ctx.page.locator('#EstimateID').selectOption({ label: opts.find((o) => o.includes(ctx.estimateNo)) })
      await ctx.page.locator('#Stage').selectOption('Excavation')
      await ctx.page.locator('#Percentage').selectOption('25')
      await ctx.page.locator('#Date').fill(today())
      await ctx.page.locator('#Remarks').fill('Excavation completed for service line')
      await ctx.page.locator('#InspectionNotes').fill('Inspected by site engineer')
      await ctx.page.getByRole('button', { name: 'Save' }).click()
      await toast(ctx, 'Created', 15000)
      await goto(ctx, '/progress')
      await ctx.page.locator('tr', { hasText: 'Excavation' }).first().waitFor({ timeout: 10000 })
      return done('progress entry created and visible in UI')
    },
  },

  {
    id: 'add_measurement', name: 'Record Measurement Book entry', role: 'Site Engineer', figmaRef: null,
    expected: 'Measurement entry persists with cumulative/balance for WorkStarted estimate',
    async run(ctx) {
      await login(ctx, 'site')
      await goto(ctx, '/measurements')
      await ctx.page.getByRole('button', { name: 'Record Measurement' }).click()
      const opts = await ctx.page.locator('#EstimateID option').allTextContents()
      assert(opts.some((o) => o.includes(ctx.estimateNo)), 'Measurement dropdown does not expose the active WorkStarted estimate')
      await ctx.page.locator('#EstimateID').selectOption({ label: opts.find((o) => o.includes(ctx.estimateNo)) })
      const itemOpts = ctx.page.locator('#DetailID option')
      await ctx.page.waitForFunction(() => document.querySelectorAll('#DetailID option').length > 1, { timeout: 15000 })
      const itemsText = await itemOpts.allTextContents()
      assert(itemsText.length > 1, 'no estimate items exposed in measurement form')
      await ctx.page.locator('#DetailID').selectOption({ index: 1 })
      await ctx.page.locator('#PreviousQty').fill('10')
      await ctx.page.locator('#CurrentQty').fill('15')
      await ctx.page.locator('#MeasuredDate').fill(today())
      await ctx.page.locator('#Remarks').fill('E2E measurement entry')
      await ctx.page.getByRole('button', { name: 'Save', exact: true }).click()
      await toast(ctx, 'Measurement recorded', 15000)
      const r = await api(ctx, 'site', 'GET', '/measurement?estimateId=' + ctx.estimateId)
      assert(r.ok, 'list measurements failed')
      const m = r.data.find((x) => x.EstimateID === ctx.estimateId)
      assert(m, 'measurement not persisted')
      assert(Number(m.CumulativeQty) === 25, `expected cumulative 25, got ${m.CumulativeQty}`)
      assert(m.Status === 'Draft', `expected Draft, got ${m.Status}`)
      ctx.measurementId = m.MeasurementID
      return done(`recorded ${m.CurrentQty}${m.Unit || ''} cumulative ${m.CumulativeQty}`)
    },
  },

  {
    id: 'measurement_verify', name: 'Verify Measurement Book entry', role: 'Billing Officer', figmaRef: null,
    expected: 'Billing Officer verifies the Draft measurement',
    async run(ctx) {
      await login(ctx, 'billing')
      await goto(ctx, '/measurements')
      await ctx.page.locator('button', { hasText: 'Verify' }).first().waitFor({ timeout: 15000 })
      const row = ctx.page.locator('tr').filter({ has: ctx.page.getByRole('button', { name: 'Verify' }) }).first()
      await row.getByRole('button', { name: 'Verify' }).click()
      await toast(ctx, 'Verified', 15000)
      const r = await api(ctx, 'site', 'GET', '/measurement?estimateId=' + ctx.estimateId)
      const m = r.data.find((x) => x.MeasurementID === ctx.measurementId)
      assert(m.Status === 'Verified', `expected Verified, got ${m.Status}`)
      assert(m.VerifiedBy, 'VerifiedBy not set')
      return done('measurement verified by Billing Officer')
    },
  },

  {
    id: 'complete_work', name: 'Complete Work', role: 'Site Engineer', figmaRef: 'complete_work',
    expected: 'Status WorkCompleted; owner→BillingOfficer',
    async run(ctx) {
      await openEstimateDetail(ctx, 'site')
      await ctx.page.getByRole('button', { name: 'Mark Work Completed' }).click()
      await confirmModal(ctx, 'complete work')
      await toast(ctx, /completed/i, 15000)
      const e = await expectAndGet(ctx, 'WorkCompleted')
      return done(e.Status)
    },
  },

  {
    id: 'create_bill', name: 'Create Bill (RA)', role: 'Billing Officer', figmaRef: 'create_bill',
    expected: 'Bill Draft; amounts prefilled from GrandTotal',
    async run(ctx) {
      await login(ctx, 'billing')
      await goto(ctx, '/billing')
      await ctx.page.getByRole('button', { name: 'Add Bill' }).click()
      await ctx.page.locator('#EstimateID').selectOption(String(ctx.estimateId))
      ctx.billNo = 'RA-' + String(Date.now()).slice(-6)
      await ctx.page.locator('#BillNo').fill(ctx.billNo)
      await ctx.page.locator('#BillDate').fill(today())
      await ctx.page.locator('#GST').fill('18')
      await ctx.page.locator('#NetAmount').fill('118')
      await ctx.page.locator('#Measurements').fill('MB 10/2026 pp. 12-14')
      await ctx.page.getByRole('button', { name: 'Save', exact: true }).click()
      await toast(ctx, 'Created', 15000)
      const bills = await api(ctx, 'billing', 'GET', '/billing')
      assert(bills.ok, 'list bills failed')
      const bill = bills.data.find((b) => b.EstimateID === ctx.estimateId)
      assert(bill, 'bill not found for estimate')
      ctx.billNo = bill.BillNo
      ctx.billId = bill.BillID
      return done(`${bill.BillNo} (${bill.Status})`)
    },
  },

  {
    id: 'bill_submit', name: 'Submit Bill to Manager', role: 'Billing Officer', figmaRef: null,
    expected: 'Bill Submitted, CurrentStep Manager',
    async run(ctx) {
      await login(ctx, 'billing')
      await goto(ctx, '/billing')
      await ctx.page.locator('tr', { hasText: ctx.billNo }).first().getByRole('button', { name: 'Submit' }).click()
      await toast(ctx, 'Bill submitted to Manager', 15000)
      const b = await getBill(ctx)
      assert(b.Status === 'Submitted' && b.CurrentStep === 'Manager', `bill ${b.Status}/${b.CurrentStep}`)
      return done(`${b.Status} → ${b.CurrentStep}`)
    },
  },

  {
    id: 'bill_approve_chain', name: 'Bill approval chain (M→DGM→GM→Accounts)', role: 'Billing Officer', figmaRef: 'bill_approve_chain',
    expected: 'Manager→DGM→GM→Administrator approve; bill Paid',
    async run(ctx) {
      const approvals = [
        ['manager', 'Manager'],
        ['dgm', 'DGM'],
        ['gm', 'GM'],
      ]
      for (const [role, label] of approvals) {
        await login(ctx, role)
        await goto(ctx, '/billing')
        await ctx.page.locator('tr', { hasText: ctx.billNo }).first().getByRole('button', { name: 'Approve', exact: true }).click()
        await toast(ctx, /approved/i, 15000)
      }
      await login(ctx, 'admin')
      await goto(ctx, '/billing')
      const payBtn = ctx.page.locator('tr', { hasText: ctx.billNo }).first().getByRole('button', { name: 'Approve & Pay' })
      assert(await payBtn.count() === 1, 'Approve & Pay button missing for Administrator at step "Accounts"')
      await payBtn.click()
      await toast(ctx, /Paid|Payment approved/i, 15000)
      const b = await getBill(ctx)
      assert(b.Status === 'Paid', `expected Paid, got ${b.Status}`)
      assert(b.ApprovedAmount > 0, 'ApprovedAmount not set on payment')
      return done('Paid (₹' + b.ApprovedAmount + ')')
    },
  },

  {
    id: 'submit_workflow_bill', name: 'Forward estimate for archiving', role: 'Billing Officer', figmaRef: null,
    expected: 'Estimate Status Billing; owner→Administrator',
    async run(ctx) {
      await openEstimateDetail(ctx, 'billing')
      await ctx.page.getByRole('button', { name: 'Submit Bill' }).click()
      await confirmModal(ctx, 'submit bill')
      await toast(ctx, /bill/i, 15000)
      const e = await expectAndGet(ctx, 'Billing')
      return done(e.Status)
    },
  },

  {
    id: 'negative_wrong_role', name: 'Negative: wrong-role transition rejected', role: 'Manager', figmaRef: null,
    expected: 'Manager cannot start work / select agency on another role step',
    async run(ctx) {
      const r = await api(ctx, 'manager', 'POST', `/workflow/${ctx.estimateId}/start-work`, {})
      assert(r.status === 403, `expected 403 for Manager start-work, got ${r.status}: ${r.error || r.raw}`)
      const r2 = await api(ctx, 'manager', 'POST', `/workflow/${ctx.estimateId}/select-agency`, {})
      assert(r2.status === 403, `expected 403 for Manager select-agency, got ${r2.status}`)
      return done('403 for non-owner role transitions')
    },
  },

  {
    id: 'negative_wrong_state', name: 'Negative: invalid state transition rejected', role: 'Site Engineer', figmaRef: null,
    expected: 'complete-work rejected while estimate is Billing (not WorkStarted)',
    async run(ctx) {
      const e = await getEstimate(ctx, 'site', ctx.estimateId)
      assert(e.Status === 'Billing', `precondition: expected Billing, got ${e.Status}`)
      const r = await api(ctx, 'site', 'POST', `/workflow/${ctx.estimateId}/complete-work`, {})
      assert(r.status === 400 || r.status === 403, `expected 400/403 for complete-work at Billing, got ${r.status}: ${r.error || r.raw}`)
      return done(`rejected ${r.status}: ${r.error}`)
    },
  },

  {
    id: 'negative_late_bid', name: 'Negative: late bid after award rejected', role: 'Tender Officer', figmaRef: null,
    expected: 'submit-bid rejected once tender is Awarded',
    async run(ctx) {
      const tenders = await api(ctx, 'tender', 'GET', '/tender')
      const t = tenders.data.find((x) => x.EstimateID === ctx.estimateId)
      assert(t && t.Status === 'Awarded', `precondition: expected tender Awarded, got ${t && t.Status}`)
      const r = await api(ctx, 'tender', 'POST', `/bids/tender/${t.TenderID}`, {
        ContractorName: 'Late Entrant Ltd', FinancialBidAmount: 1,
      })
      assert(r.status === 400, `expected 400 for late bid, got ${r.status}: ${r.error || r.raw}`)
      return done(`late bid rejected ${r.status}: ${r.error}`)
    },
  },

  {
    id: 'negative_bill_state', name: 'Negative: paid bill cannot be re-approved', role: 'Manager', figmaRef: null,
    expected: 'approve-billing rejected for an already-Paid bill',
    async run(ctx) {
      const bills = await api(ctx, 'manager', 'GET', '/billing?estimateId=' + ctx.estimateId)
      assert(bills.ok, 'list bills failed')
      const paid = bills.data.find((b) => b.Status === 'Paid')
      assert(paid, 'precondition: a Paid bill must exist for the estimate')
      const r = await api(ctx, 'manager', 'POST', `/billing/${paid.BillID}/approve`, {})
      assert(r.status === 400 || r.status === 403, `expected 400/403 for re-approving Paid bill, got ${r.status}: ${r.error || r.raw}`)
      return done(`paid bill re-approval rejected ${r.status}`)
    },
  },

  {
    id: 'negative_measurement_delete', name: 'Negative: verified measurement cannot be deleted', role: 'Site Engineer', figmaRef: null,
    expected: 'delete-measurement rejected once Verified',
    async run(ctx) {
      const r = await api(ctx, 'site', 'DELETE', `/measurement/${ctx.measurementId}`)
      assert(r.status === 400, `expected 400 for deleting verified measurement, got ${r.status}: ${r.error || r.raw}`)
      return done('verified measurement protected')
    },
  },

  {
    id: 'dashboard_checks', name: 'Dashboard stats', role: 'Manager', figmaRef: 'dashboard',
    expected: 'modules: awardedTenders/agenciesAssigned/worksInProgress/billsPaid consistent',
    async run(ctx) {
      const r = await api(ctx, 'manager', 'GET', '/dashboard/stats')
      assert(r.ok, 'dashboard stats failed')
      const m = r.data.modules || {}
      for (const k of ['pendingTenders', 'agenciesAssigned', 'worksInProgress', 'billsPending', 'awardedTenders', 'billsPaid']) {
        assert(k in m, `modules.${k} missing`)
      }
      await login(ctx, 'manager')
      await goto(ctx, '/dashboard')
      await ctx.page.getByText('Dashboard', { exact: true }).first().waitFor({ timeout: 10000 })
      return done(`awardedTenders=${m.awardedTenders} agenciesAssigned=${m.agenciesAssigned} worksInProgress=${m.worksInProgress} billsPaid=${m.billsPaid}`)
    },
  },

  {
    id: 'archive', name: 'Archive & Complete', role: 'Administrator', figmaRef: 'archive',
    expected: 'Status Completed; IsCompleted true',
    async run(ctx) {
      await openEstimateDetail(ctx, 'admin')
      await ctx.page.getByRole('button', { name: 'Archive & Complete' }).click()
      await toast(ctx, /archived|completed/i, 15000)
      const e = await getEstimate(ctx, 'admin', ctx.estimateId)
      assert(e.Status === 'Completed', `expected Completed, got ${e.Status}`)
      assert(e.IsCompleted === true, 'IsCompleted not set')
      return done(e.Status)
    },
  },

  {
    id: 'final_audit', name: 'Workflow history + audit trail', role: 'Administrator', figmaRef: null,
    expected: 'Ordered action sequence, no duplicates',
    async run(ctx) {
      const wf = await api(ctx, 'admin', 'GET', `/workflow/${ctx.estimateId}/history`)
      assert(wf.ok, 'workflow history failed')
      const actions = wf.data.map((w) => w.Action)
      const want = ['Submit', 'Approve', 'DigitallySign', 'PublishTender', 'SelectAgency', 'StartWork', 'CompleteWork', 'SubmitBill', 'Archive']
      for (const a of want) assert(actions.includes(a), `missing workflow action ${a}`)
      assert(new Set(actions).size === actions.length, 'duplicate workflow actions')
      await openEstimateDetail(ctx, 'admin')
      await ctx.page.getByRole('button', { name: 'View Audit Trail' }).first().click()
      await ctx.page.getByText('Audit Trail').first().waitFor({ timeout: 10000 })
      const modal = modalByHeading(ctx.page, 'Audit Trail')
      const rows = await modal.locator('div.space-y-3 > *').count()
      assert(rows >= want.length, 'history rows incomplete')
      await shot(ctx, 'movement_history')
      return done(actions.join(' → '))
    },
  },

  {
    id: 'permission_matrix', name: 'Role-permission matrix', role: 'all', figmaRef: null,
    expected: 'Nav items and action buttons match navConfig roles',
    async run(ctx) {
      const NAV = {
        manager: { 'Prepare Estimate': true, 'My Queue': false, 'Agencies': true, 'Item Master': false },
        dgm: { 'Prepare Estimate': false, 'My Queue': true, 'Tenders': true, 'Item Master': false },
        gm: { 'Prepare Estimate': false, 'My Queue': true, 'Tenders': true },
        tender: { 'My Queue': true, 'Tenders': true, 'Agencies': false, 'Work Progress': false },
        procurement: { 'My Queue': true, 'Agencies': true, 'Work Progress': false, 'Billing': false },
        site: { 'My Queue': true, 'Work Progress': true, 'Billing': false, 'Tenders': false },
        billing: { 'My Queue': true, 'Billing': true, 'Work Progress': false, 'Agencies': false },
        admin: { 'My Queue': true, 'Billing': false, 'User Management': true, 'Item Master': false },
      }
      await login(ctx, 'manager')
      await ctx.page.getByRole('button', { name: 'Open navigation (Ctrl+B)' }).click()
      await ctx.page.getByRole('button', { name: 'Pin drawer open' }).click()
      for (const [roleKey, expects] of Object.entries(NAV)) {
        await login(ctx, roleKey)
        const nav = ctx.page.locator('aside#app-navigation')
        for (const [label, expected] of Object.entries(expects)) {
          const visible = await nav.getByText(label, { exact: true }).first().isVisible().catch(() => false)
          assert(visible === expected, `role ${roleKey}: nav "${label}" visible=${visible}, expected ${expected}`)
        }
        await ctx.page.keyboard.press('Escape')
      }
      return done('nav matrix matches navConfig')
    },
  },
]

async function expectAndGet(ctx, status) {
  const e = await getEstimate(ctx, 'manager', ctx.estimateId)
  assert(e.Status === status, `expected ${status}, got ${e.Status}`)
  return e
}

async function getBill(ctx) {
  const r = await api(ctx, 'billing', 'GET', `/billing`)
  assert(r.ok, 'list bills failed')
  const b = r.data.find((x) => x.BillNo === ctx.billNo)
  assert(b, 'bill not found')
  return b
}

module.exports = { STEPS, ROLES, ROUTE }
