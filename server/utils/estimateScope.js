// Shared builder for scoping EstimateHeader queries by the current user.
// Used by both the estimate list endpoint and the dashboard queue counts so
// that the numbers on the cards always match the rows shown in the list.

const db = require('../config/db');

// scope: 'assigned' (CurrentOwner = user) | 'created' (CreatedBy = user)
//        | 'assignedOrCreated' | null (no ownership condition)
// statuses: array of Status values (SQL ANY)
// actions: workflow Action names performed by the user (EXISTS subquery)
// search: free-text against EstimateNo / NameOfWork / EstimateID
// stage: pipeline stage name from PIPELINE_STAGES (requires the `ou`
//        current-owner join in the surrounding query — see PIPELINE_STAGE_EXPR)
function buildEstimateScope({ userId, scope = null, statuses = null, actions = null, search = null, stage = null, today = false }) {
  const params = [];
  const conds = [];

  if (scope === 'assigned' || scope === 'created' || scope === 'assignedOrCreated') {
    params.push(userId);
    const u = params.length;
    if (scope === 'assigned') conds.push(`eh."CurrentOwner" = $${u}`);
    else if (scope === 'created') conds.push(`eh."CreatedBy" = $${u}`);
    else conds.push(`(eh."CurrentOwner" = $${u} OR eh."CreatedBy" = $${u})`);
  }

  if (statuses && statuses.length) {
    params.push(statuses);
    conds.push(`eh."Status" = ANY($${params.length})`);
  }

  if (actions && actions.length) {
    params.push(userId);
    const fromIdx = params.length;
    params.push(actions);
    const actIdx = params.length;
    conds.push(
      `EXISTS (SELECT 1 FROM "Workflow" w
               WHERE w."EstimateID" = eh."EstimateID"
                 AND w."FromUserID" = $${fromIdx}
                 AND w."Action" = ANY($${actIdx})${today ? ' AND w."DateTime" >= CURRENT_DATE' : ''})`
    );
  }

  if (stage) {
    params.push(stage);
    conds.push(`${PIPELINE_STAGE_EXPR} = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conds.push(
      `(eh."EstimateNo" ILIKE $${params.length} OR eh."NameOfWork" ILIKE $${params.length} OR eh."EstimateID"::text ILIKE $${params.length})`
    );
  }

  return { conds, params };
}

// Priority ordering: statuses needing immediate attention first, then newest.
const PRIORITY_CASE = `
  CASE eh."Status"
    WHEN 'Draft' THEN 1
    WHEN 'Submitted' THEN 2
    WHEN 'Reverted' THEN 3
    WHEN 'DGM_Approved' THEN 4
    WHEN 'GM_Recommended' THEN 5
    WHEN 'CGM_Submitted' THEN 6
    WHEN 'DOP_Approved' THEN 7
    WHEN 'ED_Approved' THEN 8
    WHEN 'MD_Approved' THEN 9
    WHEN 'FinalApproved' THEN 10
    WHEN 'FCNGenerated' THEN 11
    WHEN 'AdminSanctionGenerated' THEN 12
    WHEN 'GMReviewed' THEN 13
    WHEN 'DGMReviewed' THEN 14
    WHEN 'Signed' THEN 15
    WHEN 'TenderPublished' THEN 16
    WHEN 'TenderClosed' THEN 17
    WHEN 'TechnicalEvaluation' THEN 18
    WHEN 'FinancialEvaluation' THEN 19
    WHEN 'L1Identified' THEN 20
    WHEN 'WorkAwarded' THEN 21
    WHEN 'WorkOrderIssued' THEN 22
    WHEN 'AgreementExecuted' THEN 23
    WHEN 'AgencySelected' THEN 24
    WHEN 'WorkStarted' THEN 25
    WHEN 'WorkCompleted' THEN 26
    WHEN 'Billing' THEN 27
    WHEN 'Completed' THEN 28
    ELSE 29
  END ASC`;

// Authoritative Manager "My Estimate Pipeline / Estimates Currently With" stages.
// Fixed order — do not add/remove/reorder. These are ownership positions, NOT
// approval-status names (the Estimate Approval Process is a separate concept).
const PIPELINE_STAGES = ['Draft', 'DGM', 'GM', 'CGM', 'DOP', 'ED', 'MD', 'FCN', 'DirectorAdmin', 'GMReview', 'DGMReview', 'Approved'];

// SQL expression mapping an estimate row to its pipeline stage. Requires the
// query to alias the current-owner user join as `ou`
// (LEFT JOIN "Users" ou ON ou."UserID" = eh."CurrentOwner").
// - Draft/Reverted  -> still being prepared/edited by the creator
// - post-approval statuses -> final approval complete ("Approved")
// - everything in between -> whichever role currently owns the estimate;
//   falls back to the status-implied holder if the owner row is missing.
const PIPELINE_STAGE_EXPR = `
  CASE
    WHEN eh."Status" IN ('Draft', 'Reverted') THEN 'Draft'
    WHEN eh."Status" IN ('Signed', 'TenderPublished', 'TenderClosed',
                         'TechnicalEvaluation', 'FinancialEvaluation',
                         'L1Identified', 'WorkAwarded', 'WorkOrderIssued',
                         'AgreementExecuted', 'AgencySelected',
                         'WorkStarted', 'WorkCompleted', 'Billing', 'Completed')
      THEN 'Approved'
    ELSE COALESCE(ou."Designation",
      CASE eh."Status"
        WHEN 'Submitted' THEN 'DGM'
        WHEN 'DGM_Approved' THEN 'GM'
        WHEN 'GM_Recommended' THEN 'CGM'
        WHEN 'CGM_Submitted' THEN 'DOP'
        WHEN 'DOP_Approved' THEN 'ED'
        WHEN 'ED_Approved' THEN 'MD'
        WHEN 'FinalApproved' THEN 'FCN'
        WHEN 'FCNGenerated' THEN 'DirectorAdmin'
        WHEN 'AdminSanctionGenerated' THEN 'GMReview'
        WHEN 'GMReviewed' THEN 'DGMReview'
        WHEN 'DGMReviewed' THEN 'DGMReview'
      END)
  END`;

function orderClause(sort) {
  return sort === 'priority' ? `${PRIORITY_CASE}, eh."CreatedDate" DESC` : 'eh."CreatedDate" DESC';
}

async function countScope(userId, spec) {
  const { conds, params } = buildEstimateScope({ userId, ...spec });
  const res = await db.query(
    `SELECT COUNT(*)::int AS "n" FROM "EstimateHeader" eh WHERE ${conds.join(' AND ')}`,
    params
  );
  return res.rows[0].n;
}

module.exports = { buildEstimateScope, countScope, orderClause, PIPELINE_STAGES, PIPELINE_STAGE_EXPR };
