const db = require('../config/db');

exports.listAgencies = async (req, res, next) => {
  try {
    const { estimateId, tenderId } = req.query;
    const params = [];
    const conditions = [];
    if (estimateId) {
      params.push(parseInt(estimateId, 10));
      conditions.push(`eh."EstimateID" = $${params.length}`);
    }
    if (tenderId) {
      params.push(parseInt(tenderId, 10));
      conditions.push(`a."TenderID" = $${params.length}`);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT a.*, eh."WorkID", eh."NameOfWork", eh."EstimateNo", eh."Status" as "EstimateStatus", t."TenderNo"
       FROM "Agency" a
       JOIN "EstimateHeader" eh ON eh."EstimateID" = a."EstimateID"
       LEFT JOIN "Tender" t ON t."TenderID" = a."TenderID"
       ${where}
       ORDER BY a."AgreementDate" DESC NULLS LAST, a."AgencyID" DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.createAgency = async (req, res, next) => {
  try {
    if (req.user.Designation !== 'DirectorOfAdministration')
      return res.status(403).json({ error: 'Only DirectorOfAdministration can create agencies' });

    const { EstimateID, TenderID, AgencyName, AgencyCode, AgreementNo, AgreementDate,
            TenderValue, CompletionPeriod, SecurityDeposit, PerformanceGuarantee, ContactDetails,
            ContractorName, WorkOrderNo, WorkOrderDate, StartDate, CompletionDate } = req.body;

    const est = await db.query('SELECT "Status" FROM "EstimateHeader" WHERE "EstimateID" = $1', [EstimateID]);
    if (!est.rows.length) return res.status(404).json({ error: 'Estimate not found' });
    const validEstimateStatuses = ['TenderPublished', 'AgencySelected'];
    if (!validEstimateStatuses.includes(est.rows[0].Status))
      return res.status(400).json({ error: 'Agencies can only be created for TenderPublished or AgencySelected estimates' });

    if (TenderID) {
      const ten = await db.query(
        'SELECT "Status" FROM "Tender" WHERE "TenderID" = $1 AND "EstimateID" = $2',
        [TenderID, EstimateID]
      );
      if (!ten.rows.length) return res.status(400).json({ error: 'Tender does not belong to this estimate' });
      const validTenderStatuses = ['Awarded', 'WorkAwarded', 'WorkOrderIssued', 'AgreementExecuted'];
      if (!validTenderStatuses.includes(ten.rows[0].Status))
        return res.status(400).json({ error: 'Agencies can only be linked to an awarded tender' });

      // If an agency already exists for this tender, return 409 conflict
      const existing = await db.query(
        'SELECT "AgencyID" FROM "Agency" WHERE "EstimateID" = $1 AND "TenderID" = $2',
        [EstimateID, TenderID]
      );
      if (existing.rows.length) {
        return res.status(409).json({ error: 'Agency already exists for this tender', AgencyID: existing.rows[0].AgencyID });
      }
    }

    const result = await db.query(
      `INSERT INTO "Agency" ("EstimateID","TenderID","AgencyName","AgencyCode","AgreementNo",
        "AgreementDate","TenderValue","CompletionPeriod","SecurityDeposit","PerformanceGuarantee","ContactDetails",
        "ContractorName","WorkOrderNo","WorkOrderDate","StartDate","CompletionDate")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [EstimateID, TenderID, AgencyName, AgencyCode, AgreementNo, AgreementDate,
       TenderValue, CompletionPeriod, SecurityDeposit, PerformanceGuarantee, ContactDetails,
       ContractorName, WorkOrderNo || null, WorkOrderDate || null, StartDate || null, CompletionDate || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.updateAgency = async (req, res, next) => {
  try {
    if (req.user.Designation !== 'DirectorOfAdministration')
      return res.status(403).json({ error: 'Only DirectorOfAdministration can update agencies' });

    const { AgencyName, AgencyCode, AgreementNo, AgreementDate, TenderValue,
            CompletionPeriod, SecurityDeposit, PerformanceGuarantee, ContactDetails,
            ContractorName, WorkOrderNo, WorkOrderDate, StartDate, CompletionDate } = req.body;
    const result = await db.query(
      `UPDATE "Agency" SET "AgencyName"=$1,"AgencyCode"=$2,"AgreementNo"=$3,"AgreementDate"=$4,
       "TenderValue"=$5,"CompletionPeriod"=$6,"SecurityDeposit"=$7,"PerformanceGuarantee"=$8,"ContactDetails"=$9,
       "ContractorName"=$10,"WorkOrderNo"=$11,"WorkOrderDate"=$12,"StartDate"=$13,"CompletionDate"=$14
       WHERE "AgencyID"=$15 RETURNING *`,
      [AgencyName, AgencyCode, AgreementNo, AgreementDate, TenderValue,
       CompletionPeriod, SecurityDeposit, PerformanceGuarantee, ContactDetails,
       ContractorName, WorkOrderNo || null, WorkOrderDate || null, StartDate || null, CompletionDate || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.deleteAgency = async (req, res, next) => {
  try {
    if (req.user.Designation !== 'DirectorOfAdministration')
      return res.status(403).json({ error: 'Only DirectorOfAdministration can delete agencies' });
    await db.query('DELETE FROM "Agency" WHERE "AgencyID" = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};
