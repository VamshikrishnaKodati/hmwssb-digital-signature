'use strict'
const fs = require('fs')
const path = require('path')

// Load Figma-captured references for a step. A reference is a JSON sidecar
// (`<stepId>.json`) optionally backed by a PNG screenshot (`<stepId>.png`).
// The sidecar carries the textual/structural contract (route, status, key
// element names) so the runner can check it without pixel comparison.
function loadReference(refsDir, stepId) {
  const json = path.join(refsDir, `${stepId}.json`)
  if (!fs.existsSync(json)) return null
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(json, 'utf8'))
  } catch (e) {
    return { stepId, error: `unparsable reference: ${e.message}` }
  }
  const png = path.join(refsDir, `${stepId}.png`)
  return { stepId, ...parsed, image: fs.existsSync(png) ? png : null }
}

function collectReferences(refsDir, stepIds) {
  const found = {}
  const missing = []
  for (const id of stepIds) {
    const ref = loadReference(refsDir, id)
    if (ref) found[id] = ref
    else missing.push(id)
  }
  return { found, missing }
}

// Structural check: every element named in the reference must be present in
// the live DOM and free of horizontal overflow (per Figma contract). No pixel
// comparison in v1 — defer to pixelmatch when the reference set is frozen.
function checkStructure(ctx, stepId) {
  const ref = loadReference(ctx.refsDir, stepId)
  if (!ref) return { checked: false, reason: `no reference captured for ${stepId}` }
  const issues = []
  if (Array.isArray(ref.elements)) {
    for (const el of ref.elements) {
      const count = ctx.page.locator(`text="${el}"`).count()
      if (count === 0) issues.push(`missing element "${el}"`)
    }
  }
  const over = ctx.page.evaluate(() => {
    const el = document.querySelector('#app-main') || document.documentElement
    return el.scrollWidth > el.clientWidth + 1
  })
  if (over) issues.push('horizontal overflow detected')
  return { checked: true, issues, expectedRoute: ref.route, expectedStatus: ref.status }
}

module.exports = { loadReference, collectReferences, checkStructure }
