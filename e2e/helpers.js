'use strict'
const path = require('path')

const PASSWORD = 'password123'

const ROLES = {
  manager: { user: 'manager', desg: 'Manager', label: 'Manager' },
  dgm: { user: 'dgm', desg: 'DGM', label: 'DGM' },
  gm: { user: 'gm', desg: 'GM', label: 'GM' },
  soradmin: { user: 'soradmin', desg: 'SoRAdmin', label: 'SoR Admin' },
  tender: { user: 'tender_officer', desg: 'TenderOfficer', label: 'Tender Officer' },
  procurement: { user: 'director_admin', desg: 'DirectorOfAdministration', label: 'Director of Administration' },
  site: { user: 'site_engineer', desg: 'SiteEngineer', label: 'Site Engineer' },
  billing: { user: 'billing_officer', desg: 'BillingOfficer', label: 'Billing Officer' },
  admin: { user: 'admin_officer', desg: 'Administrator', label: 'Administrator' },
}

const ROUTE = {
  manager: '/estimates',
  dgm: '/approvals',
  gm: '/approvals',
  soradmin: '/items',
  tender: '/tenders',
  procurement: '/agencies',
  site: '/progress',
  billing: '/billing',
  admin: '/dashboard',
}

// ---------------------------------------------------------------- API layer
async function api(ctx, roleKey, method, urlPath, body) {
  const token = ctx.tokens && ctx.tokens[roleKey]
  const url = urlPath.startsWith('/api/') ? `${ctx.api}${urlPath}` : `${ctx.api}/api${urlPath}`
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  const ok = res.status >= 200 && res.status < 300 && json && json.success === true
  const errMsg = json && json.success === false
    ? (typeof json.error === 'object' ? (json.error.message || 'unknown') : json.error)
    : null
  return {
    status: res.status,
    ok,
    data: ok ? json.data : json,
    raw: text,
    error: errMsg || (json && json.success === false ? 'unknown' : null),
  }
}

async function loginAs(ctx, roleKey) {
  const r = await api(ctx, roleKey, 'POST', '/auth/login', { username: ROLES[roleKey].user, password: PASSWORD })
  if (!r.ok) throw new Error(`login failed for ${ROLES[roleKey].user}: ${r.status} ${r.error || r.raw}`)
  return r.data.token
}

async function seedCheck(ctx) {
  ctx.tokens = {}
  for (const k of Object.keys(ROLES)) ctx.tokens[k] = await loginAs(ctx, k)
  const items = await api(ctx, 'manager', 'GET', '/items?limit=1000')
  if (!items.ok || !Array.isArray(items.data) || items.data.length === 0) {
    throw new Error(`item master unavailable: ${items.status} ${items.error || items.raw}`)
  }
  ctx.items = items.data
}

async function getEstimate(ctx, roleKey, id) {
  const r = await api(ctx, roleKey, 'GET', `/estimates/${id}`)
  if (!r.ok) throw new Error(`GET /estimates/${id} failed: ${r.status} ${r.error || r.raw}`)
  return r.data
}

async function findEstimateByName(ctx, name) {
  const r = await api(ctx, 'manager', 'GET', `/estimates?search=${encodeURIComponent(name)}&limit=20`)
  if (!r.ok) throw new Error(`list estimates failed: ${r.status} ${r.error || r.raw}`)
  const list = Array.isArray(r.data) ? r.data : r.data && r.data.rows ? r.data.rows : []
  return list.find((e) => e.NameOfWork === name)
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function expectStatus(ctx, id, status) {
  const e = await getEstimate(ctx, 'manager', id)
  assert(e.Status === status, `expected status "${status}", got "${e.Status}"`)
  return e
}

// ---------------------------------------------------------------- browser UI
async function gotoPage(ctx, url, label) {
  let lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await ctx.page.goto(url, { waitUntil: 'domcontentloaded' })
      return
    } catch (e) {
      lastErr = e
      await ctx.page.waitForTimeout(1500)
    }
  }
  throw new Error(`${label || url}: ${lastErr.message}`)
}

async function login(ctx, roleKey) {
  await gotoPage(ctx, `${ctx.base}/login`, `login navigation failed for ${roleKey}`)
  if (await ctx.page.locator('#username').count() === 0) {
    await ctx.page.evaluate(() => { localStorage.removeItem('token'); localStorage.removeItem('user') })
    await gotoPage(ctx, `${ctx.base}/login`, `login navigation failed for ${roleKey}`)
  }
  await ctx.page.locator('#username').fill(ROLES[roleKey].user)
  await ctx.page.locator('#password').fill(PASSWORD)
  await ctx.page.getByRole('button', { name: 'Sign In' }).click()
  await ctx.page.getByText('Dashboard', { exact: true }).first().waitFor({ timeout: 20000 })
}

