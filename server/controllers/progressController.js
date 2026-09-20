const db = require('../config/db');
const { checkPermission } = require('../middleware/rbac');

const VALID_PERCENTAGES = [0, 25, 50, 75, 100];
const isPercent = (p) => p !== undefined && VALID_PERCENTAGES.includes(Number(p));

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

    const est = await db.query('SELECT "Status" FROM "EstimateHeader" WHERE "EstimateID" = $1', [EstimateID]);
    if (!est.rows.length) return res.status(404).json({ error: 'Estimate not found' });
    if (!['AgencySelected', 'WorkStarted', 'WorkCompleted'].includes(est.rows[0].Status))
      return res.status(400).json({ error: 'Progress can only be recorded for active works' });

    const result = await db.query(
      `INSERT INTO "WorkProgress" ("EstimateID","Stage","Percentage","Remarks","Date",
        "Photos","InspectionNotes","EngineerRemarks","DelayReason")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
       [EstimateID, Stage, Percentage, Remarks, progressDate || new Date(),
       Photos || null, InspectionNotes || null, EngineerRemarks || null, DelayReason || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.updateProgress = async (req, res, next) => {
  try {
    if (!(await checkPermission(req.user.Designation, 'work.progress')))
      return res.status(403).json({ error: 'You do not have permission to update progress' });

    const { Stage, Percentage, Remarks, Date: progressDate, Photos, InspectionNotes, EngineerRemarks, DelayReason } = req.body;
    if (Percentage !== undefined && !isPercent(Percentage))
      return res.status(400).json({ error: 'Percentage must be one of 0, 25, 50, 75, 100' });
    const result = await db.query(
      `UPDATE "WorkProgress" SET "Stage"=$1,"Percentage"=$2,"Remarks"=$3,"Date"=$4,
        "Photos"=$5,"InspectionNotes"=$6,"EngineerRemarks"=$7,"DelayReason"=$8
       WHERE "ProgressID"=$9 RETURNING *`,
      [Stage, Percentage, Remarks, progressDate || new Date(), Photos || null, InspectionNotes || null, EngineerRemarks || null, DelayReason || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.deleteProgress = async (req, res, next) => {
  try {
    if (!(await checkPermission(req.user.Designation, 'work.progress')))
      return res.status(403).json({ error: 'You do not have permission to delete progress entries' });
    await db.query('DELETE FROM "WorkProgress" WHERE "ProgressID" = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};
