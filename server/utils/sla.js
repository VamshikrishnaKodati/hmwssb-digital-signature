const db = require('../config/db');

// ── SLA Definition lookup ─────────────────────────────────────────────────────
const slaCache = {};

async function getSlaDefinition(module, stage) {
  const key = module + ':' + stage;
  if (slaCache[key]) return slaCache[key];
  const r = await db.query(
    `SELECT * FROM "SlaDefinition" WHERE "Module" = $1 AND "Stage" = $2 AND "Active" = TRUE`,
    [module, stage]
  );
  if (r.rows.length) slaCache[key] = r.rows[0];
  return r.rows[0] || null;
}

function clearSlaCache() { Object.keys(slaCache).forEach(k => delete slaCache[k]); }

// ── Stage mapping: workflow status → SLA module+stage ──────────────────────────
const WORKFLOW_SLA_MAP = {
  DGM:                 { module: 'Estimate', stage: 'DGM' },
  GM_Recommended:      { module: 'Estimate', stage: 'GM' },
  CGM_Submitted:       { module: 'Estimate', stage: 'CGM' },
  DOP_Approved:        { module: 'Estimate', stage: 'DOP' },
  ED_Approved:         { module: 'Estimate', stage: 'ED' },
  MD_Approved:         { module: 'Estimate', stage: 'MD' },
  FinalApproved:       { module: 'Estimate', stage: 'FCN' },
  FCNGenerated:        { module: 'Estimate', stage: 'DirectorAdmin' },
  AdminSanctionGenerated: { module: 'Estimate', stage: 'DirectorAdmin' },
  TSPending:           { module: 'Estimate', stage: 'TechnicalSanction' },
  TSApproved:          { module: 'Estimate', stage: 'TenderPreparation' },
  TenderPublished:     { module: 'Estimate', stage: 'TenderPreparation' },
  // Tender-table pipeline (T3)
  Published:           { module: 'Tender', stage: 'BidSubmission' },
  BidSubmissionOpen:   { module: 'Tender', stage: 'BidSubmission' },
  BidsClosed:          { module: 'Tender', stage: 'BidOpening' },
  BidOpeningInProgress:{ module: 'Tender', stage: 'BidOpening' },
  TechnicalEvaluationPending: { module: 'Tender', stage: 'TenderEvaluation' },
  UnderTechnicalEvaluation:   { module: 'Tender', stage: 'TenderEvaluation' },
  FinancialEvaluationPending: { module: 'Tender', stage: 'TenderEvaluation' },
  FinancialEvaluation:        { module: 'Tender', stage: 'TenderEvaluation' },
  L1Identified:               { module: 'Tender', stage: 'Award' },
  WorkAwarded:                { module: 'Tender', stage: 'Award' },
  WorkOrderIssued:            { module: 'Tender', stage: 'Award' },
  // Execution phase (estimate column SLA, started by startWork)
  WorkStarted:                { module: 'Estimate', stage: 'WorkStarted' },
};

const FINANCE_SLA_MAP = {
  Inward:        { module: 'Finance', stage: 'Inward' },
  Verification:  { module: 'Finance', stage: 'Verification' },
  Recommended:   { module: 'Finance', stage: 'Recommended' },
  Approved:      { module: 'Finance', stage: 'Approved' },
};

// Every SLA-aware table carries the same tracking columns plus an EstimateID
// FK, so one registry drives start/stop/check/escalate for all modules.
const MODULE_TABLES = {
  Estimate: { table: 'EstimateHeader', col: '"EstimateID"', id: 'EstimateID' },
  Finance:  { table: 'FinanceWorkflow', col: '"FinanceID"', id: 'FinanceID' },
  Billing:  { table: 'Billing', col: '"BillID"', id: 'BillID' },
  Tender:   { table: 'Tender', col: '"TenderID"', id: 'TenderID' },
};

// ── Start SLA timer ───────────────────────────────────────────────────────────
async function startSla(module, stage, recordId, table, force) {
  const def = await getSlaDefinition(module, stage);
  if (!def) return;
  const now = new Date();
  const due = new Date(now.getTime() + def.DurationMinutes * 60000);
  const { table: tbl, col } = MODULE_TABLES[module] || {};
  if (!tbl) return;
  await db.query(
    `UPDATE "${tbl}" SET "SlaStartedAt" = $1, "SlaDueAt" = $2, "SlaStatus" = 'Normal'
     WHERE ${col} = $3 AND ($4 OR "SlaDueAt" IS NULL)`,
    [now, due, recordId, force === true]
  );
}

