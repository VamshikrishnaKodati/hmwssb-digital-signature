const db = require('../config/db');

exports.listAuditLogs = async (req, res, next) => {
  try {
    const { estimateId, limit = 200 } = req.query;
    let sql = `SELECT al.*, u."Name" as "UserName", u."Designation" as "UserDesignation",
                      eh."EstimateNo", eh."WorkID", eh."NameOfWork"
               FROM "AuditLog" al
               LEFT JOIN "Users" u ON u."UserID" = al."UserID"
               LEFT JOIN "EstimateHeader" eh ON eh."EstimateID" = al."EstimateID"`;
    const params = [];
    if (estimateId) { sql += ` WHERE al."EstimateID" = $1`; params.push(estimateId); }
    sql += ` ORDER BY al."CreatedDate" DESC LIMIT ${Math.min(parseInt(limit, 10) || 200, 1000)}`;
    res.json((await db.query(sql, params)).rows);
  } catch (err) { next(err); }
};
