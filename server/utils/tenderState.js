// T3: server-time tender state transitions. The submission window is enforced
// against the server clock, never the client. Reads never mutate: effectiveStatus
// is computed on the fly; persistExpiry is invoked only from real write paths.
const db = require('../config/db');
const { stopSla } = require('./sla');
const { getPermissions } = require('../middleware/rbac');

exports.PUBLISHED = 'Published';
exports.BID_OPEN = 'BidSubmissionOpen';
exports.BIDS_CLOSED = 'BidsClosed';
exports.OPENING = 'BidOpeningInProgress';
exports.TECH_EVAL_PENDING = 'TechnicalEvaluationPending';
exports.TECH_EVAL = 'UnderTechnicalEvaluation';
exports.FIN_EVAL_PENDING = 'FinancialEvaluationPending';
exports.FIN_EVAL = 'FinancialEvaluation';
exports.L1_IDENTIFIED = 'L1Identified';
exports.WORK_AWARDED = 'WorkAwarded';
exports.WORK_ORDER_ISSUED = 'WorkOrderIssued';
exports.AGREEMENT_EXECUTED = 'AgreementExecuted';

const CLOSED_AT = (eff) => [
  'BidsClosed', 'BidOpeningInProgress',
  'TechnicalEvaluationPending', 'UnderTechnicalEvaluation',
  'FinancialEvaluationPending', 'FinancialEvaluation',
  'L1Identified', 'WorkAwarded', 'WorkOrderIssued', 'AgreementExecuted',
].includes(eff);

// Effective status given the stored status + submission window dates. Pure.
exports.effectiveStatus = function effectiveStatus(tender) {
  const status = tender.Status;
  if (CLOSED_AT(status) || status === 'TenderDraft') return status;
  const now = new Date();
  const start = tender.BidStartDate ? new Date(tender.BidStartDate) : null;
  const end = tender.BidEndDate ? new Date(tender.BidEndDate) : null;
  // Past end → closed (window over). Open once start reached.
  if (end && now >= end) return 'BidsClosed';
  if (status === 'BidSubmissionOpen') return 'BidSubmissionOpen';
  if (start && now >= start) return 'BidSubmissionOpen';
  return status;
};

// Effective status, but a Draft (never published) stays Draft forever: without a
// publication the window dates carry no meaning.
exports.effectiveStatusForDisplay = function (tender) {
  if (tender.Status === 'Draft' || tender.Status === 'TenderDraft') return tender.Status;
  return exports.effectiveStatus(tender);
};

// Persist a time-triggered close (window passed). No-op if already closed.
// Used ONLY by write actions; audits + notifies the bid-opening authority.
exports.persistExpiry = async function persistExpiry(tender, actor) {
  if (tender.Status !== 'Published' && tender.Status !== 'BidSubmissionOpen') return tender;
  const eff = exports.effectiveStatus(tender);
  if (eff !== 'BidsClosed') return tender;

  const upt = await db.query(
    `UPDATE "Tender"
     SET "Status" = 'BidsClosed', "BidsClosedAt" = now(), "BidsClosedBy" = $1
     WHERE "TenderID" = $2 AND "Status" IN ('Published','BidSubmissionOpen') RETURNING *`,
    [actor.UserID, tender.TenderID]
  );
  if (!upt.rows.length) return tender;

  const remarks = `Bid submission window ended at ${tender.BidEndDate}; closed automatically by server clock for tender ${tender.TenderNo}.`;
  await db.query(
    `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks") VALUES ($1,$2,'BID_SUBMISSION_CLOSED',$3)`,
    [tender.EstimateID, actor.UserID, remarks]
  );
  await notifyOpeningAuthority(tender,
    `Bid submission for tender ${tender.TenderNo} closed at ${tender.BidEndDate}. Bids awaiting opening.`);
  await stopSla(tender.TenderID, 'Tender', 'closed');
  return upt.rows[0];
};

