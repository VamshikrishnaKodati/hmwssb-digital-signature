const db = require('../config/db');

function currentFY() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 4 ? `${y}-${String((y + 1) % 100).padStart(2, '0')}` : `${y - 1}-${String(y % 100).padStart(2, '0')}`;
}

// Compute the next tender number for a financial year. Takes an OPTIONAL
// client/conn: when provided it runs against that connection's open
// transaction AND takes the fixed advisory lock on it, so the number stays
// reserved until the caller commits — the caller must INSERT the Tender row
// inside the same transaction/lock or the number can still be reused by a
// concurrent process. With no client it self-manages a transaction (for
// callers that don't immediately persist, e.g. tests) which is only safe when
// nothing else generates numbers concurrently for the same year.
async function computeTenderNo(conn, financialYear) {
  const fy = financialYear || currentFY();
  const prefix = `eTNO/${fy}/`;
  await conn.query('SELECT pg_advisory_xact_lock(736254)');
  const res = await conn.query(
    `SELECT "TenderNo" FROM "Tender" WHERE "TenderNo" LIKE $1 ORDER BY "TenderNo" DESC LIMIT 1`,
    [prefix + '%']
  );
  let seq = 1;
  if (res.rows.length) {
    const last = res.rows[0].TenderNo.split('/').pop();
    const n = parseInt(last, 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function generateTenderNo(financialYear, conn) {
  if (conn) return computeTenderNo(conn, financialYear);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const no = await computeTenderNo(client, financialYear);
    await client.query('COMMIT');
    return no;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    try { client.release(); } catch (_) {}
  }
}

module.exports = { generateTenderNo, currentFY };