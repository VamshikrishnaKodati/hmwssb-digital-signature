const db = require('../config/db');
const { generateOtp, hashOtp } = require('../utils/otp');
const { startSla, stopSla, getSlaStatus } = require('../utils/sla');

const EDITOR_ROLES = ['BillingOfficer', 'SiteEngineer'];

// Statuses a Billing Officer can submit (fresh draft or corrected return).
const SUBMITTABLE_STATUSES = ['Draft', 'ReturnedToBiller'];

// Per-stage check ladder. GM check forwards the bill to Finance (finance then
// owns it via its existing FinanceWorkflow — never duplicated here).
const CHECK_STEPS = [
  {
    statuses: ['SubmittedToManager', 'ReturnedToManager'],
    role: 'Manager', nextStatus: 'ManagerChecked', nextDesignation: 'DGM',
    slaStage: 'ManagerChecked', action: 'MANAGER_BILL_CHECKED',
    display: 'With Manager',
  },
  {
    statuses: ['ManagerChecked', 'ReturnedToDGM'],
    role: 'DGM', nextStatus: 'DGMChecked', nextDesignation: 'GM',
    slaStage: 'DGMChecked', action: 'DGM_BILL_CHECKED',
    display: 'With DGM',
  },
  {
    statuses: ['DGMChecked'],
    role: 'GM', nextStatus: 'SubmittedToFinance', nextDesignation: 'FinanceClerk',
    slaStage: 'SubmittedToFinance', action: 'GM_BILL_CHECKED',
    display: 'With GM',
  },
];

const RETURN_STEPS = {
  SubmittedToManager: { role: 'Manager', targetStatus: 'ReturnedToBiller', action: 'MANAGER_BILL_RETURNED', targetLabel: 'Billing Officer' },
  ManagerChecked:     { role: 'DGM',     targetStatus: 'ReturnedToManager', action: 'DGM_BILL_RETURNED',     targetLabel: 'Manager' },
  DGMChecked:         { role: 'GM',      targetStatus: 'ReturnedToDGM',     action: 'GM_BILL_RETURNED',       targetLabel: 'DGM' },
};

function canEdit(user) { return EDITOR_ROLES.includes(user.Designation); }
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function round3(n) { return Math.round((Number(n) || 0) * 1000) / 1000; }

async function auditLog(billId, estimateId, userId, action, remarks) {
  await db.query(
    `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
     VALUES ($1,$2,$3,$4)`,
    [estimateId, userId, `${action} (Bill ${billId})`, remarks]
  );
}

