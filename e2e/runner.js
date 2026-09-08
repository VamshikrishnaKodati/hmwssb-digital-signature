'use strict'
const path = require('path')
const fs = require('fs')
const net = require('net')
const { spawn } = require('child_process')
const dotenv = require('dotenv')
dotenv.config({ path: path.join(__dirname, '.env') })
dotenv.config()

const { chromium } = require('playwright')
const { STEPS } = require('./steps')
const { shot } = require('./helpers')
const { evidenceDirs, stamp, writeReport, statusResult } = require('./report')
const { collectReferences } = require('./references')

const ROOT = path.resolve(__dirname, '..')
const SERVER_DIR = path.join(ROOT, 'server')
const CLIENT_DIR = path.join(ROOT, 'client')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ------------------------------------------------------------------ config
function parseArgs(argv) {
  const args = argv.slice(2)
  const opts = { mode: 'full', param: null, headful: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--headful') opts.headful = true
    else if (a === 'from') { opts.mode = 'from'; opts.param = args[++i] }
    else if (a === 'only') { opts.mode = 'only'; opts.param = args[++i] }
    else if (a === 'role') { opts.mode = 'role'; opts.param = args[++i] }
    else if (a === 'replay') opts.mode = 'replay'
    else if (a === 'full' || a === 'golden') opts.mode = 'full'
    else if (a === 'list') opts.mode = 'list'
    else { opts.mode = 'full' }
  }
  if (process.env.E2E_HEADFUL === '1') opts.headful = true
  return opts
}

function selectSteps(mode, param) {
  if (mode === 'list') return STEPS
  const seed = [STEPS[0]]
  if (mode === 'only') {
    const def = STEPS.find((s) => s.id === param)
    if (!def) throw new Error(`unknown step: ${param}`)
    return def.id === 'seed_check' ? [def] : [...seed, def]
  }
  if (mode === 'from') {
    const idx = STEPS.findIndex((s) => s.id === param)
    if (idx < 0) throw new Error(`unknown step: ${param}`)
    return idx === 0 ? STEPS : [...seed, ...STEPS.slice(idx)]
  }
  if (mode === 'role') {
    const key = Object.entries(require('./helpers').ROLES).find(([, v]) => v.desg === param || v.user === param)
    if (!key) throw new Error(`unknown role: ${param}`)
    const steps = STEPS.filter((s) => s.role === key[1].label || s.role === key[1].desg)
    return [...seed, ...steps]
  }
  if (mode === 'replay') {
    const last = JSON.parse(fs.readFileSync(path.join(evidenceDirs(ROOT).evidence, 'last-run.json'), 'utf8'))
    const failed = new Set(last.results.filter((r) => r.status === 'FAIL' || r.status === 'DEFECT').map((r) => r.id))
    const steps = STEPS.filter((s) => failed.has(s.id))
    return [...seed, ...steps]
  }
  return STEPS
}

// ------------------------------------------------------------------ spawn
function assertPortFree(port, label) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', (e) => {
      if (e.code === 'EADDRINUSE') reject(new Error(`${label} port ${port} already in use — a stale runner/API is holding it; kill it first`))
      else reject(e)
    })
    srv.once('listening', () => srv.close(resolve))
    srv.listen(port)
  })
}

async function waitForHealth(url, label, timeoutMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.status === 200) return
    } catch {}
    await sleep(500)
  }
  throw new Error(`${label} did not become healthy at ${url}`)
}

async function spawnApi(ctx) {
  const log = fs.createWriteStream(ctx.serverLog, { flags: 'w' })
  const child = spawn('node', ['server.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(ctx.apiPort),
      NODE_ENV: 'development',
      MAIL_DEV_RECIPIENT: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let buf = ''
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString()
    log.write(text)
    buf += text
    const lines = buf.split('\n')
    buf = lines.pop()
    for (const line of lines) onApiLine(line)
  })
  child.stderr.on('data', (chunk) => log.write(chunk.toString()))
  child.on('error', (e) => log.write(`[runner] api spawn error: ${e.message}\n`))
  await waitForHealth(`${ctx.api}/api/health`, 'API')
  return child
}