// ── Stop SLA timer ────────────────────────────────────────────────────────────
async function stopSla(recordId, table, resolutionType) {
  const entry = Object.values(MODULE_TABLES).find(m => m.table === table) || MODULE_TABLES[table];
  const { table: tbl, col } = entry || {};
  if (!tbl) return;
  await db.query(
    `UPDATE "${tbl}" SET "SlaStatus" = 'Resolved' WHERE ${col} = $1 AND "SlaStatus" != 'Resolved'`,
    [recordId]
  );
  // Resolve any open escalations
  await db.query(
    `UPDATE "EscalationLog" SET "ResolvedAt" = now(), "ResolutionType" = $1
     WHERE "RecordID" = $2 AND "ResolvedAt" IS NULL`,
    [resolutionType || 'actioned', recordId]
  );
}

// ── SLA checker (background job) ──────────────────────────────────────────────
async function checkModuleSlas(module) {
  const { table, col, id } = MODULE_TABLES[module];
  const rows = (await db.query(
    `SELECT ${col} AS "RecordID", "Status", "SlaDueAt", "SlaStatus", "EscalationLevel", "CurrentOwner", "EstimateID"
     FROM "${table}"
     WHERE "SlaDueAt" IS NOT NULL AND "SlaStatus" IN ('Normal', 'Warning')`
  )).rows;

  const processed = { warnings: 0, overdue: 0, escalated: 0 };
  for (const row of rows) {
    const dueAt = new Date(row.SlaDueAt);
    const resolved = WORKFLOW_SLA_MAP[row.Status];
    const stage = resolved ? resolved.stage : row.Status;
    const def = await getSlaDefinition(module, stage);
    const warningAt = def ? new Date(dueAt.getTime() - def.WarningMinutes * 60000) : dueAt;
    const now = new Date();

    if (now > dueAt) {
      if (row.SlaStatus !== 'Overdue') {
        await db.query(
          `UPDATE "${table}" SET "SlaStatus" = 'Overdue' WHERE ${col} = $1`,
          [row.RecordID]
        );
        processed.overdue++;
      }
      await checkEscalation(module, row.RecordID, stage, row.CurrentOwner, row.EscalationLevel, row.EstimateID);
    } else if (now > warningAt && row.SlaStatus === 'Normal') {
      await db.query(
        `UPDATE "${table}" SET "SlaStatus" = 'Warning' WHERE ${col} = $1`,
        [row.RecordID]
      );
      processed.warnings++;
      if (row.CurrentOwner) {
        const remaining = Math.round((dueAt.getTime() - now.getTime()) / 60000);
        await db.query(
          `INSERT INTO "Notification" ("EstimateID","ToUserID","Type","Message")
           VALUES ($1,$2,'SlaWarning', $3)`,
          [row.EstimateID, row.CurrentOwner,
           'SLA Warning: ' + remaining + ' minutes remaining for action on this ' + module.toLowerCase() + ' record.']
        );
      }
    }
  }
  return processed;
}

async function checkSlas() {
  const results = { warnings: 0, overdue: 0, escalated: 0 };
  for (const module of Object.keys(MODULE_TABLES)) {
    const processed = await checkModuleSlas(module);
    results.warnings += processed.warnings;
    results.overdue += processed.overdue;
  }
  return results;
}

