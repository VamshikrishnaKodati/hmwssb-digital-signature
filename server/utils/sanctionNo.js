const db = require('../config/db');

// Financial year covering the current date: April 2026 - March 2027 -> "2026-27".
function getFinancialYear() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 4
    ? `${y}-${String((y + 1) % 100).padStart(2, '0')}`
    : `${y - 1}-${String(y % 100).padStart(2, '0')}`;
}

const SEQUENCE_WIDTH = Math.max(1, parseInt(process.env.SANCTION_NO_SEQ_WIDTH || '4', 10) || 4);

// Numbering format is configurable per type (default "AS/{FY}/{SEQ}" /
// "TS/{FY}/{SEQ}"). Tokens: {TYPE} {FY} {SEQ}. A Corporation/Zone/Year prefix
// can be added via AS_NO_FORMAT / TS_NO_FORMAT env vars.
function formatSanctionNo(type, fy, seq) {
  const template = (type === 'AS' && process.env.AS_NO_FORMAT)
    || (type === 'TS' && process.env.TS_NO_FORMAT)
    || `${type}/{FY}/{SEQ}`;
  return template
    .replace(/\{TYPE\}/g, type)
    .replace(/\{FY\}/g, fy)
    .replace(/\{SEQ\}/g, String(seq).padStart(SEQUENCE_WIDTH, '0'));
}

// Claims the next sanction number for (type, financialYear) against a client/
// connection. Runs inside the caller's transaction: the atomic +1 UPDATE takes
// a row lock on the (Type, FY) counter row, serializing concurrent approvals so
// two approvals can never receive the same number. The counter is never
// decremented, so a deleted/rejected/rolled-back sanction never causes a number
// to be reused.
async function claimSanctionNumber(client, type, financialYear) {
  const fy = /^\d{4}-\d{2}$/.test(financialYear || '') ? financialYear : getFinancialYear();
  await client.query(
    `INSERT INTO "SanctionSequence" ("Type","FinancialYear","LastSequence")
     VALUES ($1,$2,0)
     ON CONFLICT ("Type","FinancialYear") DO NOTHING`,
    [type, fy]
  );
  const res = await client.query(
    `UPDATE "SanctionSequence" SET "LastSequence" = "LastSequence" + 1
     WHERE "Type" = $1 AND "FinancialYear" = $2
     RETURNING "LastSequence"`,
    [type, fy]
  );
  const sequence = Number(res.rows[0].LastSequence);
  return {
    type,
    financialYear: fy,
    sequence,
    sanctionNo: formatSanctionNo(type, fy, sequence),
  };
}

// Generates the next sanction number for a type ('AS' or 'TS'). When the client
// argument is provided the caller must be inside its own open transaction and
// must persist the approval in the same transaction, so the claimed number is
// committed atomically with the approval. With no client, a short self-managed
// transaction is used (safe only when nothing else generates concurrently).
async function generateSanctionNo(client, type, financialYear) {
  if (client) return claimSanctionNumber(client, type, financialYear);
  const c = await db.getClient();
  try {
    await c.query('BEGIN');
    const result = await claimSanctionNumber(c, type, financialYear);
    await c.query('COMMIT');
    return result;
  } catch (err) {
    try { await c.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    try { c.release(); } catch (_) {}
  }
}

module.exports = { generateSanctionNo, claimSanctionNumber, getFinancialYear, formatSanctionNo };