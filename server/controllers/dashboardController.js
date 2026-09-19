const db = require('../config/db');
const { buildEstimateScope, countScope, PIPELINE_STAGES, PIPELINE_STAGE_EXPR } = require('../utils/estimateScope');
const { getSlaSummary } = require('../utils/sla');
const { isLocationRole, accessibleCirclesSql, estimateScopeConds } = require('../services/locationScope');

// Bills sitting on a role's desk (by CurrentOwner + stage), oldest-SLA first.
async function billQueueFor(userId, statuses) {
  if (!statuses.length) return [];
  return (await db.query(
    `SELECT b.*, eh."EstimateNo", eh."NameOfWork", eh."WorkID",
            u."Name" as "SubmittedByName", cu."Name" as "CurrentOwnerName",
            ag."AgencyName", ag."ContractorName"
     FROM "Billing" b
     JOIN "EstimateHeader" eh ON eh."EstimateID" = b."EstimateID"
     LEFT JOIN "Users" u ON u."UserID" = b."SubmittedBy"
     LEFT JOIN "Users" cu ON cu."UserID" = b."CurrentOwner"
     LEFT JOIN "Agency" ag ON ag."EstimateID" = eh."EstimateID"
     WHERE b."CurrentOwner" = $1 AND b."Status" = ANY($2)
     ORDER BY b."SlaDueAt" ASC NULLS LAST, b."BillID" DESC
     LIMIT 20`,
    [userId, statuses]
  )).rows;
}