// ── Escalation check ──────────────────────────────────────────────────────────
async function checkEscalation(module, recordId, stage, currentOwner, currentLevel, estimateId) {
  const rules = await db.query(
    `SELECT * FROM "EscalationRule" WHERE "Module" = $1 AND "Stage" = $2 AND "Active" = TRUE
     ORDER BY "AfterMinutes" ASC`,
    [module, stage]
  );

  const entry = MODULE_TABLES[module] || {};
  const record = (await db.query(
    `SELECT "SlaDueAt","EscalationLevel","LastEscalatedAt" FROM "${entry.table}" WHERE ${entry.col} = $1`,
    [recordId]
  )).rows[0];
  if (!entry.table || !record || !record.SlaDueAt) return;

  const dueAt = new Date(record.SlaDueAt);
  const now = new Date();
  const overdueMinutes = Math.round((now.getTime() - dueAt.getTime()) / 60000);

  for (const rule of rules.rows) {
    if (overdueMinutes >= rule.AfterMinutes && (currentLevel || 0) < rule.AfterMinutes) {
      // Find escalation target
      const target = await db.query(
        `SELECT "UserID" FROM "Users" WHERE "Designation" = $1 AND "IsActive" = TRUE LIMIT 1`,
        [rule.EscalateToRole]
      );
      if (!target.rows.length) continue;

      const targetUserId = target.rows[0].UserID;

      // Check no duplicate escalation in last 30 minutes
      const recent = await db.query(
        `SELECT 1 FROM "EscalationLog" WHERE "Module" = $1 AND "RecordID" = $2
         AND "EscalatedTo" = $3 AND "TriggeredAt" > now() - interval '30 minutes'`,
        [module, recordId, rule.EscalateToRole]
      );
      if (recent.rows.length) continue;

      // Record escalation
      const estId = estimateId || recordId;
      await db.query(
        `INSERT INTO "EscalationLog" ("Module","RecordID","Stage","EscalationLevel","EscalatedTo")
         VALUES ($1,$2,$3,$4,$5)`,
        [module, recordId, stage, (currentLevel || 0) + 1, rule.EscalateToRole]
      );

      // Update record
      await db.query(
        `UPDATE "${entry.table}" SET "EscalationLevel" = "EscalationLevel" + 1, "LastEscalatedAt" = now()
         WHERE ${entry.col} = $1`,
        [recordId]
      );

      // Notify escalation target
      await db.query(
        `INSERT INTO "Notification" ("EstimateID","ToUserID","Type","Message")
         VALUES ($1,$2,'Escalation', $3)`,
        [estId, targetUserId,
         'Escalated: ' + module + ' record at ' + stage + ' stage has exceeded SLA. Please take action.']
      );

      // Audit
      await db.query(
        `INSERT INTO "AuditLog" ("EstimateID","UserID","Action","Remarks")
         VALUES ($1,$2,'EscalationTriggered', $3)`,
        [estId, targetUserId,
         'Escalation triggered for ' + module + ' #' + recordId + ' at ' + stage + ' stage.']
      );
    }
  }
}

// ── Get SLA status for a record (for dashboard) ───────────────────────────────
async function getSlaStatus(module, recordId) {
  const { table, col } = MODULE_TABLES[module] || {};
  if (!table) return null;
  const r = await db.query(
    `SELECT "SlaStartedAt","SlaDueAt","SlaStatus","EscalationLevel","LastEscalatedAt"
     FROM "${table}" WHERE ${col} = $1`,
    [recordId]
  );
  if (!r.rows.length || !r.rows[0].SlaDueAt) return null;
  const row = r.rows[0];
  const now = new Date();
  const dueAt = new Date(row.SlaDueAt);
  const remaining = Math.max(0, Math.round((dueAt.getTime() - now.getTime()) / 60000));

  return {
    startedAt: row.SlaStartedAt,
    dueAt: row.SlaDueAt,
    status: row.SlaStatus,
    escalationLevel: row.EscalationLevel,
    lastEscalatedAt: row.LastEscalatedAt,
    remainingMinutes: remaining,
  };
}

// ── Get SLA summary for a queue (for dashboard metrics) ───────────────────────
async function getSlaSummary(module, statuses) {
  const { table, col } = MODULE_TABLES[module] || {};
  if (!table) return { Normal: 0, Warning: 0, Overdue: 0, Escalated: 0 };
  const r = await db.query(
    `SELECT "SlaStatus", COUNT(*)::int as cnt
     FROM "${table}"
     WHERE "SlaStatus" IS NOT NULL AND "SlaStatus" != 'Resolved'
     ${statuses && statuses.length ? 'AND "Status" = ANY($1)' : ''}
     GROUP BY "SlaStatus"`,
    [statuses].filter(Boolean)
  );
  const summary = { Normal: 0, Warning: 0, Overdue: 0, Escalated: 0 };
  for (const row of r.rows) {
    summary[row.SlaStatus] = row.cnt;
  }
  return summary;
}

module.exports = {
  getSlaDefinition,
  startSla,
  stopSla,
  checkSlas,
  checkEscalation,
  getSlaStatus,
  getSlaSummary,
  clearSlaCache,
  WORKFLOW_SLA_MAP,
  FINANCE_SLA_MAP,
};
