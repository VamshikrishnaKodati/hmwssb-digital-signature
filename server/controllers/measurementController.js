const db = require('../config/db');
const { checkPermission } = require('../middleware/rbac');
const VERIFIER = 'BillingOfficer';
const today = () => new Date().toISOString().slice(0, 10);

async function auditLog(estimateId, userId, action, remarks) {
  await db.query(
    `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
     VALUES ($1,$2,$3,$4)`,
    [estimateId, userId, `${action} (Measurement)`, remarks]
  );
}

async function isCurrentOwner(userId, estimateId) {
  const r = await db.query('SELECT "CurrentOwner" FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
  return r.rows.length > 0 && r.rows[0].CurrentOwner === userId;
}

exports.listMeasurements = async (req, res, next) => {
  try {
    const { estimateId } = req.query;
    const params = [];
    let where = '';
    if (estimateId) {
      params.push(parseInt(estimateId, 10));
      where = ` WHERE mb."EstimateID" = $${params.length}`;
    }
    const result = await db.query(
      `SELECT mb.*, eh."WorkID", eh."NameOfWork", eh."EstimateNo", eh."Status" as "EstimateStatus",
              mu."Name" as "MeasuredByName", vu."Name" as "VerifiedByName"
       FROM "MeasurementBook" mb
       JOIN "EstimateHeader" eh ON eh."EstimateID" = mb."EstimateID"
       LEFT JOIN "Users" mu ON mu."UserID" = mb."MeasuredBy"
       LEFT JOIN "Users" vu ON vu."UserID" = mb."VerifiedBy"
       ${where}
       ORDER BY mb."MeasuredDate" DESC, mb."MeasurementID" DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.createMeasurement = async (req, res, next) => {
  try {
    if (!(await checkPermission(req.user.Designation, 'measurement.create')))
      return res.status(403).json({ error: 'You do not have permission to record measurements' });

    const { EstimateID, DetailID, ItemCode, Description, Unit, PreviousQty, CurrentQty, MeasuredDate, Remarks } = req.body;
    if (!EstimateID) return res.status(400).json({ error: 'EstimateID is required' });
    if (CurrentQty === undefined || CurrentQty === null || Number(CurrentQty) < 0)
      return res.status(400).json({ error: 'CurrentQty is required and must be >= 0' });

    const est = await db.query('SELECT "Status","CurrentOwner" FROM "EstimateHeader" WHERE "EstimateID" = $1', [EstimateID]);
    if (!est.rows.length) return res.status(404).json({ error: 'Estimate not found' });
    if (!['AgencySelected', 'WorkStarted', 'WorkCompleted'].includes(est.rows[0].Status))
      return res.status(400).json({ error: 'Measurements can only be recorded for active works' });
    if (est.rows[0].CurrentOwner !== req.user.UserID)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });

    let item = null;
    if (DetailID) {
      item = await db.query(
        `SELECT ed."DetailID", ed."Qty", ed."Unit", im."ItemCode", im."Description"
         FROM "EstimateDetails" ed
         JOIN "ItemMaster" im ON im."ItemID" = ed."ItemID"
         WHERE ed."DetailID" = $1 AND ed."EstimateID" = $2`,
        [DetailID, EstimateID]
      );
      if (!item.rows.length) return res.status(400).json({ error: 'DetailID does not belong to this estimate' });
    }

    const prev = Number(PreviousQty || 0);
    const curr = Number(CurrentQty);
    const cumulative = prev + curr;
    const estimateQty = item?.rows[0]?.Qty || null;
    const balance = estimateQty === null || estimateQty === undefined ? null : Number(estimateQty) - cumulative;

    if (estimateQty !== null && cumulative > Number(estimateQty))
      return res.status(400).json({ error: `Cumulative quantity (${cumulative}) exceeds approved quantity (${estimateQty})` });

    const measuredDateVal = MeasuredDate || today();
    const result = await db.query(
      `INSERT INTO "MeasurementBook"
         ("EstimateID","DetailID","ItemCode","Description","Unit","PreviousQty","CurrentQty",
          "CumulativeQty","BalanceQty","MeasuredDate","MeasuredBy","Status","Remarks")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Draft',$12)
       ON CONFLICT ("EstimateID","DetailID","MeasuredDate","PreviousQty","CurrentQty") DO NOTHING
       RETURNING *`,
      [EstimateID, DetailID || null,
       ItemCode || item?.rows[0]?.ItemCode || null,
       Description || item?.rows[0]?.Description || null,
       Unit || item?.rows[0]?.Unit || null,
       prev, curr, cumulative, balance,
       measuredDateVal, req.user.UserID, Remarks || null]
    );
    if (result.rows.length) {
      await auditLog(EstimateID, req.user.UserID, 'RecordMeasurement',
        `${req.user.Name} recorded ${curr} ${Unit || ''} for ${ItemCode || Description || 'item'}. Cumulative: ${cumulative}.`);
      return res.status(201).json(result.rows[0]);
    }

    // Idempotent replay: an identical submission returns the existing record
    // instead of writing a duplicate MeasurementBook row.
    const existing = await db.query(
      `SELECT * FROM "MeasurementBook"
       WHERE "EstimateID"=$1 AND "DetailID" IS NOT DISTINCT FROM $2 AND "MeasuredDate"=$3
         AND "PreviousQty"=$4 AND "CurrentQty"=$5
       ORDER BY "MeasurementID" LIMIT 1`,
      [EstimateID, DetailID || null, measuredDateVal, prev, curr]
    );
    res.status(200).json(existing.rows[0]);
  } catch (err) { next(err); }
};

exports.verifyMeasurement = async (req, res, next) => {
  try {
    if (!(await checkPermission(req.user.Designation, 'measurement.verify')))
      return res.status(403).json({ error: 'You do not have permission to verify measurements' });

    const m = await db.query('SELECT * FROM "MeasurementBook" WHERE "MeasurementID" = $1', [req.params.id]);
    if (!m.rows.length) return res.status(404).json({ error: 'Measurement not found' });
    if (m.rows[0].Status === 'Verified')
      return res.status(400).json({ error: 'Measurement already verified' });

    const result = await db.query(
      `UPDATE "MeasurementBook" SET "Status"='Verified', "VerifiedBy"=$1, "VerifiedDate"=now()
       WHERE "MeasurementID"=$2 RETURNING *`,
      [req.user.UserID, req.params.id]
    );
    await auditLog(result.rows[0].EstimateID, req.user.UserID, 'VerifyMeasurement',
      `${req.user.Name} verified measurement ${req.params.id} (${result.rows[0].CurrentQty} ${result.rows[0].Unit || ''}).`);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.updateMeasurement = async (req, res, next) => {
  try {
    if (!(await checkPermission(req.user.Designation, 'measurement.create')))
      return res.status(403).json({ error: 'You do not have permission to update measurements' });

    const m = await db.query('SELECT * FROM "MeasurementBook" WHERE "MeasurementID" = $1', [req.params.id]);
    if (!m.rows.length) return res.status(404).json({ error: 'Measurement not found' });
    if (m.rows[0].Status === 'Verified')
      return res.status(400).json({ error: 'Verified measurements cannot be edited' });
    if (!(await isCurrentOwner(req.user.UserID, m.rows[0].EstimateID)))
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });

    const { DetailID, PreviousQty, CurrentQty, MeasuredDate, Remarks } = req.body;
    if (CurrentQty === undefined || CurrentQty === null || Number(CurrentQty) < 0)
      return res.status(400).json({ error: 'CurrentQty is required and must be >= 0' });

    let item = null;
    const detailId = DetailID !== undefined ? DetailID : m.rows[0].DetailID;
    if (detailId) {
      item = await db.query(
        `SELECT ed."DetailID", ed."Qty", im."ItemCode", im."Description", im."Unit"
         FROM "EstimateDetails" ed
         JOIN "ItemMaster" im ON im."ItemID" = ed."ItemID"
         WHERE ed."DetailID" = $1 AND ed."EstimateID" = $2`,
        [detailId, m.rows[0].EstimateID]
      );
    }

    const prev = Number(PreviousQty !== undefined ? PreviousQty : m.rows[0].PreviousQty);
    const curr = Number(CurrentQty);
    const cumulative = prev + curr;
    const estimateQty = item?.rows[0]?.Qty || null;
    const balance = estimateQty === null ? null : Number(estimateQty) - cumulative;

    if (estimateQty !== null && cumulative > Number(estimateQty))
      return res.status(400).json({ error: `Cumulative quantity (${cumulative}) exceeds approved quantity (${estimateQty})` });

    const result = await db.query(
      `UPDATE "MeasurementBook"
       SET "DetailID"=$1, "PreviousQty"=$2, "CurrentQty"=$3, "CumulativeQty"=$4, "BalanceQty"=$5,
           "MeasuredDate"=COALESCE($6, "MeasuredDate"), "Remarks"=COALESCE($7, "Remarks")
       WHERE "MeasurementID"=$8 RETURNING *`,
      [detailId || null, prev, curr, cumulative, balance,
       MeasuredDate || null, Remarks !== undefined ? Remarks : null, req.params.id]
    );
    await auditLog(m.rows[0].EstimateID, req.user.UserID, 'UpdateMeasurement',
      `${req.user.Name} updated measurement ${req.params.id}. Qty: ${prev}+${curr}=${cumulative}.`);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.deleteMeasurement = async (req, res, next) => {
  try {
    if (!(await checkPermission(req.user.Designation, 'measurement.create')))
      return res.status(403).json({ error: 'You do not have permission to delete measurements' });
    const m = await db.query('SELECT * FROM "MeasurementBook" WHERE "MeasurementID" = $1', [req.params.id]);
    if (!m.rows.length) return res.status(404).json({ error: 'Measurement not found' });
    if (m.rows[0].Status === 'Verified')
      return res.status(400).json({ error: 'Verified measurements cannot be deleted' });
    if (!(await isCurrentOwner(req.user.UserID, m.rows[0].EstimateID)))
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    await db.query('DELETE FROM "MeasurementBook" WHERE "MeasurementID" = $1', [req.params.id]);
    await auditLog(m.rows[0].EstimateID, req.user.UserID, 'DeleteMeasurement',
      `${req.user.Name} deleted measurement ${req.params.id}.`);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};
