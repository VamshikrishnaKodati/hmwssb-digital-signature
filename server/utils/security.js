// server/utils/security.js
// Security helpers: rate limiting, password audit, JWT validation

const db = require('../config/db');

// ── Login rate limiting ───────────────────────────────────────────────────────
// In-memory store (lightweight, single-process). For production use Redis.
const loginAttempts = new Map(); // key: username|ip → { count, lockoutUntil }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function getLoginKey(username, ip) {
  return (username || '').toLowerCase() + '|' + (ip || '0.0.0.0');
}

function checkLoginRateLimit(username, ip) {
  const key = getLoginKey(username, ip);
  const record = loginAttempts.get(key);
  if (!record) return { allowed: true, attempts: 0, lockoutUntil: null };
  if (record.lockoutUntil && new Date(record.lockoutUntil) > new Date()) {
    return { allowed: false, attempts: record.count, lockoutUntil: record.lockoutUntil };
  }
  return { allowed: true, attempts: record.count, lockoutUntil: null };
}

function recordLoginAttempt(username, ip, success) {
  const key = getLoginKey(username, ip);
  if (success) {
    loginAttempts.delete(key);
    return;
  }
  const record = loginAttempts.get(key) || { count: 0, lockoutUntil: null };
  record.count++;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockoutUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
  }
  loginAttempts.set(key, record);
}

// ── Login audit ───────────────────────────────────────────────────────────────
async function auditLogin(username, ip, success, failureReason) {
  try {
    await db.query(
      `INSERT INTO "LoginAudit" ("Username","IPAddress","Success","FailureReason")
       VALUES ($1,$2,$3,$4)`,
      [username, ip || null, success, failureReason || null]
    );
  } catch (_) {}
}

// ── Password change audit ─────────────────────────────────────────────────────
async function auditPasswordChange(userId, actorId) {
  try {
    await db.query(
      `INSERT INTO "PasswordChangeAudit" ("UserID","ActorID") VALUES ($1,$2)`,
      [userId, actorId]
    );
  } catch (_) {}
}

// ── Mass assignment protection ─────────────────────────────────────────────────
// Fields that clients should never set directly
const PROTECTED_FIELDS = [
  'CreatedBy', 'CurrentOwner', 'CreatedDate', 'LastModifiedDate',
  'Version', 'GrandTotal', 'Status', 'ApprovedBy', 'VerifiedBy',
  'RecommendedBy', 'EscalationLevel', 'LastEscalatedAt',
  'SlaStartedAt', 'SlaDueAt', 'SlaStatus',
];

function stripProtectedFields(body) {
  if (!body || typeof body !== 'object') return body;
  const clean = { ...body };
  for (const field of PROTECTED_FIELDS) {
    delete clean[field];
  }
  return clean;
}

// ── JWT secret validation ─────────────────────────────────────────────────────
function validateJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('FATAL: JWT_SECRET environment variable is required in production');
      process.exit(1);
    }
    console.warn('WARNING: Using default JWT_SECRET. Set JWT_SECRET environment variable.');
    return 'hmwssb-jwt-secret-key-2024';
  }
  return secret;
}

module.exports = {
  checkLoginRateLimit,
  recordLoginAttempt,
  auditLogin,
  auditPasswordChange,
  stripProtectedFields,
  validateJwtSecret,
  MAX_ATTEMPTS,
  LOCKOUT_MS,
};