async function goto(ctx, route) {
  await gotoPage(ctx, `${ctx.base}${route}`, `navigation to ${route} failed`)
  await ctx.page.waitForLoadState('networkidle').catch(() => {})
}

async function toast(ctx, text, timeout = 10000) {
  await ctx.page.getByRole('status').filter({ hasText: text }).first().waitFor({ timeout })
}

async function shot(ctx, name) {
  const p = path.join(ctx.screensDir, `${name}.png`)
  await ctx.page.screenshot({ path: p, fullPage: false }).catch(() => {})
  return p
}

async function overflowCheck(ctx) {
  return ctx.page.evaluate(() => {
    const el = document.querySelector('#app-main') || document.documentElement
    return el.scrollWidth > el.clientWidth + 1
  })
}

function modalByHeading(page, heading) {
  return page.locator('div.fixed.inset-0').filter({ has: page.locator('h3', { hasText: heading }) }).last()
}

async function confirmModal(ctx, actionLabel) {
  const m = modalByHeading(ctx.page, `Confirm ${actionLabel.replace(/-/g, ' ')}`)
  await m.getByRole('button', { name: 'Confirm', exact: true }).click()
}

async function confirmEstimateAction(ctx, actionLabel) {
  await ctx.page.getByRole('button', { name: actionLabel }).first().click()
  await confirmModal(ctx, actionLabel)
}

async function setLabelControl(ctx, labelText, value, { isSelect = false } = {}) {
  const group = ctx.page.locator('.ec-form-group', { has: ctx.page.locator('label', { hasText: labelText }) }).last()
  const ctl = group.locator('input, select, textarea').first()
  if (isSelect) await ctl.selectOption(String(value))
  else await ctl.fill(String(value))
}

async function selectLocation(ctx) {
  // The Create Estimate UI uses a single visible Location (Ward) select;
  // picking it cascades Region/Zone/Division/Circle into hidden inputs.
  const s = ctx.page.locator('#loc-ward')
  await s.waitFor({ timeout: 10000 })
  await s.selectOption({ index: 1 })
  await ctx.page.waitForFunction(() => {
    const v = id => document.getElementById(id)?.value
    return v('loc-region') && v('loc-region') !== '—' &&
      v('loc-zone') && v('loc-division') && v('loc-circle') && v('loc-circle') !== '—'
  }, null, { timeout: 10000 })
}

// add one item row by searching the item master (works on the empty first row)
async function addItem(ctx, code, dims) {
  const page = ctx.page
  const combobox = page.getByRole('combobox', { name: 'Search estimate item' })
  await combobox.waitFor({ timeout: 20000 })
  let row = null
  for (let attempt = 0; attempt < 3 && !row; attempt++) {
    if (attempt > 0) await combobox.fill('')
    await combobox.fill(code)
    row = page.locator('.ec-search-row-item', { hasText: code }).first()
    try {
      await row.waitFor({ timeout: 10000 })
    } catch {
      row = null
    }
  }
  assert(row, `item row ${code} never appeared in search results`)
  await row.click()
  await page.locator(`text=/Item details/`).first().waitFor({ timeout: 8000 }).catch(() => {})
  for (const [f, v] of Object.entries(dims)) {
    const inp = page.getByLabel(`${f} for item ${code}`)
    await inp.fill(String(v))
  }
}

// forms use <label class="ec-label"> + <input> without htmlFor/aria wiring,
// so getByLabel cannot match them. field() walks to the input under the label.
function field(page, text, tag = 'input') {
  return page.locator('label.ec-label', { hasText: text }).locator('..').locator(tag).first()
}

// find the id of the newly created estimate once it appears in the list
async function findRowId(ctx, name, status) {
  await ctx.page.waitForTimeout(300)
  const r = await findEstimateByName(ctx, name)
  if (!r) return null
  if (status && r.Status !== status) return null
  return r.EstimateID
}

module.exports = {
  PASSWORD, ROLES, ROUTE,
  api, loginAs, seedCheck, getEstimate, findEstimateByName, assert, expectStatus,
  login, goto, toast, shot, overflowCheck, modalByHeading, confirmModal,
  confirmEstimateAction, setLabelControl, selectLocation, addItem, findRowId,
  field,
}
