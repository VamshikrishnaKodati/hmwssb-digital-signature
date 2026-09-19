const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');
const { estimateInScope } = require('../services/locationScope');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'estimate-docs');
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB per file
const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'docx']);

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS "EstimateDocuments" (
    "DocumentID" SERIAL PRIMARY KEY,
    "EstimateID" INTEGER REFERENCES "EstimateHeader"("EstimateID") ON DELETE CASCADE,
    "PendingKey" VARCHAR(64),
    "OriginalName" VARCHAR(255) NOT NULL,
    "MimeType" VARCHAR(128) NOT NULL,
    "StoredName" VARCHAR(255) NOT NULL,
    "SizeBytes" INTEGER NOT NULL,
    "UploadedBy" INTEGER,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

let ensureTablePromise;
function ensureTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await db.query(CREATE_TABLE);
      // Pending uploads never assigned to an estimate are dead data; sweep them.
      const { rows } = await db.query(
        `DELETE FROM "EstimateDocuments"
         WHERE "EstimateID" IS NULL AND "CreatedAt" < now() - interval '1 day' RETURNING "StoredName"`
      );
      for (const r of rows) {
        const p = path.join(UPLOADS_DIR, r.StoredName);
        if (fs.existsSync(p)) fs.rmSync(p);
      }
    })().catch((err) => {
      ensureTablePromise = undefined;
      throw err;
    });
  }
  return ensureTablePromise;
}

function extensionOf(fileName) {
  const m = /\.([A-Za-z0-9]+)$/.exec(fileName || '');
  return m ? m[1].toLowerCase() : '';
}

function safeOriginalName(fileName) {
  return String(fileName || '').split(/[\\/]/).pop().replace(/[\r\n"]/g, '').slice(0, 255);
}

async function requireEstimateScope(user, estimateId) {
  if (!estimateId) return null;
  const { rows } = await db.query('SELECT * FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
  if (rows.length === 0) return null;
  const header = rows[0];
  if (!(await estimateInScope(user, header))) {
    const err = new Error('This estimate is outside your assigned scope');
    err.status = 403;
    throw err;
  }
  return header;
}

async function attach(estimateId, pendingKey) {
  const { rows } = await db.query(
    'UPDATE "EstimateDocuments" SET "EstimateID" = $1, "PendingKey" = NULL WHERE "PendingKey" = $2 AND "EstimateID" IS NULL RETURNING *',
    [estimateId, pendingKey]
  );
  return rows;
}

exports.upload = async (req, res, next) => {
  try {
    await ensureTable();
    const { estimateId, pendingKey, fileName, mimeType, data } = req.body || {};
    const originalName = safeOriginalName(fileName);
    const ext = extensionOf(originalName);

    if (!originalName || !ALLOWED_EXT.has(ext)) {
      return res.status(400).json({ error: 'Only PDF, JPG, PNG and DOCX files are allowed.' });
    }
    if (!data) return res.status(400).json({ error: 'No file content provided.' });
    if (estimateId) await requireEstimateScope(req.user, estimateId);
    if (pendingKey && pendingKey.length > 64) return res.status(400).json({ error: 'Invalid pending key.' });

    const buffer = Buffer.from(data, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
      return res.status(400).json({ error: 'File exceeds the 15 MB limit.' });
    }

    const storedName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, storedName), buffer);

    const { rows } = await db.query(
      `INSERT INTO "EstimateDocuments" ("EstimateID", "PendingKey", "OriginalName", "MimeType", "StoredName", "SizeBytes", "UploadedBy")
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING "DocumentID", "EstimateID", "PendingKey", "OriginalName", "MimeType", "SizeBytes", "CreatedAt"`,
      [estimateId || null, pendingKey || null, originalName, mimeType || 'application/octet-stream', storedName, buffer.length, req.user.UserID || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

exports.assign = async (req, res, next) => {
  try {
    await ensureTable();
    const { pendingKey, estimateId } = req.body || {};
    if (!pendingKey || !estimateId) return res.status(400).json({ error: 'pendingKey and estimateId are required.' });
    const header = await requireEstimateScope(req.user, estimateId);
    if (!header) return res.status(404).json({ error: 'Estimate not found' });

    const attached = await attach(estimateId, pendingKey);
    res.json({ attached: attached.length });
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    await ensureTable();
    const { estimateId } = req.query;
    if (!estimateId) return res.status(400).json({ error: 'estimateId is required.' });
    const header = await requireEstimateScope(req.user, estimateId);
    if (!header) return res.status(404).json({ error: 'Estimate not found' });

    const { rows } = await db.query(
      `SELECT "DocumentID", "EstimateID", "OriginalName", "MimeType", "SizeBytes", "CreatedAt"
       FROM "EstimateDocuments" WHERE "EstimateID" = $1 ORDER BY "CreatedAt" DESC, "DocumentID" DESC`,
      [estimateId]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.file = async (req, res, next) => {
  try {
    await ensureTable();
    const { rows } = await db.query(
      `SELECT d.*, e."WardID" FROM "EstimateDocuments" d
       JOIN "EstimateHeader" e ON e."EstimateID" = d."EstimateID"
       WHERE d."DocumentID" = $1 AND d."EstimateID" IS NOT NULL`,
      [req.params.docId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    const doc = rows[0];
    await requireEstimateScope(req.user, doc.EstimateID);

    const filePath = path.join(UPLOADS_DIR, doc.StoredName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on server' });
    res.setHeader('Content-Type', doc.MimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.OriginalName}"`);
    res.send(fs.readFileSync(filePath));
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await ensureTable();
    const { rows } = await db.query('SELECT * FROM "EstimateDocuments" WHERE "DocumentID" = $1', [req.params.docId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    const doc = rows[0];
    if (doc.EstimateID) await requireEstimateScope(req.user, doc.EstimateID);

    const filePath = path.join(UPLOADS_DIR, doc.StoredName);
    if (fs.existsSync(filePath)) fs.rmSync(filePath);
    await db.query('DELETE FROM "EstimateDocuments" WHERE "DocumentID" = $1', [req.params.docId]);
    res.json({ deleted: true });
  } catch (err) { next(err); }
};