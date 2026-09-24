const db = require('../config/db');
const { checkPermission } = require('../middleware/rbac');

const VALID_PERCENTAGES = [0, 25, 50, 75, 100];
const isPercent = (p) => p !== undefined && VALID_PERCENTAGES.includes(Number(p));
const today = () => new Date().toISOString().slice(0, 10);

async function isCurrentOwner(userId, estimateId) {
  const r = await db.query('SELECT "CurrentOwner" FROM "EstimateHeader" WHERE "EstimateID" = $1', [estimateId]);
  return r.rows.length > 0 && r.rows[0].CurrentOwner === userId;
}

async function audit(estimateId, user, action, remarks) {
  await db.query(
    `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
     VALUES ($1,$2,$3,$4)`,
    [estimateId, user.UserID, action, remarks]
  );
}

exports.listProgress = async (req, res, next) => {
  try {
    const { estimateId } = req.query;
    const params = [];
    let where = '';
    if (estimateId) {
      params.push(parseInt(estimateId, 10));
      where = ` WHERE wp."EstimateID" = $${params.length}`;
    }
    const result = await db.query(
      `SELECT wp.*, eh."WorkID", eh."NameOfWork", eh."EstimateNo", eh."Status" as "EstimateStatus"
       FROM "WorkProgress" wp
       JOIN "EstimateHeader" eh ON eh."EstimateID" = wp."EstimateID"
       ${where}
       ORDER BY wp."Date" DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.createProgress = async (req, res, next) => {
  try {
    if (!(await checkPermission(req.user.Designation, 'work.progress')))
      return res.status(403).json({ error: 'You do not have permission to create progress entries' });

    const { EstimateID, Stage, Percentage, Remarks, Date: progressDate, Photos, InspectionNotes, EngineerRemarks, DelayReason } = req.body;
    if (!isPercent(Percentage))
      return res.status(400).json({ error: 'Percentage must be one of 0, 25, 50, 75, 100' });

    const est = await db.query('SELECT "Status","CurrentOwner" FROM "EstimateHeader" WHERE "EstimateID" = $1', [EstimateID]);
    if (!est.rows.length) return res.status(404).json({ error: 'Estimate not found' });
    if (!['AgencySelected', 'WorkStarted', 'WorkCompleted'].includes(est.rows[0].Status))
      return res.status(400).json({ error: 'Progress can only be recorded for active works' });
    if (est.rows[0].CurrentOwner !== req.user.UserID)
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });

    // Idempotent: an identical entry (stage/percentage/day) is a repeated
    // submission, not a second record — return the existing row. The unique
    // index makes this safe against double-submit races too.
    const progressDateVal = progressDate || today();
    const result = await db.query(
      `INSERT INTO "WorkProgress" ("EstimateID","Stage","Percentage","Remarks","Date",
        "Photos","InspectionNotes","EngineerRemarks","DelayReason")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT ("EstimateID","Stage","Percentage","Date") DO NOTHING
       RETURNING *`,
       [EstimateID, Stage, Percentage, Remarks, progressDateVal,
       Photos || null, InspectionNotes || null, EngineerRemarks || null, DelayReason || null]
    );

    if (result.rows.length) {
      await audit(EstimateID, req.user, 'ProgressRecorded',
        `${req.user.Name} recorded ${Percentage}% progress${Stage ? ' at ' + Stage : ''} for ${EstimateID}.`);
      return res.status(201).json(result.rows[0]);
    }

    const existing = await db.query(
      `SELECT * FROM "WorkProgress"
       WHERE "EstimateID"=$1 AND "Stage" IS NOT DISTINCT FROM $2 AND "Percentage"=$3 AND "Date" IS NOT DISTINCT FROM $4
       ORDER BY "ProgressID" LIMIT 1`,
      [EstimateID, Stage, Percentage, progressDateVal]
    );
    res.status(200).json(existing.rows[0]);
  } catch (err) { next(err); }
};

exports.updateProgress = async (req, res, next) => {
  try {
    if (!(await checkPermission(req.user.Designation, 'work.progress')))
      return res.status(403).json({ error: 'You do not have permission to update progress' });

    const row = await db.query('SELECT "EstimateID" FROM "WorkProgress" WHERE "ProgressID" = $1', [req.params.id]);
    if (!row.rows.length) return res.status(404).json({ error: 'Progress entry not found' });
    if (!(await isCurrentOwner(req.user.UserID, row.rows[0].EstimateID)))
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });

    const { Stage, Percentage, Remarks, Date: progressDate, Photos, InspectionNotes, EngineerRemarks, DelayReason } = req.body;
    if (Percentage !== undefined && !isPercent(Percentage))
      return res.status(400).json({ error: 'Percentage must be one of 0, 25, 50, 75, 100' });
    const result = await db.query(
      `UPDATE "WorkProgress" SET "Stage"=$1,"Percentage"=$2,"Remarks"=$3,"Date"=$4,
        "Photos"=$5,"InspectionNotes"=$6,"EngineerRemarks"=$7,"DelayReason"=$8
       WHERE "ProgressID"=$9 RETURNING *`,
      [Stage, Percentage, Remarks, progressDate || today(), Photos || null, InspectionNotes || null, EngineerRemarks || null, DelayReason || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.deleteProgress = async (req, res, next) => {
  try {
    if (!(await checkPermission(req.user.Designation, 'work.progress')))
      return res.status(403).json({ error: 'You do not have permission to delete progress entries' });
    const row = await db.query('SELECT "EstimateID" FROM "WorkProgress" WHERE "ProgressID" = $1', [req.params.id]);
    if (!row.rows.length) return res.status(404).json({ error: 'Progress entry not found' });
    if (!(await isCurrentOwner(req.user.UserID, row.rows[0].EstimateID)))
      return res.status(403).json({ error: 'You are not the current owner of this estimate' });
    await db.query('DELETE FROM "WorkProgress" WHERE "ProgressID" = $1', [req.params.id]);
    await audit(row.rows[0].EstimateID, req.user, 'ProgressDeleted',
      `${req.user.Name} deleted progress entry ${req.params.id} for ${row.rows[0].EstimateID}.`);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};