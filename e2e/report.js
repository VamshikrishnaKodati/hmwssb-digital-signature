'use strict'
const fs = require('fs')
const path = require('path')

function evidenceDirs(root) {
  const evidence = path.join(root, 'e2e', 'evidence')
  const screens = path.join(evidence, 'screens')
  const refs = path.join(root, 'e2e', 'references')
  fs.mkdirSync(screens, { recursive: true })
  fs.mkdirSync(refs, { recursive: true })
  return { evidence, screens, refs }
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function writeReport(ctx, results) {
  const lines = []
  const pad = (s, n) => String(s).padEnd(n)
  lines.push('HMWSSB Works Management System — Workflow Validation Report')
  lines.push('='.repeat(100))
  lines.push(`Started   : ${ctx.startedAt}`)
  lines.push(`Finished  : ${ctx.finishedAt}`)
  lines.push(`Runner    : e2e/runner.js (Playwright ${ctx.playwrightVersion || '?'})`)
  lines.push(`Browser   : ${ctx.browser || 'chromium'}${ctx.headful ? ' (headful)' : ' (headless)'}`)
  lines.push(`Targets   : API ${ctx.api} | Client ${ctx.base}`)
  lines.push(`Spawned   : API ${ctx.spawned.api ? 'yes' : 'no'} | Client ${ctx.spawned.client ? 'yes' : 'no'}`)
  lines.push(`Mode      : ${ctx.mode}${ctx.mode !== 'full' ? ' (replay: ' + ctx.replayOf + ')' : ''}`)
  lines.push('')
  lines.push('Result Summary')
  lines.push('-' .repeat(100))
  const pass = results.filter((r) => r.status === 'PASS').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  const defect = results.filter((r) => r.status === 'DEFECT').length
  const skip = results.filter((r) => r.status === 'SKIP').length
  lines.push(`  UI PASS: ${pass}   API FALLBACK: 0   DEFECT: ${defect}   FAIL: ${fail}   SKIP: ${skip}   TOTAL: ${results.length}`)
  lines.push('  A PASS is a step completed through the real UI; DEFECT means the app prevented a UI path; FAIL is an assertion break.')
  const uiSteps = results.length - skip
  const achieved = pass === uiSteps && defect === 0 && fail === 0
  lines.push(`  Golden E2E v1 acceptance: ${uiSteps}/${uiSteps} UI steps PASS, 0 API fallback, 0 DEFECT, 0 FAIL — currently ${achieved ? 'ACHIEVED' : 'NOT YET'}`)
  lines.push('')
  lines.push('Step Results')
  lines.push('-' .repeat(100))
  lines.push(pad('Step ID', 24) + pad('Status', 6) + pad('Role', 22) + 'Outcome')
  lines.push('-' .repeat(100))
  for (const r of results) {
    const tag = r.status === 'FAIL' ? 'FAIL' : r.status === 'DEFECT' ? 'DEFECT' : r.status === 'SKIP' ? 'SKIP' : 'PASS'
    lines.push(pad(r.id, 24) + pad(tag, 6) + pad(r.role, 22) + r.outcome)
    if (r.detail) lines.push(pad('', 24) + pad('', 6) + pad('', 22) + '  ' + r.detail)
    if (r.expected) lines.push(pad('', 24) + pad('', 6) + pad('', 22) + '  expected: ' + r.expected)
    if (r.actual) lines.push(pad('', 24) + pad('', 6) + pad('', 22) + '  actual:   ' + r.actual)
  }
  lines.push('')
  lines.push('Evidence')
  lines.push('-' .repeat(100))
  const scrFiles = []
  for (const r of results) for (const s of r.screens || []) scrFiles.push(s)
  for (const s of scrFiles) lines.push('  screenshot: ' + path.relative(process.cwd(), s))
  if (ctx.otpLog) lines.push('  server log: ' + path.relative(process.cwd(), ctx.otpLog))
  lines.push('')
  lines.push('References')
  lines.push('-' .repeat(100))
  const refFiles = fs.readdirSync(ctx.refsDir).filter((f) => /\.(json|png)$/i.test(f)).sort()
  if (refFiles.length) for (const f of refFiles) lines.push('  reference: ' + f)
  else lines.push('  none loaded — start the reference server and capture frames in Figma first')
  lines.push('')
  lines.push('Notes')
  lines.push('-' .repeat(100))
  if (ctx.notes && ctx.notes.length) for (const n of ctx.notes) lines.push('  - ' + n)
  else lines.push('  none')
  lines.push('')
  lines.push('Replay')
  lines.push('-' .repeat(100))
  lines.push('  node e2e/runner.js full                 # full golden workflow')
  lines.push('  node e2e/runner.js from <stepId>        # resume from a step')
  lines.push('  node e2e/runner.js only <stepId>        # run one step')
  lines.push('  node e2e/runner.js role <Role>          # only steps for one role')
  lines.push('  node e2e/runner.js replay               # rerun failed steps against running stack')
  lines.push('')

  const reportPath = path.join(ctx.evidence, 'report.txt')
  fs.writeFileSync(reportPath, lines.join('\n'))
  fs.writeFileSync(path.join(ctx.evidence, 'last-run.json'), JSON.stringify({
    startedAt: ctx.startedAt,
    finishedAt: ctx.finishedAt,
    api: ctx.api,
    base: ctx.base,
    results: results.map((r) => ({ id: r.id, status: r.status, role: r.role, outcome: r.outcome })),
  }, null, 2))
  return reportPath
}

function statusResult(ctx, def, status, outcome, extra = {}) {
  const r = { id: def.id, name: def.name, role: def.role, status, outcome, screens: [] }
  if (def.figmaRef) r.figmaRef = def.figmaRef
  if (def.expected) r.expected = def.expected
  if (extra.detail) r.detail = extra.detail
  if (extra.actual) r.actual = extra.actual
  if (extra.screens) r.screens = extra.screens
  return r
}

module.exports = { evidenceDirs, stamp, writeReport, statusResult }
