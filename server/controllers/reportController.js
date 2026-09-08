const db = require('../config/db');

exports.estimateRegister = async (req, res, next) => {
  try {
    const { dateFrom, dateTo, status } = req.query;
    let sql = `SELECT eh.*, u."Name" as "CreatedByName", COALESCE(ab."GrandTotal",0) as "GrandTotal"
               FROM "EstimateHeader" eh
               LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
               LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"`;
    const params = [];
    const conditions = [];
    if (dateFrom) { conditions.push(`eh."CreatedDate" >= $${params.length+1}`); params.push(dateFrom); }
    if (dateTo) { conditions.push(`eh."CreatedDate" <= $${params.length+1}`); params.push(dateTo); }
    if (status) { conditions.push(`eh."Status" = $${params.length+1}`); params.push(status); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY eh."CreatedDate" DESC';
    res.json((await db.query(sql, params)).rows);
  } catch (err) { next(err); }
};

exports.pendingEstimates = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT eh.*, u."Name" as "CreatedByName", COALESCE(ab."GrandTotal",0) as "GrandTotal"
       FROM "EstimateHeader" eh
       JOIN "Users" u ON u."UserID" = eh."CreatedBy"
       LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
       WHERE eh."Status" = 'Submitted'
       ORDER BY eh."CreatedDate"`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.approvedEstimates = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    let sql = `SELECT eh.*, u."Name" as "CreatedByName", COALESCE(ab."GrandTotal",0) as "GrandTotal"
               FROM "EstimateHeader" eh
               JOIN "Users" u ON u."UserID" = eh."CreatedBy"
               LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
               WHERE eh."Status" IN ('Approved', 'Signed')`;
    const params = [];
    if (dateFrom) { sql += ` AND eh."CreatedDate" >= $1`; params.push(dateFrom); }
    if (dateTo) { sql += ` AND eh."CreatedDate" <= $${params.length+1}`; params.push(dateTo); }
    sql += ' ORDER BY eh."CreatedDate" DESC';
    res.json((await db.query(sql, params)).rows);
  } catch (err) { next(err); }
};

exports.tenderReport = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT t.*, eh."WorkID", eh."NameOfWork", COALESCE(ab."GrandTotal",0) as "EstimateCost"
       FROM "Tender" t
       JOIN "EstimateHeader" eh ON eh."EstimateID" = t."EstimateID"
       LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
       ORDER BY t."TenderDate" DESC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.agencyReport = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT a.*, eh."WorkID", eh."NameOfWork", t."TenderNo"
       FROM "Agency" a
       JOIN "EstimateHeader" eh ON eh."EstimateID" = a."EstimateID"
       LEFT JOIN "Tender" t ON t."TenderID" = a."TenderID"
       ORDER BY a."AgreementDate" DESC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.workProgressReport = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT wp.*, eh."WorkID", eh."NameOfWork"
       FROM "WorkProgress" wp
       JOIN "EstimateHeader" eh ON eh."EstimateID" = wp."EstimateID"
       ORDER BY wp."Date" DESC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.billingReport = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT b.*, eh."WorkID", eh."NameOfWork"
       FROM "Billing" b
       JOIN "EstimateHeader" eh ON eh."EstimateID" = b."EstimateID"
       ORDER BY b."BillID" DESC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.estimateMovementReport = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT w.*, eh."WorkID", eh."NameOfWork",
              fu."Name" as "FromUserName", tu."Name" as "ToUserName"
       FROM "Workflow" w
       JOIN "EstimateHeader" eh ON eh."EstimateID" = w."EstimateID"
       LEFT JOIN "Users" fu ON fu."UserID" = w."FromUserID"
       LEFT JOIN "Users" tu ON tu."UserID" = w."ToUserID"
       ORDER BY w."DateTime" DESC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};