const otpMap = {}
function onApiLine(line) {
  const m = /\[OTP\]\[DEV\] Signature OTP for estimate (\S+) \(user [^)]+\): (\d{6})/.exec(line)
  if (m) otpMap[m[1]] = m[2]
}

async function otpFor(estimateNo, timeoutMs = 30000) {
  const start = Date.now()
  while (!otpMap[estimateNo]) {
    if (Date.now() - start > timeoutMs) throw new Error(`OTP for ${estimateNo} not captured from server log`)
    await sleep(250)
  }
  return otpMap[estimateNo]
}

async function spawnClient(ctx) {
  const log = fs.createWriteStream(ctx.clientLog, { flags: 'w' })
  const viteBin = path.join(CLIENT_DIR, 'node_modules', 'vite', 'bin', 'vite.js')
  const child = spawn('node', [viteBin, '--port', String(ctx.clientPort), '--strictPort'], {
    cwd: CLIENT_DIR,
    env: { ...process.env, VITE_API_TARGET: ctx.api },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  child.stdout.on('data', (chunk) => log.write(chunk.toString()))
  child.stderr.on('data', (chunk) => log.write(chunk.toString()))
  child.on('error', (e) => log.write(`[runner] client spawn error: ${e.message}\n`))
  await waitForHealth(ctx.base, 'Client', 90000)
  return child
}

function kill(child) {
  if (!child || child.exitCode !== null) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000)
    child.once('exit', () => { clearTimeout(timer); resolve() })
    try { child.kill() } catch {}
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' })
    }
  })
}

// ------------------------------------------------------------------ run
async function run(ctx) {
  const refs = collectReferences(ctx.refsDir, STEPS.map((s) => s.figmaRef).filter(Boolean))
  ctx.notes = []
  if (refs.missing.length) ctx.notes.push(`No Figma reference captured yet for: ${refs.missing.join(', ')}`)
  ctx.notes.push('Golden E2E v1: PASS = real UI path. DEFECT = app prevented a UI path. No API fallback exists in steps.js.')

  const browser = await chromium.launch({ headless: !ctx.headful })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(25000)
  ctx.page = page
  ctx.otpFor = otpFor
  const consoleLog = fs.createWriteStream(path.join(ctx.evidence, 'browser-console.log'), { flags: 'w' })
  page.on('console', (m) => consoleLog.write(`[${m.type()}] ${m.text()}\n`))
  page.on('pageerror', (e) => consoleLog.write(`[pageerror] ${e.message}\n`))

  const selected = selectSteps(ctx.mode, ctx.param)
  if (ctx.mode === 'list') {
    for (const s of selected) console.log(`${s.id.padEnd(24)} ${s.role.padEnd(20)} ${s.name}`)
    await browser.close()
    return null
  }

  const results = []
  for (const def of selected) {
    const screens = []
    const rec = statusResult(ctx, def, 'PASS', 'OK', { screens })
    if (ctx.stopOnFail && results.some((r) => r.status === 'FAIL')) {
      rec.status = 'SKIP'
      rec.outcome = 'Skipped after earlier failure'
    } else {
      try {
        const out = await def.run(ctx)
        const status = out && out.status ? out.status : 'PASS'
        rec.status = status
        rec.outcome = status === 'FAIL' ? 'Step failed' : status === 'DEFECT' ? 'Product defect — continued via API fallback' : status === 'SKIP' ? 'Not executed (informational)' : 'OK'
        rec.actual = out ? out.actual : ''
        if (out && out.detail) rec.detail = out.detail
      } catch (err) {
        rec.status = 'FAIL'
        rec.outcome = 'Step failed'
        rec.detail = err.message
        rec.actual = `page: ${ctx.page.url()}`
        const s = await shot(ctx, def.id + '_fail')
        if (s) screens.push(s)
        try {
          const html = await ctx.page.content()
          fs.writeFileSync(path.join(ctx.evidence, def.id + '_fail.html'), html)
        } catch {}
      }
    }
    if (screens.length) rec.screens = screens
    results.push(rec)
    const tag = rec.status === 'FAIL' ? 'FAIL' : rec.status === 'DEFECT' ? 'DEFECT' : rec.status === 'SKIP' ? 'SKIP' : 'PASS'
    console.log(`[${tag}] ${rec.id} — ${rec.outcome}${rec.detail ? ': ' + rec.detail.slice(0, 140) : ''}`)
  }

  await browser.close()
  return results
}

