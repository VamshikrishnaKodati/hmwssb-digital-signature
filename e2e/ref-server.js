'use strict'
const http = require('http')
const fs = require('fs')
const path = require('path')

// Tiny companion server for the Figma plugin: the plugin sandbox cannot call
// the app or write files, so it POSTs captured reference frames here and the
// e2e runner reads them from e2e/references/*.json|png.
const REFS_DIR = path.join(__dirname, 'references')
fs.mkdirSync(REFS_DIR, { recursive: true })
const PORT = parseInt(process.env.REF_SERVER_PORT || '4725', 10)

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const url = req.url.replace(/\/+$/, '')
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  res.setHeader('Access-Control-Allow-Origin', cors['Access-Control-Allow-Origin'])
  res.setHeader('Access-Control-Allow-Methods', cors['Access-Control-Allow-Methods'])
  res.setHeader('Access-Control-Allow-Headers', cors['Access-Control-Allow-Headers'])
  if (req.method === 'OPTIONS') return res.writeHead(204).end()

  const m = url.match(/^\/refs\/([A-Za-z0-9_-]+)(?:\/(image))?$/)
  if (!m) {
    res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'not found' }))
    return
  }
  const [, stepId, isImage] = m

  if (req.method === 'PUT') {
    const body = await readBody(req)
    if (isImage) {
      fs.writeFileSync(path.join(REFS_DIR, `${stepId}.png`), body)
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, file: `${stepId}.png` }))
    } else {
      fs.writeFileSync(path.join(REFS_DIR, `${stepId}.json`), body)
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, file: `${stepId}.json` }))
    }
    return
  }

  if (req.method === 'GET') {
    const file = path.join(REFS_DIR, isImage ? `${stepId}.png` : `${stepId}.json`)
    if (!fs.existsSync(file)) return res.writeHead(404).end('not found')
    if (isImage) { res.setHeader('Content-Type', 'image/png'); return res.end(fs.readFileSync(file)) }
    res.setHeader('Content-Type', 'application/json')
    return res.end(fs.readFileSync(file))
  }

  res.writeHead(405).end('method not allowed')
})

server.listen(PORT, () => {
  console.log(`Reference server listening on http://localhost:${PORT} → ${REFS_DIR}`)
  console.log('  PUT /refs/<stepId>          JSON sidecar (route, status, elements)')
  console.log('  PUT /refs/<stepId>/image    PNG screenshot')
  console.log('  GET /refs/<stepId>          read back a reference')
})
