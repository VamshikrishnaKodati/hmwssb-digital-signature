const db = require('../config/db');

function currentFY() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 4 ? `${y}-${String((y + 1) % 100).padStart(2, '0')}` : `${y - 1}-${String(y % 100).padStart(2, '0')}`;
}

async function generateFcnNo(financialYear) {
  const fy = financialYear || currentFY();
  const seq = await db.query(`SELECT nextval('"FCN_Seq"') AS n`);
  const n = Number(seq.rows[0].n);
  return `FCN/${fy}/${String(n).padStart(4, '0')}`;
}

module.exports = { generateFcnNo, currentFY };