async function billMetricsFor(userId, statuses, checkAction, returnAction) {
  return (await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM "Billing" WHERE "CurrentOwner" = $1 AND "Status" = ANY($2)) as "pendingBillCheck",
       (SELECT COUNT(*)::int FROM "BillWorkflow" WHERE "FromUserID" = $1 AND "Action" = $3 AND "DateTime" >= CURRENT_DATE) as "checkedToday",
       (SELECT COUNT(*)::int FROM "BillWorkflow" WHERE "FromUserID" = $1 AND "Action" = $4) as "returnedBills",
       (SELECT COUNT(*)::int FROM "BillWorkflow" WHERE "FromUserID" = $1 AND "Action" = $3) as "totalChecked"
     LIMIT 1`,
    [userId, statuses, checkAction, returnAction]
  )).rows[0];
}

// 8-stage approval workflow counts for the GM/CGM/DOP/ED/MD dashboards. Mirrors
// the Manager/DGM pipeline (same authoritative PIPELINE_STAGES + stage expr) so
// every stage card equals the /estimates?stage=<stage> click-through rows.
// `baseScope` is 'assignedOrCreated' for location roles (GM/CGM) and null for
// board-wide roles (DOP/ED/MD) whose desk spans every circle.
async function rolePipelineFor(user, baseScope) {
  const scope = baseScope
    ? buildEstimateScope({ userId: user.UserID, scope: baseScope })
    : { conds: [], params: [] };
  const locScope = await estimateScopeConds(user, 'eh', scope.params.length + 1);
  const pipelineRows = await db.query(
    `SELECT ${PIPELINE_STAGE_EXPR} AS "Stage", COUNT(*)::int AS "count"
     FROM "EstimateHeader" eh
     LEFT JOIN "Users" ou ON ou."UserID" = eh."CurrentOwner"
     WHERE ${[...scope.conds, ...locScope.conds].join(' AND ') || 'TRUE'}
     GROUP BY 1`,
    [...scope.params, ...locScope.params]
  );
  const pipeline = Object.fromEntries(PIPELINE_STAGES.map(s => [s, 0]));
  pipelineRows.rows.forEach(r => { if (r.Stage in pipeline) pipeline[r.Stage] = r.count; });
  return pipeline;
}

// Rows for the shared "Attention Required — Escalated" panel. Count matches the
// role's `escalated` metric above (same >3-day predicate), so the panel badge
// always equals what the list rows show.
async function escalatedQueueFor(userId, statuses) {
  const statusCond = statuses ? `AND eh."Status" = ANY($2)` : '';
  const params = statuses ? [userId, statuses] : [userId];
  return (await db.query(
    `SELECT eh."EstimateID", eh."EstimateNo", eh."NameOfWork", eh."Status",
            eh."Version", eh."SubmissionDate", u."Name" as "CreatedByName",
            COALESCE(ab."GrandTotal",0) as "GrandTotal",
            EXTRACT(EPOCH FROM (NOW() - COALESCE(eh."SubmissionDate", eh."CreatedDate"))) / 86400 as "daysWaiting"
     FROM "EstimateHeader" eh
     LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
     LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
     WHERE eh."CurrentOwner" = $1 ${statusCond}
       AND (NOW() - COALESCE(eh."SubmissionDate", eh."CreatedDate")) > INTERVAL '3 days'
     ORDER BY eh."SubmissionDate" ASC NULLS LAST`,
    params
  )).rows;
}

exports.getStats = async (req, res, next) => {
  try {
    const userId = req.user.UserID;
    const designation = req.user.Designation;

    // Location-scope enforcement for the board-wide summary cards. Non-board
    // roles only see counts inside their assigned circles (or created by them).
    const locScope = isLocationRole(designation);
    const locParams = locScope ? [userId] : [];
    const locWhere = locScope
      ? `("CircleID" IN (${accessibleCirclesSql(designation, 1)}) OR "CreatedBy" = $1)`
      : null;
    const locJoin = locScope
      ? `(eh."CircleID" IN (${accessibleCirclesSql(designation, 1)}) OR eh."CreatedBy" = $1)`
      : null;

    // Global stats
    const globalStats = await db.query(`
      SELECT
        COUNT(*)::int as "total",
        COUNT(*) FILTER (WHERE "Status"='Draft')::int as "draft",
        COUNT(*) FILTER (WHERE "Status"='Submitted')::int as "submitted",
        COUNT(*) FILTER (WHERE "Status"='Reverted')::int as "reverted",
        COUNT(*) FILTER (WHERE "Status"='DGM_Approved')::int as "dgm_approved",
        COUNT(*) FILTER (WHERE "Status"='Approved')::int as "approved",
        COUNT(*) FILTER (WHERE "Status"='Signed')::int as "signed",
        COUNT(*) FILTER (WHERE "Status"='TenderPublished')::int as "tender_published",
        COUNT(*) FILTER (WHERE "Status"='AgencySelected')::int as "agency_selected",
        COUNT(*) FILTER (WHERE "Status"='WorkStarted')::int as "work_started",
        COUNT(*) FILTER (WHERE "Status"='WorkCompleted')::int as "work_completed",
        COUNT(*) FILTER (WHERE "Status"='Billing')::int as "billing",
        COUNT(*) FILTER (WHERE "Status"='Completed')::int as "completed",
        COUNT(*) FILTER (WHERE "CreatedDate" >= CURRENT_DATE)::int as "today",
        COUNT(*) FILTER (WHERE "CreatedDate" >= date_trunc('month', CURRENT_DATE))::int as "this_month"
      FROM "EstimateHeader"
      ${locWhere ? 'WHERE ' + locWhere : ''}
    `, locParams);

    const totalValue = await db.query(`
      SELECT COALESCE(SUM(ab."GrandTotal"),0) as "totalValue" FROM "Abstract" ab
      ${locJoin ? `JOIN "EstimateHeader" eh ON eh."EstimateID" = ab."EstimateID" AND ${locJoin}` : ''}
    `, locParams);

    const ehScope = locJoin
      ? `AND EXISTS (SELECT 1 FROM "EstimateHeader" eh WHERE eh."EstimateID" = t."EstimateID" AND ${locJoin})`
      : '';
    const moduleCounts = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM "Tender" t WHERE t."Status" <> 'Awarded' ${ehScope}) as "pendingTenders",
        (SELECT COUNT(*)::int FROM "Agency" a WHERE EXISTS (SELECT 1 FROM "EstimateHeader" eh WHERE eh."EstimateID" = a."EstimateID" AND ${locJoin || 'TRUE'})) as "agenciesAssigned",
        (SELECT COUNT(*)::int FROM "EstimateHeader" eh WHERE eh."Status" = 'WorkStarted' AND (${locJoin || 'TRUE'})) as "worksInProgress",
        (SELECT COUNT(*)::int FROM "Billing" b WHERE b."Status" NOT IN ('Paid','Cancelled') AND EXISTS (SELECT 1 FROM "EstimateHeader" eh WHERE eh."EstimateID" = b."EstimateID" AND ${locJoin || 'TRUE'})) as "billsPending",
        (SELECT COUNT(*)::int FROM "Tender" t WHERE t."Status" = 'Awarded' ${ehScope}) as "awardedTenders",
        (SELECT COUNT(*)::int FROM "Billing" b WHERE b."Status" = 'Paid' AND EXISTS (SELECT 1 FROM "EstimateHeader" eh WHERE eh."EstimateID" = b."EstimateID" AND ${locJoin || 'TRUE'})) as "billsPaid"
    `, locParams);

    // Role-scoped queue counts. Every card on the dashboard maps to one of these
    // so the badge value always matches the rows the filtered list returns.
    const [
      q_myAssigned,
      q_myAssignedActive,
      q_pendingReview,
      q_pendingApproval,
      q_toSign,
      q_readyForTender,
      q_pendingSelection,
      q_pendingStart,
      q_inProgress,
      q_pendingBills,
      q_pendingArchive,
      q_drafts,
      q_reverted,
      q_createdByMe,
      q_submittedCreated,
      q_approvedToGM,
      q_published,
      q_selected,
      q_completedWorks,
      q_submittedBills,
      q_archived,
    ] = await Promise.all([
      countScope(userId, { scope: 'assigned' }),
      countScope(userId, { scope: 'assigned', statuses: ['Submitted', 'DGM_Approved', 'Approved', 'Signed', 'TenderPublished', 'AgencySelected', 'WorkStarted', 'WorkCompleted', 'Billing', 'Reverted', 'Draft'] }),
      countScope(userId, { scope: 'assigned', statuses: ['Submitted'] }),
      countScope(userId, { scope: 'assigned', statuses: ['DGM_Approved', 'Approved'] }),
      countScope(userId, { scope: 'assigned', statuses: ['DGM_Approved'] }),
      countScope(userId, { scope: 'assigned', statuses: ['Signed', 'TSApproved'] }),
      countScope(userId, { scope: 'assigned', statuses: ['TenderPublished'] }),
      countScope(userId, { scope: 'assigned', statuses: ['AgencySelected'] }),
      countScope(userId, { scope: 'assigned', statuses: ['WorkStarted'] }),
      countScope(userId, { scope: 'assigned', statuses: ['WorkCompleted'] }),
      countScope(userId, { scope: 'assigned', statuses: ['Billing'] }),
      countScope(userId, { scope: 'assigned', statuses: ['Draft'] }),
      countScope(userId, { scope: 'assigned', statuses: ['Reverted'] }),
      countScope(userId, { scope: 'created' }),
      countScope(userId, { scope: 'created', statuses: ['Submitted'] }),
      countScope(userId, { statuses: ['DGM_Approved'], actions: ['Approve'] }),
      countScope(userId, { statuses: ['TenderPublished'], actions: ['PublishTender'] }),
      countScope(userId, { statuses: ['AgencySelected'], actions: ['SelectAgency'] }),
      countScope(userId, { statuses: ['WorkCompleted'], actions: ['CompleteWork'] }),
      countScope(userId, { statuses: ['Billing'], actions: ['SubmitBill'] }),
      countScope(userId, { scope: 'assigned', statuses: ['Completed'] }),
    ]);

    // My created estimates (for Manager)
    const myEstimates = await db.query(`
      SELECT eh.*, u."Name" as "CreatedByName", COALESCE(ab."GrandTotal",0) as "GrandTotal"
      FROM "EstimateHeader" eh
      LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
      LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
      WHERE eh."CreatedBy" = $1 OR eh."CurrentOwner" = $1
      ORDER BY eh."CreatedDate" DESC LIMIT 10
    `, [userId]);

    // DGM-specific: estimates awaiting review + escalation + queue details
    let dgmDashboard = null;
    if (designation === 'DGM') {
      const dgmStatusBreakdown = await db.query(`
        SELECT "Status", COUNT(*)::int as "count"
        FROM "EstimateHeader"
        WHERE "CurrentOwner" = $1 OR "Status" = 'Submitted'
        GROUP BY "Status"
      `, [userId]);

      // Estimates assigned to DGM with full details for the queue
      const dgmQueue = await db.query(`
        SELECT
          eh."EstimateID", eh."EstimateNo", eh."NameOfWork", eh."Status",
          eh."Version", eh."CreatedDate", eh."SubmissionDate",
          u."Name" as "CreatedByName",
          COALESCE(ab."GrandTotal", 0) as "GrandTotal",
          EXTRACT(EPOCH FROM (NOW() - COALESCE(eh."SubmissionDate", eh."CreatedDate"))) / 86400 as "daysWaiting"
        FROM "EstimateHeader" eh
        LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
        LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
        WHERE eh."CurrentOwner" = $1 AND eh."Status" = 'Submitted'
        ORDER BY eh."SubmissionDate" ASC NULLS LAST, eh."CreatedDate" ASC
      `, [userId]);

      // Escalation: estimates assigned to DGM waiting > 3 days
      const dgmEscalated = await db.query(`
        SELECT
          eh."EstimateID", eh."EstimateNo", eh."NameOfWork", eh."Status",
          eh."Version", eh."SubmissionDate",
          u."Name" as "CreatedByName",
          COALESCE(ab."GrandTotal", 0) as "GrandTotal",
          EXTRACT(EPOCH FROM (NOW() - COALESCE(eh."SubmissionDate", eh."CreatedDate"))) / 86400 as "daysWaiting"
        FROM "EstimateHeader" eh
        LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
        LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
        WHERE eh."CurrentOwner" = $1 AND eh."Status" = 'Submitted'
          AND (NOW() - COALESCE(eh."SubmissionDate", eh."CreatedDate")) > INTERVAL '3 days'
        ORDER BY eh."SubmissionDate" ASC NULLS LAST
      `, [userId]);

      // DGM operational metrics
      const dgmMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'Submitted') as "pendingReview",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'Reverted') as "revertedToMe",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" IN ('TSPending', 'TSApproved')) as "postApprovalPending",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'Approve') as "approvedByMe",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "Status" = 'DGM_Approved') as "waitingForGM",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'ReturnToGM') as "returnsSent",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'Submitted'
            AND (NOW() - COALESCE("SubmissionDate", "CreatedDate")) > INTERVAL '3 days') as "escalatedReviews",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1) as "totalInScope"
      `, [userId]);

      // Oldest waiting estimate
      const oldestWaiting = await db.query(`
        SELECT
          eh."EstimateNo", eh."NameOfWork",
          EXTRACT(EPOCH FROM (NOW() - COALESCE(eh."SubmissionDate", eh."CreatedDate"))) / 86400 as "daysWaiting"
        FROM "EstimateHeader" eh
        WHERE eh."CurrentOwner" = $1 AND eh."Status" = 'Submitted'
        ORDER BY eh."SubmissionDate" ASC NULLS LAST, eh."CreatedDate" ASC
        LIMIT 1
      `, [userId]);

      dgmDashboard = {
        statusBreakdown: dgmStatusBreakdown.rows,
        queue: dgmQueue.rows,
        escalated: dgmEscalated.rows,
        metrics: dgmMetrics.rows[0],
        oldestWaiting: oldestWaiting.rows[0] || null,
      };

      // DGM division-scoped estimate pipeline. Same authoritative stages as the
      // Manager "My Estimate Pipeline" but scoped to the DGM's assigned Circles
      // (+ their own creations), so every card count equals the rows the
      // /estimates?stage=<stage> click-through opens (count == click-through).
      const dgmScope = buildEstimateScope({ userId, scope: 'assignedOrCreated' });
      const dgmLocScope = await estimateScopeConds(req.user, 'eh', dgmScope.params.length + 1);
      const pipelineRows = await db.query(`
        SELECT ${PIPELINE_STAGE_EXPR} AS "Stage", COUNT(*)::int AS "count"
        FROM "EstimateHeader" eh
        LEFT JOIN "Users" ou ON ou."UserID" = eh."CurrentOwner"
        WHERE ${[...dgmScope.conds, ...dgmLocScope.conds].join(' AND ')}
        GROUP BY 1
      `, [...dgmScope.params, ...dgmLocScope.params]);
      const pipeline = Object.fromEntries(PIPELINE_STAGES.map(s => [s, 0]));
      pipelineRows.rows.forEach(r => { if (r.Stage in pipeline) pipeline[r.Stage] = r.count; });
      dgmDashboard.pipeline = pipeline;

      // Bill check queue for DGM (Level 2)
      const dgmBillStatuses = ['ManagerChecked', 'ReturnedToDGM'];
      dgmDashboard.billing = await billQueueFor(userId, dgmBillStatuses);
      dgmDashboard.billingMetrics = await billMetricsFor(userId, dgmBillStatuses, 'DGM_BILL_CHECKED', 'DGM_BILL_RETURNED');
    }

    // GM-specific: digital signature queue + return to Director capability
    let gmDashboard = null;
    if (designation === 'GM') {
      const gmQueue = await db.query(`
        SELECT
          eh."EstimateID", eh."EstimateNo", eh."NameOfWork", eh."Status",
          eh."Version", eh."CreatedDate", eh."SubmissionDate",
          u."Name" as "CreatedByName",
          COALESCE(ab."GrandTotal", 0) as "GrandTotal",
          EXTRACT(EPOCH FROM (NOW() - eh."CreatedDate")) / 86400 as "daysWaiting",
          (SELECT w2."Action" FROM "Workflow" w2
           WHERE w2."EstimateID" = eh."EstimateID"
           ORDER BY w2."DateTime" DESC LIMIT 1) as "lastAction"
        FROM "EstimateHeader" eh
        LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
        LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
        WHERE eh."CurrentOwner" = $1 AND eh."Status" IN ('DGM_Approved', 'Approved', 'TSPending')
        ORDER BY eh."CreatedDate" ASC
      `, [userId]);

      const gmMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" IN ('DGM_Approved','Approved')) as "pendingReview",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'TSPending') as "awaitingReview",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'ApproveTS') as "forwarded",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'DigitallySign'
            AND "DateTime" >= CURRENT_DATE) as "approvedToday",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'ReturnTS'
            AND "DateTime" >= CURRENT_DATE) as "returnsSentToday",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'ReturnTS') as "totalReturns"
      `, [userId]);

      gmDashboard = {
        queue: gmQueue.rows,
        metrics: gmMetrics.rows[0],
      };

      // GM zone-scoped approval pipeline (Manager→…→Approved) + escalated rows.
      gmDashboard.pipeline = await rolePipelineFor(req.user, 'assignedOrCreated');
      gmDashboard.escalated = await escalatedQueueFor(userId, ['DGM_Approved', 'Approved', 'TSPending']);

      // Bill check queue for GM (Level 3 → Finance)
      const gmBillStatuses = ['DGMChecked'];
      gmDashboard.billing = await billQueueFor(userId, gmBillStatuses);
      gmDashboard.billingMetrics = await billMetricsFor(userId, gmBillStatuses, 'GM_BILL_CHECKED', 'GM_BILL_RETURNED');
    }

    // Manager-specific: status breakdown + escalation + downstream
    let managerDashboard = null;
    if (designation === 'Manager') {
      // My Estimate Pipeline / Estimates Currently With. Uses the exact same
      // stage predicate as the /estimates/my?stage=... list filter, so every
      // count equals the rows its click-through opens.
      const pipelineRows = await db.query(`
        SELECT ${PIPELINE_STAGE_EXPR} AS "Stage", COUNT(*)::int AS "count"
        FROM "EstimateHeader" eh
        LEFT JOIN "Users" ou ON ou."UserID" = eh."CurrentOwner"
        WHERE eh."CreatedBy" = $1
        GROUP BY 1
      `, [userId]);
      const pipeline = Object.fromEntries(PIPELINE_STAGES.map(s => [s, 0]));
      pipelineRows.rows.forEach(r => { if (r.Stage in pipeline) pipeline[r.Stage] = r.count; });

      // Status breakdown for Manager's own estimates
      const statusBreakdown = await db.query(`
        SELECT "Status", COUNT(*)::int as "count"
        FROM "EstimateHeader"
        WHERE "CreatedBy" = $1
        GROUP BY "Status"
      `, [userId]);

      // Escalation: Manager's estimates not in Draft/Completed, with wait time
      const escalated = await db.query(`
        SELECT
          eh."EstimateID", eh."EstimateNo", eh."NameOfWork", eh."Status",
          eh."Version", eh."CreatedDate",
          u."Name" as "CurrentOwnerName",
          EXTRACT(EPOCH FROM (NOW() - eh."CreatedDate")) / 86400 as "daysSinceCreated",
          EXTRACT(EPOCH FROM (NOW() - (
            SELECT MAX(w."DateTime") FROM "Workflow" w WHERE w."EstimateID" = eh."EstimateID"
          ))) / 86400 as "daysAtCurrentStage",
          (SELECT w2."Action" FROM "Workflow" w2
           WHERE w2."EstimateID" = eh."EstimateID"
           ORDER BY w2."DateTime" DESC LIMIT 1) as "lastAction"
        FROM "EstimateHeader" eh
        LEFT JOIN "Users" u ON u."UserID" = eh."CurrentOwner"
        WHERE eh."CreatedBy" = $1
          AND eh."Status" NOT IN ('Draft', 'Completed')
        ORDER BY eh."CreatedDate" DESC
        LIMIT 15
      `, [userId]);

      // Downstream: approved+ estimates showing current downstream status
      const downstream = await db.query(`
        SELECT
          eh."EstimateID", eh."EstimateNo", eh."NameOfWork", eh."Status",
          eh."Version",
          COALESCE(ab."GrandTotal", 0) as "GrandTotal",
          t."Status" as "TenderStatus",
          CASE
            WHEN eh."Status" = 'Completed' THEN 'Completed'
            WHEN eh."Status" = 'Billing' THEN 'Billing'
            WHEN eh."Status" = 'WorkStarted' THEN 'Work In Progress'
            WHEN eh."Status" = 'WorkCompleted' THEN 'Work Completed'
            WHEN eh."Status" = 'AgencySelected' THEN 'Agency Selected'
            WHEN eh."Status" = 'TenderPublished' THEN 'Tender Published'
            WHEN eh."Status" = 'DGMReviewed' THEN 'Ready for Tender'
            WHEN eh."Status" = 'GMReviewed' THEN 'GM Reviewed'
            WHEN eh."Status" = 'AdminSanctionGenerated' THEN 'Sanction Generated'
            WHEN eh."Status" = 'FCNGenerated' THEN 'FCN Generated'
            WHEN eh."Status" = 'FinalApproved' THEN 'MD Approved'
            WHEN eh."Status" = 'Signed' THEN 'Signed'
            WHEN eh."Status" = 'Approved' THEN 'Approved'
            ELSE eh."Status"
          END as "DownstreamLabel"
        FROM "EstimateHeader" eh
        LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
        LEFT JOIN "Tender" t ON t."EstimateID" = eh."EstimateID"
        WHERE eh."CreatedBy" = $1
          AND eh."Status" NOT IN ('Draft', 'Reverted', 'Submitted')
        ORDER BY
          CASE eh."Status"
            WHEN 'Completed' THEN 12
            WHEN 'Billing' THEN 11
            WHEN 'WorkCompleted' THEN 10
            WHEN 'WorkStarted' THEN 9
            WHEN 'AgencySelected' THEN 8
            WHEN 'TenderPublished' THEN 7
            WHEN 'Signed' THEN 6
            WHEN 'Approved' THEN 5
          END DESC
        LIMIT 15
      `, [userId]);

      // Operational metrics scoped to Manager's estimates
      const operationalMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CreatedBy" = $1) as "totalWorks",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CreatedBy" = $1 AND "Status" = 'WorkStarted') as "runningWorks",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CreatedBy" = $1 AND "Status" = 'Completed') as "completedWorks",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CreatedBy" = $1 AND "Status" NOT IN ('WorkStarted', 'Completed')) as "pendingWorks",
          (SELECT COUNT(*)::int FROM "Tender" t JOIN "EstimateHeader" eh ON eh."EstimateID" = t."EstimateID" WHERE eh."CreatedBy" = $1) as "totalTenders",
          (SELECT COUNT(*)::int FROM "Tender" t JOIN "EstimateHeader" eh ON eh."EstimateID" = t."EstimateID" WHERE eh."CreatedBy" = $1 AND t."Status" <> 'Awarded') as "activeTenders",
          (SELECT COUNT(*)::int FROM "Tender" t JOIN "EstimateHeader" eh ON eh."EstimateID" = t."EstimateID" WHERE eh."CreatedBy" = $1 AND t."Status" = 'Awarded') as "awardedTenders",
          (SELECT COUNT(*)::int FROM "Billing" b JOIN "EstimateHeader" eh ON eh."EstimateID" = b."EstimateID" WHERE eh."CreatedBy" = $1 AND b."Status" NOT IN ('Paid', 'Cancelled')) as "pendingBills",
          (SELECT COALESCE(SUM(ab."GrandTotal"), 0) FROM "Abstract" ab JOIN "EstimateHeader" eh ON eh."EstimateID" = ab."EstimateID" WHERE eh."CreatedBy" = $1) as "totalAmount"
      `, [userId]);

      managerDashboard = {
        pipeline,
        statusBreakdown: statusBreakdown.rows,
        escalation: escalated.rows,
        downstream: downstream.rows,
        operationalMetrics: operationalMetrics.rows[0],
      };

      // Bill check queue for Manager (Level 1)
      const managerBillStatuses = ['SubmittedToManager', 'ReturnedToManager'];
      managerDashboard.billing = await billQueueFor(userId, managerBillStatuses);
      managerDashboard.billingMetrics = await billMetricsFor(userId, managerBillStatuses, 'MANAGER_BILL_CHECKED', 'MANAGER_BILL_RETURNED');
    }

    // Tender Officer-specific: tender pipeline + queue.
    // The Ready-for-Tender queue and KPI both come from the authoritative
    // eligibility query (getReadyForTender) so KPI count always == queue rows.
    // T3 metrics are scoped to Tender."CurrentOwner" and refreshed against the
    // server clock (windows that have ended are persisted as BidsClosed) so
    // KPI counts are always current, then counted by raw persisted status.
    let tenderOfficerDashboard = null;
    if (designation === 'TenderOfficer') {
      const { getReadyForTender } = require('../utils/tenderReady');
      const tenderState = require('../utils/tenderState');
      const readyRows = await getReadyForTender(userId);

      const expiring = await db.query(
        `SELECT * FROM "Tender" WHERE "CurrentOwner" = $1 AND "Status" IN ('Published','BidSubmissionOpen')`,
        [userId]
      );
      for (const row of expiring.rows) {
        await tenderState.persistExpiry(row, req.user);
      }

      const toMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "Tender" t JOIN "EstimateHeader" eh ON eh."EstimateID" = t."EstimateID" WHERE t."CurrentOwner" = $1 AND t."Status" = 'TenderDraft') as "tenderDrafts",
          (SELECT COUNT(*)::int FROM "Tender" t JOIN "EstimateHeader" eh ON eh."EstimateID" = t."EstimateID" WHERE t."CurrentOwner" = $1 AND t."Status" = 'Published') as "published",
          (SELECT COUNT(*)::int FROM "Tender" t JOIN "EstimateHeader" eh ON eh."EstimateID" = t."EstimateID" WHERE t."CurrentOwner" = $1 AND t."Status" IN ('Published','BidSubmissionOpen')) as "bidOpen",
          (SELECT COUNT(*)::int FROM "Tender" t JOIN "EstimateHeader" eh ON eh."EstimateID" = t."EstimateID" WHERE t."CurrentOwner" = $1 AND t."Status" IN ('Published','BidSubmissionOpen') AND t."BidEndDate" <= now() + interval '48 hours') as "closingSoon",
          (SELECT COUNT(*)::int FROM "Bid" b JOIN "Tender" t ON b."TenderID" = t."TenderID" JOIN "EstimateHeader" eh ON eh."EstimateID" = t."EstimateID" WHERE t."CurrentOwner" = $1) as "totalBids"
      `, [userId]);
      const toMetricsRow = toMetrics.rows[0] || {};

      // Tender pipeline queue: everything the officer administers after
      // publication, ordered by stage. Pipeline KPIs below are counted from
      // these very rows, so a KPI can never disagree with its queue.
      const toPipeline = await db.query(
        `SELECT
           t.\"TenderID\", t.\"TenderNo\", t.\"Status\", t.\"BidStartDate\", t.\"BidEndDate\",
           t.\"BidOpeningCompletedAt\", t.\"WorkOrderNo\", t.\"AgreementNo\",
           eh.\"EstimateID\", eh.\"EstimateNo\", eh.\"NameOfWork\",
           (SELECT COUNT(*)::int FROM \"Bid\" b WHERE b.\"TenderID\" = t.\"TenderID\") as \"bidCount\"
         FROM \"Tender\" t JOIN \"EstimateHeader\" eh ON eh.\"EstimateID\" = t.\"EstimateID\"
         WHERE t.\"CurrentOwner\" = $1 AND t.\"Status\" IN
           ('Published','BidSubmissionOpen','BidsClosed','BidOpeningInProgress','TechnicalEvaluationPending',
            'UnderTechnicalEvaluation','FinancialEvaluationPending','FinancialEvaluation','L1Identified',
            'WorkAwarded','WorkOrderIssued','AgreementExecuted')
         ORDER BY CASE t.\"Status\"
           WHEN 'Published' THEN 2 WHEN 'BidSubmissionOpen' THEN 3 WHEN 'BidsClosed' THEN 4
           WHEN 'BidOpeningInProgress' THEN 5 WHEN 'TechnicalEvaluationPending' THEN 6
           WHEN 'UnderTechnicalEvaluation' THEN 7 WHEN 'FinancialEvaluationPending' THEN 8
           WHEN 'FinancialEvaluation' THEN 9 WHEN 'L1Identified' THEN 10
           WHEN 'WorkAwarded' THEN 11 WHEN 'WorkOrderIssued' THEN 12 ELSE 13 END,
           t.\"BidEndDate\" ASC`,
        [userId]
      );
      const pipelineRows = toPipeline.rows;
      const count = (s) => pipelineRows.filter(r => r.Status === s).length;
      const pipelineMetrics = {
        bidsClosed: count('BidsClosed'),
        bidOpeningInProgress: count('BidOpeningInProgress'),
        bidOpening: count('BidsClosed') + count('BidOpeningInProgress'),
        technicalEvaluationPending: count('TechnicalEvaluationPending'),
        underTechnicalEvaluation: count('UnderTechnicalEvaluation'),
        financialEvaluationPending: count('FinancialEvaluationPending'),
        financialEvaluation: count('FinancialEvaluation'),
        l1Identified: count('L1Identified'),
        workAwarded: count('WorkAwarded'),
        workOrderIssued: count('WorkOrderIssued'),
        agreementExecuted: count('AgreementExecuted'),
        evaluationHandoff: count('TechnicalEvaluationPending') + count('UnderTechnicalEvaluation') + count('FinancialEvaluationPending') + count('FinancialEvaluation') + count('L1Identified'),
        inPipeline: pipelineRows.length,
      };

      tenderOfficerDashboard = {
        queue: readyRows,
        pipelineQueue: pipelineRows,
        metrics: { ...toMetricsRow, ...pipelineMetrics, readyForTender: readyRows.length },
      };
    }

    // Site Engineer-specific: work execution
    let siteEngineerDashboard = null;
    if (designation === 'SiteEngineer') {
      const seQueue = await db.query(`
        SELECT
          eh."EstimateID", eh."EstimateNo", eh."NameOfWork", eh."Status",
          eh."Version", eh."CreatedDate", eh."StartedDate",
          u."Name" as "CreatedByName",
          COALESCE(ab."GrandTotal", 0) as "GrandTotal",
          ag."AgencyName", ag."ContractorName",
          (SELECT wp."Percentage" FROM "WorkProgress" wp WHERE wp."EstimateID" = eh."EstimateID" ORDER BY wp."Date" DESC LIMIT 1) as "currentProgress"
        FROM "EstimateHeader" eh
        LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
        LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
        LEFT JOIN "Agency" ag ON ag."EstimateID" = eh."EstimateID"
        WHERE eh."CurrentOwner" = $1 AND eh."Status" IN ('AgencySelected', 'WorkStarted', 'WorkCompleted')
        ORDER BY
          CASE eh."Status" WHEN 'AgencySelected' THEN 1 WHEN 'WorkStarted' THEN 2 WHEN 'WorkCompleted' THEN 3 END,
          eh."CreatedDate" ASC
      `, [userId]);

      const seMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'AgencySelected') as "pendingStart",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'WorkStarted') as "inProgress",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'CompleteWork') as "completedWorks",
          (SELECT COUNT(*)::int FROM "MeasurementBook" mb JOIN "EstimateHeader" eh ON eh."EstimateID" = mb."EstimateID" WHERE eh."CurrentOwner" = $1 AND mb."Status" = 'Draft') as "pendingMeasurements"
      `, [userId]);

      siteEngineerDashboard = {
        queue: seQueue.rows,
        metrics: seMetrics.rows[0],
      };
    }

    // Billing Officer-specific: bill preparation + submission
    let billingDashboard = null;
    if (designation === 'BillingOfficer') {
      const boQueue = await db.query(`
        SELECT b.*, eh."EstimateNo", eh."NameOfWork", eh."WorkID",
               u."Name" as "SubmittedByName", cu."Name" as "CurrentOwnerName",
               ag."AgencyName", ag."ContractorName"
        FROM "Billing" b
        JOIN "EstimateHeader" eh ON eh."EstimateID" = b."EstimateID"
        LEFT JOIN "Users" u ON u."UserID" = b."SubmittedBy"
        LEFT JOIN "Users" cu ON cu."UserID" = b."CurrentOwner"
        LEFT JOIN "Agency" ag ON ag."EstimateID" = eh."EstimateID"
        WHERE (b."CurrentOwner" = $1 OR b."SubmittedBy" = $1)
        ORDER BY CASE b."Status" WHEN 'Draft' THEN 1 WHEN 'ReturnedToBiller' THEN 2 ELSE 3 END, b."BillID" DESC
        LIMIT 25
      `, [userId]);

      const boMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'WorkCompleted') as "billsToPrepare",
          (SELECT COUNT(*)::int FROM "Billing" WHERE ("CurrentOwner" = $1 OR "SubmittedBy" = $1) AND "Status" = 'Draft') as "draftBills",
          (SELECT COUNT(*)::int FROM "Billing" WHERE "SubmittedBy" = $1 AND "Status" IN ('SubmittedToManager','ManagerChecked','DGMChecked','SubmittedToFinance')) as "submittedBills",
          (SELECT COUNT(*)::int FROM "Billing" WHERE "CurrentOwner" = $1 AND "Status" = 'ReturnedToBiller') as "returnedBills",
          (SELECT COALESCE(SUM(b."NetAmount"), 0) FROM "Billing" b
            JOIN "EstimateHeader" eh ON eh."EstimateID" = b."EstimateID"
            WHERE b."Status" NOT IN ('Paid','Cancelled') AND (b."CurrentOwner" = $1 OR b."SubmittedBy" = $1 OR eh."CreatedBy" = $1)) as "amountPending"
      `, [userId]);

      billingDashboard = {
        queue: boQueue.rows,
        metrics: boMetrics.rows[0],
      };
    }

    // Administrator-specific: archiving + system ops
    let adminDashboard = null;
    if (designation === 'Administrator') {
      const adminMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "Users") as "totalUsers",
          (SELECT COUNT(*)::int FROM "Users" WHERE "IsActive" IS NOT FALSE) as "activeUsers",
          (SELECT COUNT(*)::int FROM "AuditLog" WHERE "CreatedDate" >= CURRENT_DATE) as "todayAuditEvents",
          (SELECT COUNT(*)::int FROM "Notification" WHERE "IsRead" = FALSE) as "unreadNotifications"
      `);

      adminDashboard = {
        metrics: adminMetrics.rows[0],
      };
    }

    // CGM-specific: approval queue for estimates forwarded by GM
    let cgmDashboard = null;
    if (designation === 'CGM') {
      const cgmQueue = await db.query(`
        SELECT
          eh."EstimateID", eh."EstimateNo", eh."NameOfWork", eh."Status",
          eh."Version", eh."CreatedDate", eh."SubmissionDate",
          u."Name" as "CreatedByName",
          COALESCE(ab."GrandTotal", 0) as "GrandTotal",
          EXTRACT(EPOCH FROM (NOW() - COALESCE(eh."SubmissionDate", eh."CreatedDate"))) / 86400 as "daysWaiting"
        FROM "EstimateHeader" eh
        LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
        LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
        WHERE eh."CurrentOwner" = $1
        ORDER BY eh."CreatedDate" ASC
      `, [userId]);

      const cgmMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1) as "pendingReview",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'GM_Recommended') as "awaitingAction",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1) as "processedByMe",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1
            AND (NOW() - COALESCE("SubmissionDate", "CreatedDate")) > INTERVAL '3 days') as "escalated",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'Reverted') as "revertedToMe",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "Status" = 'CGM_Submitted') as "submittedForApproval",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'SubmitForApproval') as "approvedByMe",
          (SELECT COUNT(*)::int FROM "EstimateHeader" eh
            WHERE eh."Status" = 'CGM_Submitted'
              AND EXISTS (SELECT 1 FROM "Workflow" w
                WHERE w."EstimateID" = eh."EstimateID"
                  AND w."FromUserID" = $1 AND w."Action" = 'SubmitForApproval')) as "waitingForNext",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "Status" = 'DOP_Approved') as "awaitingED",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "Status" = 'ED_Approved') as "awaitingMD",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1) as "totalInScope"
      `, [userId]);

      const cgmOldest = await db.query(`
        SELECT "EstimateNo", "NameOfWork",
          EXTRACT(EPOCH FROM (NOW() - COALESCE("SubmissionDate", "CreatedDate"))) / 86400 as "daysWaiting"
        FROM "EstimateHeader"
        WHERE "CurrentOwner" = $1
        ORDER BY "CreatedDate" ASC LIMIT 1
      `, [userId]);

      cgmDashboard = {
        queue: cgmQueue.rows,
        metrics: cgmMetrics.rows[0],
        oldestWaiting: cgmOldest.rows[0] || null,
        pipeline: await rolePipelineFor(req.user, 'assignedOrCreated'),
        escalated: await escalatedQueueFor(userId, null),
      };
    }

    // DOP-specific: approval queue for estimates forwarded by CGM
    let dopDashboard = null;
    if (designation === 'DOP') {
      const dopQueue = await db.query(`
        SELECT
          eh."EstimateID", eh."EstimateNo", eh."NameOfWork", eh."Status",
          eh."Version", eh."CreatedDate", eh."SubmissionDate",
          u."Name" as "CreatedByName",
          COALESCE(ab."GrandTotal", 0) as "GrandTotal",
          EXTRACT(EPOCH FROM (NOW() - COALESCE(eh."SubmissionDate", eh."CreatedDate"))) / 86400 as "daysWaiting"
        FROM "EstimateHeader" eh
        LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
        LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
        WHERE eh."CurrentOwner" = $1
        ORDER BY eh."CreatedDate" ASC
      `, [userId]);

      const dopMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1) as "pendingReview",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'CGM_Submitted') as "awaitingAction",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1) as "processedByMe",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1
            AND (NOW() - COALESCE("SubmissionDate", "CreatedDate")) > INTERVAL '3 days') as "escalated",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'Reverted') as "revertedToMe",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'Approve') as "approvedByMe",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "Status" = 'DOP_Approved') as "waitingForNext",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "Status" = 'ED_Approved') as "awaitingMD",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1) as "totalInScope"
      `, [userId]);

      const dopOldest = await db.query(`
        SELECT "EstimateNo", "NameOfWork",
          EXTRACT(EPOCH FROM (NOW() - COALESCE("SubmissionDate", "CreatedDate"))) / 86400 as "daysWaiting"
        FROM "EstimateHeader"
        WHERE "CurrentOwner" = $1
        ORDER BY "CreatedDate" ASC LIMIT 1
      `, [userId]);

      dopDashboard = {
        queue: dopQueue.rows,
        metrics: dopMetrics.rows[0],
        oldestWaiting: dopOldest.rows[0] || null,
        pipeline: await rolePipelineFor(req.user, null),
        escalated: await escalatedQueueFor(userId, null),
      };
    }

    // ED-specific: approval queue for estimates forwarded by DOP
    let edDashboard = null;
    if (designation === 'ED') {
      const edQueue = await db.query(`
        SELECT
          eh."EstimateID", eh."EstimateNo", eh."NameOfWork", eh."Status",
          eh."Version", eh."CreatedDate", eh."SubmissionDate",
          u."Name" as "CreatedByName",
          COALESCE(ab."GrandTotal", 0) as "GrandTotal",
          EXTRACT(EPOCH FROM (NOW() - COALESCE(eh."SubmissionDate", eh."CreatedDate"))) / 86400 as "daysWaiting"
        FROM "EstimateHeader" eh
        LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
        LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
        WHERE eh."CurrentOwner" = $1
        ORDER BY eh."CreatedDate" ASC
      `, [userId]);

      const edMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1) as "pendingReview",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'DOP_Approved') as "awaitingAction",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1) as "processedByMe",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1
            AND (NOW() - COALESCE("SubmissionDate", "CreatedDate")) > INTERVAL '3 days') as "escalated",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'Reverted') as "revertedToMe",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'Approve') as "approvedByMe",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "Status" = 'ED_Approved') as "waitingForNext",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1) as "totalInScope"
      `, [userId]);

      const edOldest = await db.query(`
        SELECT "EstimateNo", "NameOfWork",
          EXTRACT(EPOCH FROM (NOW() - COALESCE("SubmissionDate", "CreatedDate"))) / 86400 as "daysWaiting"
        FROM "EstimateHeader"
        WHERE "CurrentOwner" = $1
        ORDER BY "CreatedDate" ASC LIMIT 1
      `, [userId]);

      edDashboard = {
        queue: edQueue.rows,
        metrics: edMetrics.rows[0],
        oldestWaiting: edOldest.rows[0] || null,
        pipeline: await rolePipelineFor(req.user, null),
        escalated: await escalatedQueueFor(userId, null),
      };
    }

    // MD-specific: final approval queue for estimates forwarded by ED
    let mdDashboard = null;
    if (designation === 'MD') {
      const mdQueue = await db.query(`
        SELECT
          eh."EstimateID", eh."EstimateNo", eh."NameOfWork", eh."Status",
          eh."Version", eh."CreatedDate", eh."SubmissionDate",
          u."Name" as "CreatedByName",
          COALESCE(ab."GrandTotal", 0) as "GrandTotal",
          EXTRACT(EPOCH FROM (NOW() - COALESCE(eh."SubmissionDate", eh."CreatedDate"))) / 86400 as "daysWaiting"
        FROM "EstimateHeader" eh
        LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
        LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
        WHERE eh."CurrentOwner" = $1
        ORDER BY eh."CreatedDate" ASC
      `, [userId]);

      const mdMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1) as "pendingReview",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'ED_Approved') as "awaitingAction",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1) as "processedByMe",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1
            AND (NOW() - COALESCE("SubmissionDate", "CreatedDate")) > INTERVAL '3 days') as "escalated",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'Reverted') as "revertedToMe",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'FinalApprove') as "approvedByMe",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'FinalApprove' AND "DateTime" >= CURRENT_DATE) as "approvedToday",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1) as "totalInScope"
      `, [userId]);

      const mdOldest = await db.query(`
        SELECT "EstimateNo", "NameOfWork",
          EXTRACT(EPOCH FROM (NOW() - COALESCE("SubmissionDate", "CreatedDate"))) / 86400 as "daysWaiting"
        FROM "EstimateHeader"
        WHERE "CurrentOwner" = $1
        ORDER BY "CreatedDate" ASC LIMIT 1
      `, [userId]);

      mdDashboard = {
        queue: mdQueue.rows,
        metrics: mdMetrics.rows[0],
        oldestWaiting: mdOldest.rows[0] || null,
        pipeline: await rolePipelineFor(req.user, null),
        escalated: await escalatedQueueFor(userId, null),
      };
    }

    let financeClerkDashboard = null;
    if (designation === 'FinanceClerk') {
      const fcQueue = await db.query(`
        SELECT fw."FinanceID", fw."Status", fw."InwardNumber", fw."InwardDate",
               fw."Amount", fw."CreatedDate", fw."CurrentOwner",
               b."BillNo", b."BillType", b."NetAmount",
               eh."EstimateID", eh."EstimateNo", eh."NameOfWork"
        FROM "FinanceWorkflow" fw
        JOIN "Billing" b ON b."BillID" = fw."BillID"
        JOIN "EstimateHeader" eh ON eh."EstimateID" = fw."EstimateID"
        WHERE fw."Status" IN ('Inward','Verification')
        ORDER BY fw."CreatedDate" ASC
      `);
      const fcMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "Billing" WHERE "Status" = 'SubmittedToFinance') as "pendingInward",
          (SELECT COUNT(*)::int FROM "FinanceWorkflow" WHERE "ReceivedBy" = $1 AND "InwardDate"::date = CURRENT_DATE) as "inwardToday",
          (SELECT COUNT(*)::int FROM "FinanceWorkflow" WHERE "Status" = 'Verification') as "pendingVerification",
          (SELECT COUNT(*)::int FROM "FinanceWorkflow" WHERE "ReceivedBy" = $1 AND "Status" != 'Inward') as "processed"
      `, [userId]);

      // Bills GM forwarded but not yet inwarded sit on the clerk's desk too.
      const awaitingInward = (await db.query(
        `SELECT b."BillID", b."Status", b."NetAmount", b."BillNo", b."BillType", b."EstimateID",
                eh."EstimateNo", eh."NameOfWork"
         FROM "Billing" b
         JOIN "EstimateHeader" eh ON eh."EstimateID" = b."EstimateID"
         LEFT JOIN "FinanceWorkflow" fw ON fw."BillID" = b."BillID"
         WHERE b."Status" = 'SubmittedToFinance' AND fw."FinanceID" IS NULL
         ORDER BY b."BillID" ASC`
      )).rows;

      financeClerkDashboard = {
        queue: [...awaitingInward.map(a => ({
          FinanceID: null, BillID: a.BillID, Status: 'SubmittedToFinance', InwardNumber: null, InwardDate: null,
          Amount: a.NetAmount, CreatedDate: null, CurrentOwner: null,
          BillNo: a.BillNo, BillType: a.BillType, NetAmount: a.NetAmount,
          EstimateNo: a.EstimateNo, NameOfWork: a.NameOfWork,
        })), ...fcQueue.rows],
        metrics: fcMetrics.rows[0],
      };
    }

    let financeManagerDashboard = null;
    if (designation === 'FinanceManager') {
      const fmQueue = await db.query(`
        SELECT fw."FinanceID", fw."Status", fw."Amount", fw."VerifiedBy", fw."VerifiedDate",
               fw."CreatedDate", fw."CurrentOwner",
               b."BillNo", b."BillType", b."NetAmount",
               eh."EstimateID", eh."EstimateNo", eh."NameOfWork",
               vrf."Name" as "VerifiedByName"
        FROM "FinanceWorkflow" fw
        JOIN "Billing" b ON b."BillID" = fw."BillID"
        JOIN "EstimateHeader" eh ON eh."EstimateID" = fw."EstimateID"
        LEFT JOIN "Users" vrf ON vrf."UserID" = fw."VerifiedBy"
        WHERE fw."Status" IN ('Verification','Recommended')
        ORDER BY fw."CreatedDate" ASC
      `);
      const fmMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "FinanceWorkflow" WHERE "Status" = 'Verification') as "pendingVerification",
          (SELECT COUNT(*)::int FROM "FinanceWorkflow" WHERE "Status" = 'Recommended') as "pendingRecommendation",
          (SELECT COUNT(*)::int FROM "FinanceWorkflow" WHERE "RecommendedBy" IS NOT NULL) as "recommended",
          (SELECT COALESCE(SUM("Amount"),0) FROM "FinanceWorkflow" WHERE "Status" IN ('Verification','Recommended')) as "amountPending"
      `);
      financeManagerDashboard = { queue: fmQueue.rows, metrics: fmMetrics.rows[0] };
    }

    let financeHeadDashboard = null;
    if (designation === 'FinanceHead') {
      const fhQueue = await db.query(`
        SELECT fw."FinanceID", fw."Status", fw."Amount", fw."RecommendedBy",
               fw."RecommendedDate", fw."ChequeNumber", fw."ChequeDate",
               fw."CreatedDate", fw."CurrentOwner",
               b."BillNo", b."BillType", b."NetAmount",
               eh."EstimateID", eh."EstimateNo", eh."NameOfWork",
               rec."Name" as "RecommendedByName"
        FROM "FinanceWorkflow" fw
        JOIN "Billing" b ON b."BillID" = fw."BillID"
        JOIN "EstimateHeader" eh ON eh."EstimateID" = fw."EstimateID"
        LEFT JOIN "Users" rec ON rec."UserID" = fw."RecommendedBy"
        WHERE fw."Status" IN ('Recommended','Approved','ChequeIssued')
        ORDER BY fw."CreatedDate" ASC
      `);

      const fhMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "FinanceWorkflow" WHERE "Status" = 'Recommended') as "pendingApproval",
          (SELECT COUNT(*)::int FROM "FinanceWorkflow" WHERE "Status" = 'Approved') as "approved",
          (SELECT COUNT(*)::int FROM "FinanceWorkflow" WHERE "Status" = 'ChequeIssued') as "pendingCheque",
          (SELECT COUNT(*)::int FROM "FinanceWorkflow" WHERE "Status" = 'ChequeIssued') as "chequesIssued",
          (SELECT COALESCE(SUM("Amount"),0) FROM "FinanceWorkflow") as "totalAmount"
      `);

      financeHeadDashboard = {
        queue: fhQueue.rows,
        metrics: fhMetrics.rows[0],
      };
    }

    // SoR Admin: master data + system overview
    let soRAdminDashboard = null;
    if (designation === 'SoRAdmin') {
      const soMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "ItemMaster") as "itemMasterRecords",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "Status" NOT IN ('Draft','Reverted','Completed')) as "activeEstimates",
          (SELECT COUNT(*)::int FROM "Users") as "totalUsers"
      `);
      soRAdminDashboard = { queue: [], metrics: soMetrics.rows[0] };
    }

    let slaSummary = null;
    try {
      slaSummary = {
        estimate: await getSlaSummary('Estimate'),
        finance: await getSlaSummary('Finance'),
      };
    } catch (_) {}

    // DirectorOfAdministration-specific: FCN + Sanction queue
    let directorAdminDashboard = null;
    if (designation === 'DirectorOfAdministration') {
      const daQueue = await db.query(`
        SELECT
          eh."EstimateID", eh."EstimateNo", eh."NameOfWork", eh."Status",
          eh."Version", eh."CreatedDate",
          u."Name" as "CreatedByName",
          COALESCE(ab."GrandTotal", 0) as "GrandTotal",
          f."FCNNo", f."FCNDate",
          EXTRACT(EPOCH FROM (NOW() - eh."CreatedDate")) / 86400 as "daysWaiting"
        FROM "EstimateHeader" eh
        LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
        LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
        LEFT JOIN "FCN" f ON f."FCNID" = eh."FCNID"
        WHERE eh."CurrentOwner" = $1 AND eh."Status" IN ('FinalApproved', 'FCNGenerated', 'AdminSanctionGenerated')
        ORDER BY eh."CreatedDate" ASC
      `, [userId]);

      // Director's assigned TS queue (sanctions they must approve as TS authority)
      const daTsQueue = await db.query(`
        SELECT
          eh."EstimateID", eh."EstimateNo", eh."NameOfWork", eh."Status",
          eh."Version", eh."CreatedDate",
          u."Name" as "CreatedByName",
          COALESCE(ab."GrandTotal", 0) as "GrandTotal",
          ts."TSID", ts."Status" as "TSStatus", ts."AssignedAt"
        FROM "EstimateHeader" eh
        LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
        LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
        LEFT JOIN "TechnicalSanction" ts ON ts."EstimateID" = eh."EstimateID"
        WHERE eh."CurrentOwner" = $1 AND eh."Status" = 'TSPending'
        ORDER BY eh."CreatedDate" ASC
      `, [userId]);

      // Director's agency-selection queue: published tenders waiting for the
      // Director to finalize an agency (canonical owner after tender publish).
      const daAgencyQueue = await db.query(`
        SELECT
          eh."EstimateID", eh."EstimateNo", eh."NameOfWork", eh."Status",
          eh."Version", eh."CreatedDate",
          u."Name" as "CreatedByName",
          COALESCE(ab."GrandTotal", 0) as "GrandTotal",
          t."TenderNo", t."BidEndDate"
        FROM "EstimateHeader" eh
        LEFT JOIN "Users" u ON u."UserID" = eh."CreatedBy"
        LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
        LEFT JOIN "Tender" t ON t."EstimateID" = eh."EstimateID"
        WHERE eh."CurrentOwner" = $1 AND eh."Status" = 'TenderPublished'
        ORDER BY eh."CreatedDate" ASC
      `, [userId]);

      // Director's award pipeline: tenders past L1 that need their Director
      // hand (award → work order → agreement). KPI counts mirror these rows.
      const daAwardQueue = await db.query(
        `SELECT
           eh."EstimateID", eh."EstimateNo", eh."NameOfWork",
           COALESCE(ab."GrandTotal", 0) as "GrandTotal",
           t."TenderID", t."TenderNo", t."Status",
           tev."SelectedBidID", tev."IdentifiedAt",
           (SELECT c."ContractorName" FROM "Bid" b JOIN "Contractor" c ON c."ContractorID" = b."ContractorID"
            WHERE b."BidID" = tev."SelectedBidID") as "L1Bidder",
           (SELECT b."FinancialBidAmount" FROM "Bid" b WHERE b."BidID" = tev."SelectedBidID") as "L1Amount",
           t."AwardedAt", t."WorkOrderNo", t."AgreementNo"
         FROM "Tender" t
         JOIN "EstimateHeader" eh ON eh."EstimateID" = t."EstimateID"
         LEFT JOIN "Abstract" ab ON ab."EstimateID" = eh."EstimateID"
         LEFT JOIN "TenderEvaluation" tev ON tev."TenderID" = t."TenderID"
         WHERE t."Status" IN ('L1Identified','WorkAwarded','WorkOrderIssued','AgreementExecuted')
         ORDER BY CASE t."Status"
           WHEN 'L1Identified' THEN 1 WHEN 'WorkAwarded' THEN 2 WHEN 'WorkOrderIssued' THEN 3 ELSE 4 END,
           tev."IdentifiedAt" ASC`
      );

      const daMetrics = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'FinalApproved') as "pendingFCN",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'FCNGenerated') as "pendingSanction",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'AdminSanctionGenerated') as "awaitingForward",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1 AND "Status" = 'TSPending') as "pendingTSApproval",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'GenerateFCN') as "fcnsGenerated",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'GenerateSanction') as "sanctionsGenerated",
          (SELECT COUNT(*)::int FROM "Workflow" WHERE "FromUserID" = $1 AND "Action" = 'ReturnToFCN') as "returnsSent",
          (SELECT COUNT(*)::int FROM "EstimateHeader" WHERE "CurrentOwner" = $1
            AND "SlaStatus" IN ('Overdue', 'Warning')
            AND "Status" IN ('FinalApproved','FCNGenerated','AdminSanctionGenerated','TSPending')) as "escalated",
          (SELECT COUNT(*)::int FROM "Tender" WHERE "Status" = 'L1Identified') as "awardPending",
          (SELECT COUNT(*)::int FROM "Tender" WHERE "Status" = 'WorkAwarded') as "workOrderPending",
          (SELECT COUNT(*)::int FROM "Tender" WHERE "Status" = 'WorkOrderIssued') as "agreementPending",
          (SELECT COUNT(*)::int FROM "Tender" WHERE "Status" = 'AgreementExecuted') as "agreementsExecuted"
      `, [userId]);

      directorAdminDashboard = {
        queue: daQueue.rows,
        tsQueue: daTsQueue.rows,
        agencySelection: daAgencyQueue.rows,
        awardPipeline: daAwardQueue.rows,
        metrics: daMetrics.rows[0],
      };
    }

    res.json({
      dgmDashboard,
      gmDashboard,
      cgmDashboard,
      dopDashboard,
      edDashboard,
      mdDashboard,
      tenderOfficerDashboard,
      siteEngineerDashboard,
      billingDashboard,
      adminDashboard,
      financeClerkDashboard,
      financeManagerDashboard,
      financeHeadDashboard,
      directorAdminDashboard,
      soRAdminDashboard,
      stats: globalStats.rows[0],
      queues: {
        myAssigned: q_myAssigned,
        myAssignedActive: q_myAssignedActive,
        pendingReview: q_pendingReview,
        pendingApproval: q_pendingApproval,
        toSign: q_toSign,
        readyForTender: q_readyForTender,
        pendingSelection: q_pendingSelection,
        pendingStart: q_pendingStart,
        inProgress: q_inProgress,
        pendingBills: q_pendingBills,
        pendingArchive: q_pendingArchive,
        drafts: q_drafts,
        reverted: q_reverted,
        createdByMe: q_createdByMe,
        submittedCreated: q_submittedCreated,
        approvedToGM: q_approvedToGM,
        published: q_published,
        selected: q_selected,
        completedWorks: q_completedWorks,
        submittedBills: q_submittedBills,
        archived: q_archived,
      },
      totalValue: totalValue.rows[0].totalValue,
      recentEstimates: myEstimates.rows,
      role: designation,
      modules: moduleCounts.rows[0],
      managerDashboard,
      slaSummary,
    });
  } catch (err) { next(err); }
};