async function billWorkflowLog(billId, fromUserId, toUserId, action, stage, remarks) {
  await db.query(
    `INSERT INTO "BillWorkflow" ("BillID","FromUserID","ToUserID","Action","Stage","Remarks")
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [billId, fromUserId, toUserId, action, stage, remarks]
  );
}

async function billNotify(estimateId, toUserId, type, message) {
  if (!toUserId) return;
  await db.query(
    `INSERT INTO "Notification" ("EstimateID","ToUserID","Type","Message") VALUES ($1,$2,$3,$4)`,
    [estimateId, toUserId, type, message]
  );
}

async function findUserByDesignation(designation) {
  const r = await db.query(
    `SELECT "UserID","Name","Email" FROM "Users" WHERE "Designation" = $1 AND "IsActive" = TRUE ORDER BY "UserID" LIMIT 1`,
    [designation]
  );
  return r.rows[0] || null;
}

async function fetchBill(billId, include = '*') {
  const r = await db.query(`SELECT ${include} FROM "Billing" WHERE "BillID" = $1`, [billId]);
  return r.rows[0] || null;
}

// Display-only financial summary for the review workbench. Aggregates EXISTING
// columns only — never mutates or redefines any business calculation.
async function getFinancialSummary(billId) {
  const bill = await fetchBill(billId);
  if (!bill) return null;
  const prev = await db.query(
    `SELECT COALESCE(SUM(bi."Amount"),0)::float AS "prevBilled"
     FROM "BillItems" bi JOIN "Billing" b ON b."BillID" = bi."BillID"
     WHERE b."EstimateID" = $1 AND b."BillID" <> $2 AND b."Status" <> 'Draft'`,
    [bill.EstimateID, bill.BillID]
  );
  const prevBilled = prev.rows[0] ? Number(prev.rows[0].prevBilled) : 0;
  const currentNet = Number(bill.NetAmount || 0);
  const cumulative = round2(prevBilled + currentNet);
  const approved = Number(bill.ApprovedEstimateAmount || bill.EstimateAmount || 0);
  return {
    approvedEstimate: approved,
    previousBilled: round2(prevBilled),
    currentBill: currentNet,
    cumulativeBilled: cumulative,
    remainingBalance: approved ? Math.max(0, round2(approved - cumulative)) : null,
  };
}

// ── Bill item derivation ──────────────────────────────────────────────────────
// Current qty = (max verified cumulative measurement) - (previously billed
// cumulative on other bills for the same estimate). Amount = current × rate.

async function deriveItems(estimateId, excludeBillId) {
  const meas = (await db.query(
    `SELECT mb."DetailID", MAX(mb."CumulativeQty") AS "Measured"
     FROM "MeasurementBook" mb
     WHERE mb."EstimateID" = $1 AND mb."Status" = 'Verified' AND mb."DetailID" IS NOT NULL
     GROUP BY mb."DetailID"`,
    [estimateId]
  )).rows;
  const measMap = Object.fromEntries(meas.map(r => [r.DetailID, Number(r.Measured || 0)]));

  const prev = (await db.query(
    `SELECT bi."DetailID", COALESCE(SUM(bi."CumulativeQty"), 0) AS "Prev"
     FROM "BillItems" bi
     JOIN "Billing" b ON b."BillID" = bi."BillID"
     WHERE b."EstimateID" = $1 AND bi."DetailID" IS NOT NULL
       AND ($2::int IS NULL OR b."BillID" <> $2)
     GROUP BY bi."DetailID"`,
    [estimateId, excludeBillId || null]
  )).rows;
  const prevMap = Object.fromEntries(prev.map(r => [r.DetailID, Number(r.Prev)]));

  const items = (await db.query(
    `SELECT ed."DetailID", ed."Qty" AS "EstimateQty", ed."Rate", ed."Unit", ed."Category",
            im."ItemCode", im."Description",
            COALESCE(im."ShortDescription", im."Description") AS "ItemName"
     FROM "EstimateDetails" ed
     LEFT JOIN "ItemMaster" im ON im."ItemID" = ed."ItemID"
     WHERE ed."EstimateID" = $1
     ORDER BY ed."DetailID"`,
    [estimateId]
  )).rows;

  return items.map(d => {
    const estimateQty = round3(d.EstimateQty);
    const previousQty = round3(prevMap[d.DetailID] || 0);
    const currentQty = round3(Math.max(0, (measMap[d.DetailID] || 0) - previousQty));
    const cumulativeQty = round3(previousQty + currentQty);
    return {
      DetailID: d.DetailID, ItemCode: d.ItemCode, ItemName: d.ItemName, Description: d.Description,
      Unit: d.Unit, Category: d.Category, Rate: round2(d.Rate), EstimateQty: estimateQty,
      PreviousQty: previousQty, CurrentQty: currentQty, CumulativeQty: cumulativeQty,
      BalanceQty: round3(Math.max(0, estimateQty - cumulativeQty)),
      Amount: round2(currentQty * Number(d.Rate)),
    };
  });
}

function applyItemOverrides(items, overrides) {
  if (!Array.isArray(overrides) || !overrides.length) return items;
  const byId = Object.fromEntries(items.map(i => [i.DetailID, i]));
  for (const o of overrides) {
    const item = byId[o && o.DetailID];
    if (!item || o.CurrentQty == null) continue;
    const currentQty = round3(Math.max(0, Number(o.CurrentQty)));
    item.CurrentQty = currentQty;
    item.CumulativeQty = round3(item.PreviousQty + currentQty);
    item.BalanceQty = round3(Math.max(0, Number(item.EstimateQty) - item.CumulativeQty));
    item.Amount = round2(currentQty * Number(item.Rate));
  }
  return items;
}

async function replaceBillItems(client, billId, items) {
  await client.query('DELETE FROM "BillItems" WHERE "BillID" = $1', [billId]);
  for (const it of items) {
    await client.query(
      `INSERT INTO "BillItems" ("BillID","DetailID","ItemCode","ItemName","Description","Unit","Category",
                                "Rate","EstimateQty","PreviousQty","CurrentQty","CumulativeQty","BalanceQty","Amount")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [billId, it.DetailID || null, it.ItemCode, it.ItemName, it.Description, it.Unit, it.Category,
       it.Rate, it.EstimateQty, it.PreviousQty, it.CurrentQty, it.CumulativeQty, it.BalanceQty, it.Amount]
    );
  }
}

// ── OTP ───────────────────────────────────────────────────────────────────────

