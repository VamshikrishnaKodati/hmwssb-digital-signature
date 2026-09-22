// Work progress photo uploads.
// Follows the estimate-document upload pattern (base64 JSON, no multipart),
// restricted to image formats with magic-number validation so empty/corrupted
// or renamed files are rejected. Photos are appended per estimate, never
// replaced, and keyed to the WorkID of the estimate at upload time.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');
const { estimateInScope } = require('../services/locationScope');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'work-progress-photos');
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per image
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS "WorkProgressImages" (
    "PhotoID"      SERIAL PRIMARY KEY,
    "EstimateID"   INTEGER NOT NULL REFERENCES "EstimateHeader"("EstimateID") ON DELETE CASCADE,
    "WorkID"       TEXT,
    "OriginalName" VARCHAR(255) NOT NULL,
    "MimeType"     VARCHAR(128) NOT NULL,
    "StoredName"   VARCHAR(255) NOT NULL,
    "SizeBytes"    INTEGER NOT NULL DEFAULT 0,
    "UploadedBy"   INTEGER REFERENCES "Users"("UserID"),
    "UploadedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

let ensureTablePromise;
function ensureTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = db.query(CREATE_TABLE).catch((err) => {
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

// Magic-number check for the allowed formats. Rejects empty/corrupted content
// and renamed non-image files even when the extension looks valid.
function isValidImageExt(buffer, ext) {
  if (!buffer) return false;
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'png':
      return buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e &&
             buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a;
    case 'webp':
      return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    case 'gif':
      return buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'GIF8';
    default:
      return false;
  }
}

const MIME_BY_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

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

exports.upload = async (req, res, next) => {
  try {
    await ensureTable();
    const { estimateId, fileName, data } = req.body || {};
    const originalName = safeOriginalName(fileName);
    const ext = extensionOf(originalName);

    if (!originalName || !ALLOWED_EXT.has(ext)) {
      return res.status(400).json({ error: 'Please upload a valid JPG, JPEG, PNG or WEBP image.' });
    }
    if (data === undefined || data === null) return res.status(400).json({ error: 'No image content provided.' });
    const header = await requireEstimateScope(req.user, estimateId);
    if (!header) return res.status(404).json({ error: 'Estimate not found' });

    const buffer = Buffer.from(data, 'base64');
    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Please upload a valid JPG, JPEG, PNG or WEBP image.' });
    }
    if (buffer.length > MAX_BYTES) {
      return res.status(400).json({ error: 'Image exceeds the 10 MB limit.' });
    }
    if (!isValidImageExt(buffer, ext)) {
      return res.status(400).json({ error: 'Please upload a valid JPG, JPEG, PNG or WEBP image.' });
    }

    const storedName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, storedName), buffer);

    const { rows } = await db.query(
      `INSERT INTO "WorkProgressImages" ("EstimateID", "WorkID", "OriginalName", "MimeType", "StoredName", "SizeBytes", "UploadedBy")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING "PhotoID", "EstimateID", "WorkID", "OriginalName", "MimeType", "SizeBytes", "UploadedAt"`,
      [estimateId, header.WorkID || null, originalName, MIME_BY_EXT[ext], storedName, buffer.length, req.user.UserID || null]
    );
    res.status(201).json(rows[0]);
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
      `SELECT p."PhotoID", p."EstimateID", p."WorkID", p."OriginalName", p."MimeType", p."SizeBytes",
              p."UploadedAt", u."Name" AS "UploadedByName"
       FROM "WorkProgressImages" p
       LEFT JOIN "Users" u ON u."UserID" = p."UploadedBy"
       WHERE p."EstimateID" = $1
       ORDER BY p."UploadedAt" DESC, p."PhotoID" DESC`,
      [estimateId]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.file = async (req, res, next) => {
  try {
    await ensureTable();
    const { rows } = await db.query(
      'SELECT * FROM "WorkProgressImages" WHERE "PhotoID" = $1',
      [req.params.photoId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Photo not found' });
    const photo = rows[0];
    await requireEstimateScope(req.user, photo.EstimateID);

    const filePath = path.join(UPLOADS_DIR, photo.StoredName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on server' });
    res.setHeader('Content-Type', photo.MimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${photo.OriginalName}"`);
    res.send(fs.readFileSync(filePath));
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await ensureTable();
    const { rows } = await db.query('SELECT * FROM "WorkProgressImages" WHERE "PhotoID" = $1', [req.params.photoId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Photo not found' });
    const photo = rows[0];
    await requireEstimateScope(req.user, photo.EstimateID);

    const filePath = path.join(UPLOADS_DIR, photo.StoredName);
    if (fs.existsSync(filePath)) fs.rmSync(filePath);
    await db.query('DELETE FROM "WorkProgressImages" WHERE "PhotoID" = $1', [req.params.photoId]);
    res.json({ deleted: true });
  } catch (err) { next(err); }
};