const db = require('../config/db');

function currentFY() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 4 ? `${y}-${String((y + 1) % 100).padStart(2, '0')}` : `${y - 1}-${String(y % 100).padStart(2, '0')}`;
}

async function generateTsNo() {
  const fy = currentFY();
  const prefix = `TS/${fy}/`;
  const res = await db.query(
    `SELECT "TSNo" FROM "TechnicalSanction" WHERE "TSNo" LIKE $1 ORDER BY "TSNo" DESC LIMIT 1`,
    [prefix + '%']
  );
  let seq = 1;
  if (res.rows.length) {
    const last = res.rows[0].TSNo.split('/').pop();
    const n = parseInt(last, 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

module.exports = { generateTsNo, currentFY };