async function issueOtp(bill, userId, purpose, label, userName) {
  const cooldownSec = Math.max(parseInt(process.env.OTP_RESEND_COOLDOWN || '30', 10), 10);
  const lastOtp = (await db.query(
    `SELECT "CreatedDate" FROM "SignatureOTP"
     WHERE "EstimateID" = $1 AND "Purpose" = $2 AND "Verified" = FALSE
     ORDER BY "OTPID" DESC LIMIT 1`,
    [bill.EstimateID, purpose]
  )).rows[0];
  if (lastOtp) {
    const elapsedSec = (Date.now() - new Date(lastOtp.CreatedDate).getTime()) / 1000;
    if (elapsedSec < cooldownSec) return { cooldown: Math.ceil(cooldownSec - elapsedSec) };
  }

  await db.query(
    `DELETE FROM "SignatureOTP" WHERE "EstimateID" = $1 AND "Purpose" = $2 AND "Verified" = FALSE`,
    [bill.EstimateID, purpose]
  );
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await db.query(
    `INSERT INTO "SignatureOTP" ("EstimateID","UserID","CodeHash","Purpose","ExpiresAt")
     VALUES ($1,$2,$3,$4,$5)`,
    [bill.EstimateID, userId, hashOtp(code), purpose, expiresAt]
  );
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[OTP][DEV] Bill ${label} OTP for bill ${bill.BillNo || bill.BillID} (user ${userName}): ${code}`);
    try {
      const { logOtp } = require('../utils/devOtpLog');
      logOtp(`BILL_${bill.BillID}`, purpose, code);
      if (bill.BillNo) logOtp(`BILL_${bill.BillNo}`, purpose, code);
      logOtp(String(bill.BillID), purpose, code);
    } catch {}
  }
  return { ok: true };
}

async function verifyOtpFor(bill, user, purpose, otpCode) {
  if (!otpCode || !String(otpCode).trim())
    return { error: 'OTP is required to confirm this action' };
  const otpRow = (await db.query(
    `SELECT * FROM "SignatureOTP"
     WHERE "EstimateID" = $1 AND "UserID" = $2 AND "Purpose" = $3 AND "Verified" = FALSE
     ORDER BY "OTPID" DESC LIMIT 1`,
    [bill.EstimateID, user.UserID, purpose]
  )).rows[0];
  if (!otpRow) return { error: 'No OTP requested. Request an OTP first.' };
  if (new Date(otpRow.ExpiresAt) < new Date())
    return { error: 'OTP has expired. Request a new OTP.' };
  if (hashOtp(String(otpCode).trim()) !== otpRow.CodeHash) {
    const attempts = otpRow.Attempts + 1;
    if (attempts >= 5) {
      await db.query('DELETE FROM "SignatureOTP" WHERE "OTPID" = $1', [otpRow.OTPID]);
      return { error: 'Too many failed attempts. Request a new OTP.' };
    }
    await db.query('UPDATE "SignatureOTP" SET "Attempts" = $1 WHERE "OTPID" = $2', [attempts, otpRow.OTPID]);
    return { error: 'Invalid OTP. Please try again.' };
  }
  const claim = (await db.query(
    `UPDATE "SignatureOTP" SET "Verified" = TRUE
     WHERE "OTPID" = $1 AND "Verified" = FALSE AND "ExpiresAt" > now()
     RETURNING "OTPID"`,
    [otpRow.OTPID]
  )).rows[0];
  if (!claim) return { error: 'OTP has already been used. Request a new OTP.' };
  return null;
}

// ── List / detail ─────────────────────────────────────────────────────────────

exports.listBillings = async (req, res, next) => {
  try {
    const { estimateId, status, createdBy, owner, preparedBy } = req.query;
    const statuses = status ? status.split(',').map(s => s.trim()).filter(Boolean) : null;
    const params = [];
    let where = '';
    const add = (value, cond) => {
      params.push(value);
      where += where ? ` AND ${cond.replace('$N', `$${params.length}`)}` : ` WHERE ${cond.replace('$N', `$${params.length}`)}`;
    };
    if (estimateId) add(parseInt(estimateId, 10), `b."EstimateID" = $N`);
    if (statuses && statuses.length) add(statuses, `b."Status" = ANY($N)`);
    if (createdBy === 'me') add(req.user.UserID, `eh."CreatedBy" = $N`);
    if (owner === 'me') add(req.user.UserID, `b."CurrentOwner" = $N`);
    if (preparedBy === 'me') add(req.user.UserID, `b."SubmittedBy" = $N`);

    const result = await db.query(
      `SELECT b.*, eh."WorkID", eh."NameOfWork", eh."EstimateNo", eh."Status" as "EstimateStatus",
              u."Name" as "SubmittedByName", cu."Name" as "CurrentOwnerName",
              bp."PaymentDate", bp."PaymentMode", bp."TransactionRef", bp."PaymentAmount"
       FROM "Billing" b
       JOIN "EstimateHeader" eh ON eh."EstimateID" = b."EstimateID"
       LEFT JOIN "Users" u ON u."UserID" = b."SubmittedBy"
       LEFT JOIN "Users" cu ON cu."UserID" = b."CurrentOwner"
       LEFT JOIN "BillingPayments" bp ON bp."BillID" = b."BillID"
       ${where}
       ORDER BY b."BillID" DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.getBilling = async (req, res, next) => {
  try {
    const billId = parseInt(req.params.id, 10);
    const bill = (await db.query(
      `SELECT b.*, eh."WorkID", eh."NameOfWork", eh."EstimateNo", eh."FinancialYear",
              eh."Status" as "EstimateStatus", eh."CreatedBy" as "EstimateCreatedBy",
              ab."GrandTotal" as "ApprovedEstimateAmount",
              ag."AgencyName", ag."ContractorName",
              u."Name" as "SubmittedByName",
              cu."Name" as "CurrentOwnerName",
              rb."Name" as "ReturnedByName"
       FROM "Billing" b
       JOIN "EstimateHeader" eh ON eh."EstimateID" = b."EstimateID"
       LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
       LEFT JOIN "Agency" ag ON ag."EstimateID" = eh."EstimateID"
       LEFT JOIN "Users" u ON u."UserID" = b."SubmittedBy"
       LEFT JOIN "Users" cu ON cu."UserID" = b."CurrentOwner"
       LEFT JOIN "Users" rb ON rb."UserID" = b."ReturnedBy"
       WHERE b."BillID" = $1`,
      [billId]
    )).rows[0];
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const items = (await db.query(
      `SELECT * FROM "BillItems" WHERE "BillID" = $1 ORDER BY "BillItemID"`,
      [billId]
    )).rows;
    const documents = (await db.query(
      `SELECT d.*, u."Name" as "UploadedByName" FROM "BillDocuments" d
       LEFT JOIN "Users" u ON u."UserID" = d."UploadedBy"
       WHERE d."BillID" = $1 ORDER BY d."DocumentID"`,
      [billId]
    )).rows;
    const history = (await db.query(
      `SELECT bw.*, f."Name" as "FromUserName", t."Name" as "ToUserName"
       FROM "BillWorkflow" bw
       LEFT JOIN "Users" f ON f."UserID" = bw."FromUserID"
       LEFT JOIN "Users" t ON t."UserID" = bw."ToUserID"
       WHERE bw."BillID" = $1 ORDER BY bw."DateTime" ASC`,
      [billId]
    )).rows;
    const audit = (await db.query(
      `SELECT "AuditID","UserID","Action","Remarks","CreatedDate" FROM "AuditLog"
       WHERE "EstimateID" = $1 ORDER BY "AuditID" DESC LIMIT 25`,
      [bill.EstimateID]
    )).rows;
    const sla = await getSlaStatus('Billing', billId);
    const financialSummary = await getFinancialSummary(billId);

    res.json({ bill, items, documents, history, audit, sla, financialSummary });
  } catch (err) { next(err); }
};

exports.previewItems = async (req, res, next) => {
  try {
    if (!canEdit(req.user))
      return res.status(403).json({ error: 'Only SiteEngineer or BillingOfficer can preview bill items' });
    const estimateId = parseInt(req.query.estimateId, 10);
    if (!estimateId) return res.status(400).json({ error: 'estimateId is required' });
    const items = await deriveItems(estimateId, req.query.excludeBillId ? parseInt(req.query.excludeBillId, 10) : null);
    res.json({ items, total: round2(items.reduce((s, i) => s + Number(i.Amount), 0)) });
  } catch (err) { next(err); }
};

// ── Create / update / delete (Billing Officer / Site Engineer) ────────────────

async function createDraftBill(estimateId, user, { BillType, BillNo, BillDate, GST, NetAmount, Measurements, Items }) {
  const items = applyItemOverrides(await deriveItems(estimateId, null), Items);
  const billAmount = round2(items.reduce((s, i) => s + Number(i.Amount), 0));
  const gst = Number(GST) || 0;
  const netAmount = NetAmount != null ? round2(Number(NetAmount)) : round2(billAmount + gst);

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const row = (await client.query(
      `INSERT INTO "Billing" ("EstimateID","BillType","BillNo","BillDate","BillAmount","GST","NetAmount","Measurements","Status","CurrentOwner","SubmittedBy")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Draft',$9,$10) RETURNING *`,
      [estimateId, BillType, BillNo || null, BillDate || null, billAmount, gst, netAmount, Measurements || null, user.UserID, user.UserID]
    )).rows[0];
    await replaceBillItems(client, row.BillID, items);
    await client.query(
      `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks") VALUES ($1,$2,$3,$4)`,
      [estimateId, user.UserID, `BILL_CREATED (Bill ${row.BillID})`,
        `Bill ${row.BillNo || row.BillID} created by ${user.Name} (${user.Designation}). Type: ${BillType}, NetAmount: ${netAmount}.`]
    );
    await client.query('COMMIT');
    return { bill: row, items };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

exports.createBilling = async (req, res, next) => {
  try {
    if (!canEdit(req.user))
      return res.status(403).json({ error: 'Only SiteEngineer or BillingOfficer can create bills' });

    const { EstimateID, BillType } = req.body;
    if (!EstimateID) return res.status(400).json({ error: 'EstimateID is required' });
    if (!BillType || !['RA', 'Final'].includes(BillType))
      return res.status(400).json({ error: 'BillType must be RA or Final' });

    const est = (await db.query('SELECT "Status" FROM "EstimateHeader" WHERE "EstimateID" = $1', [EstimateID])).rows[0];
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (est.Status !== 'WorkCompleted')
      return res.status(400).json({ error: 'Bills can only be created for WorkCompleted estimates' });

    const result = await createDraftBill(EstimateID, req.user, req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

// Idempotent "Prepare Bill": creates a real Draft bill owned by the current
// Billing Officer (PreparedBy + CurrentOwner), or reuses an existing editable
// (Draft/ReturnedToBiller) bill for the same estimate so repeated clicks never
// duplicate. Estimate stays at WorkCompleted.
exports.prepareBilling = async (req, res, next) => {
  try {
    if (!canEdit(req.user))
      return res.status(403).json({ error: 'Only SiteEngineer or BillingOfficer can prepare bills' });

    const estimateId = parseInt(req.body.EstimateID, 10);
    if (!estimateId) return res.status(400).json({ error: 'EstimateID is required' });

    const est = (await db.query('SELECT "Status" FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId])).rows[0];
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (est.Status !== 'WorkCompleted')
      return res.status(400).json({ error: 'Bill preparation requires a WorkCompleted estimate' });

    const existing = (await db.query(
      `SELECT "BillID" FROM "Billing"
       WHERE "EstimateID" = $1 AND "Status" IN ('Draft','ReturnedToBiller') AND "SubmittedBy" = $2
       ORDER BY "BillID" DESC LIMIT 1`,
      [estimateId, req.user.UserID]
    )).rows[0];

    if (existing) {
      const bill = await fetchBill(existing.BillID);
      const items = (await db.query('SELECT * FROM "BillItems" WHERE "BillID" = $1 ORDER BY "BillItemID"', [bill.BillID])).rows;
      return res.json({ bill, items, reused: true });
    }

    const result = await createDraftBill(estimateId, req.user, { BillType: 'RA' });
    res.status(201).json({ ...result, reused: false });
  } catch (err) { next(err); }
};

exports.updateBilling = async (req, res, next) => {
  try {
    if (!canEdit(req.user))
      return res.status(403).json({ error: 'Only SiteEngineer or BillingOfficer can update bills' });

    const bill = await fetchBill(Number(req.params.id));
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (!['Draft', 'ReturnedToBiller'].includes(bill.Status))
      return res.status(400).json({ error: 'Only Draft or returned bills can be edited' });

    const { BillType, BillNo, BillDate, GST, NetAmount, Measurements, Items } = req.body;
    const items = applyItemOverrides(await deriveItems(bill.EstimateID, bill.BillID), Items);
    const billAmount = round2(items.reduce((s, i) => s + Number(i.Amount), 0));
    const gst = Number(GST) || 0;
    const netAmount = NetAmount != null ? round2(Number(NetAmount)) : round2(billAmount + gst);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const row = (await client.query(
        `UPDATE "Billing" SET "BillType"=$1,"BillNo"=$2,"BillDate"=$3,"BillAmount"=$4,"GST"=$5,"NetAmount"=$6,"Measurements"=$7
         WHERE "BillID"=$8 RETURNING *`,
        [BillType || bill.BillType, BillNo || null, BillDate || null, billAmount, gst, netAmount, Measurements || bill.Measurements, bill.BillID]
      )).rows[0];
      await replaceBillItems(client, bill.BillID, items);
      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks") VALUES ($1,$2,$3,$4)`,
        [bill.EstimateID, req.user.UserID, `BILL_UPDATED (Bill ${bill.BillID})`,
          `Bill ${bill.BillNo || bill.BillID} updated by ${req.user.Name} (${req.user.Designation}). New NetAmount: ${netAmount}.`]
      );
      await client.query('COMMIT');
      res.json({ bill: row, items });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
};

exports.deleteBilling = async (req, res, next) => {
  try {
    if (!canEdit(req.user))
      return res.status(403).json({ error: 'Only SiteEngineer or BillingOfficer can delete bills' });
    const bill = await fetchBill(Number(req.params.id), '"EstimateID","Status"');
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (!['Draft', 'ReturnedToBiller'].includes(bill.Status))
      return res.status(400).json({ error: 'Only Draft or returned bills can be deleted' });
    await db.query('DELETE FROM "BillWorkflow" WHERE "BillID" = $1', [req.params.id]);
    await db.query('DELETE FROM "Billing" WHERE "BillID" = $1', [req.params.id]);
    await auditLog(req.params.id, bill.EstimateID, req.user.UserID, 'DeleteBill',
      `Bill deleted by ${req.user.Name} (${req.user.Designation}).`);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

// ── Documents ─────────────────────────────────────────────────────────────────

exports.addBillDocument = async (req, res, next) => {
  try {
    if (!canEdit(req.user))
      return res.status(403).json({ error: 'Only SiteEngineer or BillingOfficer can attach documents' });
    const { DocType, DocName, FilePath } = req.body;
    if (!DocType || !DocName)
      return res.status(400).json({ error: 'DocType and DocName are required' });
    const row = (await db.query(
      `INSERT INTO "BillDocuments" ("BillID","DocType","DocName","FilePath","UploadedBy")
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, DocType, DocName, FilePath || null, req.user.UserID]
    )).rows[0];
    res.status(201).json(row);
  } catch (err) { next(err); }
};

exports.deleteBillDocument = async (req, res, next) => {
  try {
    if (!canEdit(req.user))
      return res.status(403).json({ error: 'Only SiteEngineer or BillingOfficer can remove documents' });
    await db.query('DELETE FROM "BillDocuments" WHERE "DocumentID" = $1 AND "BillID" = $2', [req.params.docId, req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

// ── Submit (Billing Officer) ──────────────────────────────────────────────────

exports.requestSubmitOtp = async (req, res, next) => {
  try {
    if (!canEdit(req.user))
      return res.status(403).json({ error: 'Only SiteEngineer or BillingOfficer can submit bills' });
    const bill = await fetchBill(Number(req.params.id));
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (!SUBMITTABLE_STATUSES.includes(bill.Status))
      return res.status(400).json({ error: 'Only Draft or returned bills can be submitted' });

    const r = await issueOtp(bill, req.user.UserID, 'bill_submit', 'Submit', req.user.Name);
    if (r.cooldown)
      return res.status(429).json({ error: `Please wait ${r.cooldown}s before requesting a new OTP`, resendIn: r.cooldown });
    res.json({ message: 'OTP sent. It expires in 5 minutes.', expiresIn: 300 });
  } catch (err) { next(err); }
};

exports.submitBilling = async (req, res, next) => {
  try {
    if (!canEdit(req.user))
      return res.status(403).json({ error: 'Only SiteEngineer or BillingOfficer can submit bills' });
    const bill = await fetchBill(Number(req.params.id));
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (!SUBMITTABLE_STATUSES.includes(bill.Status))
      return res.status(400).json({ error: 'Only Draft or returned bills can be submitted' });

    const verifyErr = await verifyOtpFor(bill, req.user, 'bill_submit', req.body.otpCode);
    if (verifyErr) return res.status(400).json(verifyErr);

    const fresh = await fetchBill(bill.BillID);
    if (!fresh || !SUBMITTABLE_STATUSES.includes(fresh.Status))
      return res.status(409).json({ error: 'Bill has already been processed. Refresh and try again.' });

    // Guard: cumulative billed qty must never exceed approved estimate qty.
    const items = (await db.query(
      `SELECT "ItemName","CurrentQty","CumulativeQty","EstimateQty" FROM "BillItems" WHERE "BillID" = $1`,
      [bill.BillID]
    )).rows;
    const over = items.find(i => Number(i.CumulativeQty) > Number(i.EstimateQty) + 1e-6);
    if (over)
      return res.status(400).json({
        error: `Item "${over.ItemName || over.ItemCode}" exceeds estimate quantity: cumulative billed ${over.CumulativeQty} > estimated ${over.EstimateQty}. Correct the bill before submitting.`
      });

    const manager = await findUserByDesignation('Manager');
    if (!manager) return res.status(400).json({ error: 'No Manager user found in the system' });

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const upd = await client.query(
        `UPDATE "Billing"
         SET "Status"='SubmittedToManager', "CurrentStep"='Manager', "CurrentOwner"=$1,
             "SubmittedBy"=$2, "SubmissionDate"=now(),
             "PreviousStatus"=NULL, "ReturnedBy"=NULL, "ReturnedAt"=NULL, "ReturnRemarks"=NULL,
             "SlaStatus"='Normal', "EscalationLevel"=0
         WHERE "BillID"=$3 AND "Status" = ANY($4)`,
        [manager.UserID, req.user.UserID, bill.BillID, SUBMITTABLE_STATUSES]
      );
      if (upd.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Bill has already been submitted. Refresh and try again.' });
      }
      await billWorkflowLog(bill.BillID, req.user.UserID, manager.UserID, 'BILL_SUBMITTED', 'SubmittedToManager',
        `Bill ${fresh.BillNo || bill.BillID} submitted to Manager (OTP verified)`);
      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks") VALUES ($1,$2,$3,$4)`,
        [bill.EstimateID, req.user.UserID, `BILL_SUBMITTED (Bill ${bill.BillID})`,
          `Bill ${fresh.BillNo || bill.BillID} submitted by ${req.user.Name} (${req.user.Designation}) after OTP. Status: ${fresh.Status} → SubmittedToManager, With Manager.`]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await stopSla(bill.BillID, 'Billing', 'actioned');
    await startSla('Billing', 'SubmittedToManager', bill.BillID, 'Billing');
    await billNotify(bill.EstimateID, manager.UserID, 'BillSubmitted',
      `Bill ${fresh.BillNo || `#${bill.BillID}`} submitted to you. Required action: Check bill & forward (Level 1).`);

    res.json({ message: 'Bill submitted to Manager (with Manager).', status: 'SubmittedToManager', bill: await fetchBill(bill.BillID) });
  } catch (err) { next(err); }
};

// ── Check (Manager / DGM / GM, each with OTP) ─────────────────────────────────

exports.requestCheckOtp = async (req, res, next) => {
  try {
    const bill = await fetchBill(Number(req.params.id));
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    const step = CHECK_STEPS.find(s => s.role === req.user.Designation && s.statuses.includes(bill.Status));
    if (!step)
      return res.status(403).json({ error: `Action not allowed. Bill is ${bill.CurrentStep ? 'with ' + bill.CurrentStep : 'not at your stage'}.` });
    if (bill.CurrentOwner !== req.user.UserID)
      return res.status(403).json({ error: 'You are not the current owner of this bill' });

    const r = await issueOtp(bill, req.user.UserID, 'bill_check', 'Check', req.user.Name);
    if (r.cooldown)
      return res.status(429).json({ error: `Please wait ${r.cooldown}s before requesting a new OTP`, resendIn: r.cooldown });
    res.json({ message: 'OTP sent. It expires in 5 minutes.', expiresIn: 300 });
  } catch (err) { next(err); }
};

exports.checkBilling = async (req, res, next) => {
  try {
    const bill = await fetchBill(Number(req.params.id));
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    const step = CHECK_STEPS.find(s => s.role === req.user.Designation && s.statuses.includes(bill.Status));
    if (!step)
      return res.status(403).json({ error: `Action not allowed. Bill is ${bill.CurrentStep ? 'with ' + bill.CurrentStep : 'not at your stage'}.` });
    if (bill.CurrentOwner !== req.user.UserID)
      return res.status(403).json({ error: 'You are not the current owner of this bill' });

    const verifyErr = await verifyOtpFor(bill, req.user, 'bill_check', req.body.otpCode);
    if (verifyErr) return res.status(400).json(verifyErr);

    const fresh = await fetchBill(bill.BillID);
    if (!fresh) return res.status(409).json({ error: 'Bill no longer exists. Refresh and try again.' });
    const freshStep = CHECK_STEPS.find(s => s.role === req.user.Designation && s.statuses.includes(fresh.Status));
    if (!freshStep || fresh.CurrentOwner !== req.user.UserID)
      return res.status(409).json({ error: 'Bill state changed. Refresh and try again.' });

    const nextUser = await findUserByDesignation(freshStep.nextDesignation);
    if (!nextUser)
      return res.status(400).json({ error: `No ${freshStep.nextDesignation} user found in the system` });

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const upd = await client.query(
        `UPDATE "Billing"
         SET "Status"=$1, "CurrentStep"=$2, "CurrentOwner"=$3,
             "ApprovedAmount" = CASE WHEN $4 = 'GM' THEN "NetAmount" ELSE "ApprovedAmount" END,
             "PreviousStatus"=NULL, "ReturnedBy"=NULL, "ReturnedAt"=NULL, "ReturnRemarks"=NULL,
             "SlaStatus"='Normal'
         WHERE "BillID"=$5 AND "Status" = ANY($6) AND "CurrentOwner" = $7`,
        [freshStep.nextStatus, freshStep.nextDesignation, nextUser.UserID, req.user.Designation, bill.BillID, freshStep.statuses, req.user.UserID]
      );
      if (upd.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Bill state changed. Refresh and try again.' });
      }
      await billWorkflowLog(bill.BillID, req.user.UserID, nextUser.UserID, freshStep.action, freshStep.nextStatus,
        `Bill forwarded by ${req.user.Designation} to ${freshStep.nextDesignation} (OTP verified)`);
      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks") VALUES ($1,$2,$3,$4)`,
        [bill.EstimateID, req.user.UserID, `${freshStep.action} (Bill ${bill.BillID})`,
          `Bill ${fresh.BillNo || bill.BillID} checked by ${req.user.Name} (${req.user.Designation}) after OTP. Status: ${fresh.Status} → ${freshStep.nextStatus}. Forwarded to ${freshStep.nextDesignation}.`]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await stopSla(bill.BillID, 'Billing', 'actioned');
    await startSla('Billing', freshStep.slaStage, bill.BillID, 'Billing');
    await billNotify(bill.EstimateID, nextUser.UserID, 'BillCheck',
      `Bill ${fresh.BillNo || `#${bill.BillID}`} checked by ${req.user.Designation}. Required action: Review & forward. Stage: ${freshStep.nextDesignation}.`);

    res.json({ message: `Bill checked by ${req.user.Designation} and forwarded to ${freshStep.nextDesignation}.`, status: freshStep.nextStatus, bill: await fetchBill(bill.BillID) });
  } catch (err) { next(err); }
};

// ── Return to a lower stage (remarks mandatory) ───────────────────────────────

exports.returnBilling = async (req, res, next) => {
  try {
    const bill = await fetchBill(Number(req.params.id));
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const step = RETURN_STEPS[bill.Status];
    if (!step)
      return res.status(400).json({ error: `Bill cannot be returned from its current stage (${bill.Status}).` });
    if (req.user.Designation !== step.role)
      return res.status(403).json({ error: `Only ${step.role} can return this bill` });
    if (bill.CurrentOwner !== req.user.UserID)
      return res.status(403).json({ error: 'You are not the current owner of this bill' });
    const remarks = (req.body.remarks || '').trim();
    if (!remarks) return res.status(400).json({ error: 'Return remarks are mandatory' });

    let target = null;
    if (step.targetStatus === 'ReturnedToBiller') {
      target = bill.SubmittedBy
        ? (await db.query('SELECT "UserID","Name" FROM "Users" WHERE "UserID" = $1', [bill.SubmittedBy])).rows[0] || null
        : null;
      target = target || await findUserByDesignation('BillingOfficer');
    } else {
      const fromAction = step.targetStatus === 'ReturnedToManager' ? 'MANAGER_BILL_CHECKED' : 'DGM_BILL_CHECKED';
      const r = (await db.query(
        `SELECT bw."FromUserID", u."Name" FROM "BillWorkflow" bw
         LEFT JOIN "Users" u ON u."UserID" = bw."FromUserID"
         WHERE bw."BillID" = $1 AND bw."Action" = $2
         ORDER BY bw."WorkflowID" DESC LIMIT 1`,
        [bill.BillID, fromAction]
      )).rows[0];
      target = r
        ? { UserID: r.FromUserID, Name: r.Name }
        : await findUserByDesignation(step.targetStatus === 'ReturnedToManager' ? 'Manager' : 'DGM');
    }
    if (!target) return res.status(400).json({ error: 'No target user found for this return' });

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const upd = await client.query(
        `UPDATE "Billing"
         SET "Status"=$1, "CurrentStep"='Returned', "CurrentOwner"=$2,
             "PreviousStatus"=$3, "ReturnedBy"=$4, "ReturnedAt"=now(), "ReturnRemarks"=$5,
             "SlaStatus"='Normal'
         WHERE "BillID"=$6 AND "Status" = $7 AND "CurrentOwner" = $8`,
        [step.targetStatus, target.UserID, bill.Status, req.user.UserID, remarks, bill.BillID, bill.Status, req.user.UserID]
      );
      if (upd.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Bill state changed. Refresh and try again.' });
      }
      await billWorkflowLog(bill.BillID, req.user.UserID, target.UserID, step.action, 'Returned', remarks);
      await client.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks") VALUES ($1,$2,$3,$4)`,
        [bill.EstimateID, req.user.UserID, `${step.action} (Bill ${bill.BillID})`,
          `Bill ${bill.BillNo || bill.BillID} returned by ${req.user.Name} (${req.user.Designation}) to ${step.targetLabel}. Remarks: ${remarks}`]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await stopSla(bill.BillID, 'Billing', 'reverted');
    await billNotify(bill.EstimateID, target.UserID, 'BillReturned',
      `Bill ${bill.BillNo || `#${bill.BillID}`} returned to you by ${req.user.Designation}. Remarks: ${remarks}`);

    res.json({ message: `Bill returned to ${step.targetLabel}.` });
  } catch (err) { next(err); }
};