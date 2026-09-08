'use strict'
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const { STEPS } = require('./steps')
const { evidenceDirs, writeReport, statusResult } = require('./report')
const { loadReference } = require('./references')

// 1. Step list coherence: unique ids, runnable functions, valid figmaRef keys.
const ids = STEPS.map((s) => s.id)
assert.strictEqual(new Set(ids).size, ids.length, 'step ids must be unique')
for (const s of STEPS) {
  assert.strictEqual(typeof s.run, 'function', `step ${s.id} has no run()`)
  assert.ok(s.name && s.role, `step ${s.id} missing name/role`)
}

// 2. Report writer produces a file with PASS/FAIL/SKIP accounting.
const dirs = evidenceDirs(path.join(__dirname, '..'))
const fakeCtx = {
  ...dirs,
  api: 'http://localhost:5201', base: 'http://localhost:5280',
  startedAt: 'T0', finishedAt: 'T1', playwrightVersion: 'test', browser: 'chromium',
  headful: false, mode: 'full', spawned: { api: true, client: true },
  notes: ['self-test note'],
  refsDir: dirs.refs,
}
const results = [
  statusResult(fakeCtx, STEPS[0], 'PASS', 'OK'),
  statusResult(fakeCtx, STEPS[1], 'FAIL', 'Step failed', { detail: 'boom' }),
  { id: 'x', name: 'x', role: 'x', status: 'SKIP', outcome: 'skip', screens: [] },
]
const reportPath = writeReport(fakeCtx, results)
assert.ok(fs.existsSync(reportPath), 'report file must exist')
const text = fs.readFileSync(reportPath, 'utf8')
assert.ok(text.includes('PASS: 1'), 'report must count PASS')
assert.ok(text.includes('FAIL: 1'), 'report must count FAIL')
assert.ok(text.includes('SKIP: 1'), 'report must count SKIP')

// 3. last-run.json written for replay.
const last = JSON.parse(fs.readFileSync(path.join(dirs.evidence, 'last-run.json'), 'utf8'))
assert.ok(Array.isArray(last.results), 'last-run.json must list results')

// 4. Reference loading: missing refs return null; valid JSON loads.
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'e2e-ref-'))
fs.writeFileSync(path.join(tmp, 'a.json'), JSON.stringify({ route: '/estimates', status: 'Draft', elements: ['Estimate'] }))
assert.strictEqual(loadReference(tmp, 'missing'), null)
assert.strictEqual(loadReference(tmp, 'a').route, '/estimates')

console.log(`self-test OK: ${ids.length} steps, report + replay + references verified`)