// ------------------------------------------------------------------ main
async function main() {
  process.on('unhandledRejection', (e) => { console.error('UNHANDLED REJECTION:', e && e.stack || e); process.exit(1) })
  process.on('uncaughtException', (e) => { console.error('UNCAUGHT EXCEPTION:', e && e.stack || e); process.exit(1) })
  const opts = parseArgs(process.argv)
  const dirs = evidenceDirs(ROOT)
  const LOCK_PATH = path.join(ROOT, 'e2e', '.runner.lock')
  if (fs.existsSync(LOCK_PATH)) {
    const pid = parseInt(fs.readFileSync(LOCK_PATH, 'utf8'), 10)
    if (pid && pid !== process.pid) {
      let alive = true
      try { process.kill(pid, 0) } catch { alive = false }
      if (alive) throw new Error(`another runner (PID ${pid}) is already running; kill it or delete e2e/.runner.lock`)
    }
  }
  fs.writeFileSync(LOCK_PATH, String(process.pid))
  fs.rmSync(dirs.evidence, { recursive: true, force: true })
  fs.mkdirSync(dirs.screens, { recursive: true })
  const apiPort = parseInt(process.env.E2E_API_PORT || '5201', 10)
  const clientPort = parseInt(process.env.E2E_CLIENT_PORT || '5280', 10)

  const ctx = {
    ...dirs,
    api: `http://localhost:${apiPort}`,
    base: `http://localhost:${clientPort}`,
    apiPort,
    clientPort,
    spawnApi: process.env.E2E_SPAWN_API !== '0',
    spawnClient: process.env.E2E_SPAWN_CLIENT !== '0',
    headful: opts.headful,
    mode: opts.mode,
    param: opts.param,
    stopOnFail: opts.mode === 'full',
    tokens: {},
    startedAt: stamp(),
    serverLog: path.join(dirs.evidence, 'server.log'),
    clientLog: path.join(dirs.evidence, 'client.log'),
    screensDir: dirs.screens,
    refsDir: dirs.refs,
  }
  ctx.spawned = { api: ctx.spawnApi, client: ctx.spawnClient }
  ctx.playwrightVersion = require('playwright/package.json').version
  ctx.browser = 'chromium'

  const children = []
  try {
    if (opts.mode === 'list') {
      for (const s of STEPS) console.log(`${s.id.padEnd(24)} ${s.role.padEnd(20)} ${s.name}`)
      return
    }
    if (ctx.spawnApi) {
      console.log(`Spawning API on :${apiPort} (NODE_ENV=development)`)
      await assertPortFree(apiPort, 'API')
      children.push(await spawnApi(ctx))
    }
    if (ctx.spawnClient) {
      console.log(`Spawning client on :${clientPort} (VITE_API_TARGET=${ctx.api})`)
      await assertPortFree(clientPort, 'Client')
      children.push(await spawnClient(ctx))
    }
    console.log(`Running mode=${opts.mode}${opts.param ? ' (' + opts.param + ')' : ''}`)
    const results = await run(ctx)
    if (!results) return
    ctx.finishedAt = stamp()
    const reportPath = writeReport(ctx, results)
    console.log(`\nReport: ${reportPath}`)
  } catch (err) {
    console.error(`Runner error: ${err.message}`)
    process.exitCode = 1
  } finally {
    try { fs.rmSync(LOCK_PATH, { force: true }) } catch {}
    for (const c of children) await kill(c)
  }
  process.exit(process.exitCode || 0)
}

main()
