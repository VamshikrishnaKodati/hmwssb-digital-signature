const db = require('../config/db');

exports.listAgencies = async (req, res, next) => {
  try {
    const { estimateId } = req.query;
    const params = [];
    let where = '';
    if (estimateId) {
      params.push(parseInt(estimateId, 10));
      where = ` WHERE eh."EstimateID" = $${params.length}`;
    }
    const result = await db.query(
      `SELECT a.*, eh."WorkID", eh."NameOfWork", eh."EstimateNo", eh."Status" as "EstimateStatus", t."TenderNo"
       FROM "Agency" a
       JOIN "EstimateHeader" eh ON eh."EstimateID" = a."EstimateID"
       LEFT JOIN "Tender" t ON t."TenderID" = a."TenderID"
       ${where}
       ORDER BY a."AgreementDate" DESC`,
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
            ContractorName, WorkOrderDate, StartDate, CompletionDate } = req.body;

    const est = await db.query('SELECT "Status" FROM "EstimateHeader" WHERE "EstimateID" = $1', [EstimateID]);
    if (!est.rows.length) return res.status(404).json({ error: 'Estimate not found' });
    if (est.rows[0].Status !== 'TenderPublished')
      return res.status(400).json({ error: 'Agencies can only be created for TenderPublished estimates' });

    if (TenderID) {
      const ten = await db.query(
        'SELECT "Status" FROM "Tender" WHERE "TenderID" = $1 AND "EstimateID" = $2',
        [TenderID, EstimateID]
      );
      if (!ten.rows.length) return res.status(400).json({ error: 'Tender does not belong to this estimate' });
      if (ten.rows[0].Status !== 'Awarded')
        return res.status(400).json({ error: 'Agencies can only be linked to an awarded tender' });
    }

    const result = await db.query(
      `INSERT INTO "Agency" ("EstimateID","TenderID","AgencyName","AgencyCode","AgreementNo",
        "AgreementDate","TenderValue","CompletionPeriod","SecurityDeposit","PerformanceGuarantee","ContactDetails",
        "ContractorName","WorkOrderDate","StartDate","CompletionDate")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [EstimateID, TenderID, AgencyName, AgencyCode, AgreementNo, AgreementDate,
       TenderValue, CompletionPeriod, SecurityDeposit, PerformanceGuarantee, ContactDetails,
       ContractorName, WorkOrderDate || null, StartDate || null, CompletionDate || null]
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
            ContractorName, WorkOrderDate, StartDate, CompletionDate } = req.body;
    const result = await db.query(
      `UPDATE "Agency" SET "AgencyName"=$1,"AgencyCode"=$2,"AgreementNo"=$3,"AgreementDate"=$4,
       "TenderValue"=$5,"CompletionPeriod"=$6,"SecurityDeposit"=$7,"PerformanceGuarantee"=$8,"ContactDetails"=$9,
       "ContractorName"=$10,"WorkOrderDate"=$11,"StartDate"=$12,"CompletionDate"=$13
       WHERE "AgencyID"=$14 RETURNING *`,
      [AgencyName, AgencyCode, AgreementNo, AgreementDate, TenderValue,
       CompletionPeriod, SecurityDeposit, PerformanceGuarantee, ContactDetails,
       ContractorName, WorkOrderDate || null, StartDate || null, CompletionDate || null, req.params.id]
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