// One row to the bid-opening authority — the tender's current owner, who is the
// TenderOfficer that administers the tender (canonical ownership: bid opening
// belongs to the TenderOfficer, not the Director). Falls back to any active
// TenderOfficer if the owner row is stale/inactive.
async function notifyOpeningAuthority(tender, message) {
  const ownerId = tender && tender.CurrentOwner;
  const target = await db.query(
    `SELECT "UserID" FROM "Users"
     WHERE "UserID" = $1 AND "Designation" = 'TenderOfficer' AND "IsActive" = TRUE
     UNION
     SELECT "UserID" FROM "Users"
     WHERE "Designation" = 'TenderOfficer' AND "IsActive" = TRUE
     ORDER BY "UserID" LIMIT 1`,
    [ownerId || 0]
  );
  if (!target.rows.length) return;
  const estimateId = tender && tender.EstimateID;
  await db.query(
    `INSERT INTO "Notification" ("EstimateID","ToUserID","Type","Message") VALUES ($1,$2,'BidOpening',$3)`,
    [estimateId || null, target.rows[0].UserID, message]
  );
}
exports.notifyOpeningAuthority = notifyOpeningAuthority;

// Per-tender evaluation authority gate (brief §4/§5/§13). A tender created on or
// after migration 043 carries its configured authority; a NULL authority is a
// legacy tender which any tender.evaluate holder may evaluate.
exports.isEvalAuthority = function isEvalAuthority(tender, req) {
  if (!req || !req.user) return false;
  if (tender && tender.EvaluationAuthorityID != null) {
    return Number(tender.EvaluationAuthorityID) === Number(req.user.UserID);
  }
  return req.user.Designation === 'TenderOfficer';
};

// Capability flags for the tender detail screen.
exports.capabilities = async function capabilities(tender, req) {
  // Never-published drafts (Status Draft/TenderDraft) must not display or gate
  // as if the submission window were live — a Draft's window dates carry no
  // meaning until publish (see effectiveStatusForDisplay).
  const eff = exports.effectiveStatusForDisplay(tender);
  if (!req || !req.user) return { effectiveStatus: eff };
  const perms = (await getPermissions())[req.user.Designation] || new Set();
  const isTO = req.user.Designation === 'TenderOfficer';
  const isDirector = req.user.Designation === 'DirectorOfAdministration';
  const isEvalAuth = exports.isEvalAuthority(tender, req);
  return {
    effectiveStatus: eff,
    isReady: Number(tender.EstimatedCost) > 0,
    canPublish: isTO && tender.Status === 'TenderDraft',
    canClose: isTO && (eff === 'Published' || eff === 'BidSubmissionOpen'),
    canEdit: isTO && (tender.Status === 'TenderDraft' || !tender.PublishedDate),
    canSubmitBid: perms.has('bid.submit') && (eff === 'Published' || eff === 'BidSubmissionOpen'),
    canManageBids: perms.has('bid.submit') || perms.has('bid.view'),
    canStartOpening: perms.has('bid.open') && eff === 'BidsClosed',
    canOpenIndividual: perms.has('bid.open') && eff === 'BidOpeningInProgress',
    canCompleteOpening: perms.has('bid.open') && eff === 'BidOpeningInProgress',
    canViewFinancial: perms.has('bid.financial.view'),
    // Evaluation Authority (per-tender, default = creating TenderOfficer)
    isEvaluationAuthority: isEvalAuth,
    canEvaluateTechnical: perms.has('tender.evaluate') && isEvalAuth && (eff === exports.TECH_EVAL_PENDING || eff === exports.TECH_EVAL),
    canEvaluateFinancial: perms.has('tender.evaluate') && isEvalAuth && eff === exports.FIN_EVAL_PENDING,
    canIdentifyL1: perms.has('tender.evaluate') && isEvalAuth && eff === exports.FIN_EVAL,
    // Director hands: award → LOA → work order → agreement. The LOA does not
    // move Tender.Status, so Work Order stays the next action after the LOA.
    canAward: isDirector && perms.has('tender.award') && eff === exports.L1_IDENTIFIED,
    canIssueLOA: isDirector && perms.has('tender.workOrder') && eff === exports.WORK_AWARDED,
    canIssueWorkOrder: isDirector && perms.has('tender.workOrder') && eff === exports.WORK_AWARDED,
    canRecordAgreement: isDirector && perms.has('tender.agreement') && eff === exports.WORK_ORDER_ISSUED,
  };
};