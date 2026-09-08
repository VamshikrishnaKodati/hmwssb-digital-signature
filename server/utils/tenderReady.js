const db = require('../config/db');

// ── Authoritative "Ready for Tender" eligibility ──────────────────────────────
// Business gate: MD Final Approve -> FCN generated -> Admin Sanction completed
// -> Technical Sanction approved. An estimate is tender-ready ONLY when ALL of:
//   - EstimateHeader.Status = 'TSApproved'  (TS approved; already implies the
//     MD final approval chain ran before it)
//   - FCN record exists and is Generated/Verified  (linked via FCNID)
//   - AdministrativeSanction record exists and is Generated/Verified
//     (linked via AdminSanctionID)
//   - TechnicalSanction.Status = 'Approved'
// A pre-existing auto-created 'Draft' placeholder tender (created at MD final
// approval) is NOT enough to make an estimate "already tendered" — the Tender
// Officer still creates/complete the foundation. Estimates whose tender has
// moved past Draft (TenderDraft/ReadyForPublication/Published/...) are excluded.

const TENDERED_EXCLUDED_STATUSES = [
  'TenderDraft', 'ReadyForPublication', 'Published', 'BidSubmissionOpen',
  'BidSubmissionClosed', 'TechnicalEvaluation', 'FinancialEvaluation', 'Awarded',
];

const READY_FOR_TENDER_SQL = `
  SELECT
    eh."EstimateID",
    eh."EstimateNo",
    eh."NameOfWork",
    eh."Status",
    eh."CurrentOwner",
    eh."Version",
    eh."FinancialYear",
    eh."CreatedDate",
    eh."SlaStartedAt",
    eh."SlaDueAt",
    eh."SlaStatus",
    u."Name"        AS "CreatedByName",
    COALESCE(ab."GrandTotal", 0) AS "EstimatedContractValue",
    f."FCNNo",
    f."Status"      AS "FCNStatus",
    sa."SanctionNo" AS "ASNo",
    sa."Status"     AS "ASStatus",
    ts."TSNo",
    ts."ApprovedAt" AS "ReadyDate",
    tend."TenderID",
    tend."Status"   AS "TenderStatus",
    tend."TenderNo"
  FROM "EstimateHeader" eh
  JOIN "FCN" f ON f."EstimateID" = eh."EstimateID"
  JOIN "AdministrativeSanction" sa ON sa."EstimateID" = eh."EstimateID"
  JOIN "TechnicalSanction" ts ON ts."EstimateID" = eh."EstimateID"
  LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
  LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
  LEFT JOIN "Tender" tend ON tend."EstimateID" = eh."EstimateID"
  WHERE eh."Status" = 'TSApproved'
    AND eh."FCNID" IS NOT NULL
    AND f."Status" IN ('Generated', 'Verified')
    AND eh."AdminSanctionID" IS NOT NULL
    AND sa."Status" IN ('Generated', 'Verified')
    AND eh."TSID" IS NOT NULL
    AND ts."Status" = 'Approved'
    AND (tend."TenderID" IS NULL
         OR tend."Status" IS NULL
         OR tend."Status" NOT IN ('TenderDraft','ReadyForPublication','Published','BidSubmissionOpen','BidSubmissionClosed','TechnicalEvaluation','FinancialEvaluation','Awarded'))
  {ownerFilter}
  ORDER BY ts."ApprovedAt" ASC, eh."EstimateID" ASC
`;

// Returns rows eligible for the "Ready for Tender" queue. If ownerId is given,
// filter to estimates owned by that user (Tender Officer receives them after
// TS approval sets CurrentOwner = TenderOfficer).
async function getReadyForTender(ownerId) {
  const ownerFilter = ownerId ? 'AND eh."CurrentOwner" = $1' : '';
  const params = ownerId ? [ownerId] : [];
  const sql = READY_FOR_TENDER_SQL.replace('{ownerFilter}', ownerFilter);
  const result = await db.query(sql, params);
  return result.rows;
}

module.exports = { getReadyForTender, TENDERED_EXCLUDED_STATUSES };