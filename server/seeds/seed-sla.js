// Re-seeds SLA definitions + escalation rules. The main seed TRUNCATEs
// "Users" with CASCADE, which pulls in "SlaDefinition" (FK CreatedBy -> Users);
// since migrations never re-run, this module restores the defaults exactly as
// the 028/030/031/032/033/037 migrations inserted them.
require('dotenv').config();
const { Pool } = require('pg');

const SLA_DEFINITIONS = [
  // [Module, Stage, DurationMinutes, WarningMinutes, EscalationEnabled, Active]
  ['Estimate', 'DGM', 480, 60, true, true],
  ['Estimate', 'GM', 480, 60, true, true],
  ['Estimate', 'CGM', 480, 60, true, true],
  ['Estimate', 'DOP', 720, 120, true, true],
  ['Estimate', 'ED', 720, 120, true, true],
  ['Estimate', 'MD', 1440, 240, true, true],
  ['Estimate', 'FCN', 480, 60, true, true],
  ['Estimate', 'DirectorAdmin', 480, 60, true, true],
  ['Estimate', 'GMReview', 480, 60, true, true],
  ['Estimate', 'DGMReview', 480, 60, true, true],
  ['Estimate', 'TechnicalSanction', 480, 60, true, true],
  ['Estimate', 'TenderPreparation', 1440, 240, true, true],
  ['Tender', 'TenderPreparation', 1440, 240, true, true],
  ['Tender', 'TenderEvaluation', 2880, 480, true, true],
  ['Tender', 'Award', 1440, 240, true, true],
  ['Tender', 'BidSubmission', 10080, 1440, true, true],
  ['Tender', 'BidOpening', 2880, 720, true, true],
  ['Billing', 'SubmittedToManager', 960, 120, true, true],
  ['Billing', 'ManagerChecked', 480, 60, true, true],
  ['Billing', 'DGMChecked', 480, 60, true, true],
  ['Billing', 'SubmittedToFinance', 240, 60, true, true],
  ['Finance', 'Inward', 240, 60, true, true],
  ['Finance', 'Verification', 480, 60, true, true],
  ['Finance', 'Recommended', 480, 60, true, true],
  ['Finance', 'Approved', 240, 60, true, true],
];

const ESCALATION_RULES = [
  // [Module, Stage, AfterMinutes, EscalateToRole]
  ['Estimate', 'DGM', 120, 'GM'],
  ['Estimate', 'GM', 120, 'CGM'],
  ['Estimate', 'CGM', 120, 'DOP'],
  ['Estimate', 'DOP', 240, 'ED'],
  ['Estimate', 'ED', 240, 'MD'],
  ['Estimate', 'FCN', 120, 'MD'],
  ['Estimate', 'DirectorAdmin', 120, 'MD'],
  ['Estimate', 'TechnicalSanction', 120, 'MD'],
  ['Estimate', 'TenderPreparation', 240, 'MD'],
  ['Finance', 'Verification', 120, 'FinanceManager'],
  ['Finance', 'Recommended', 120, 'FinanceHead'],
  ['Tender', 'BidSubmission', 1440, 'ProcurementOfficer'],
  ['Tender', 'BidOpening', 1440, 'MD'],
];

async function seedSlaData(dbPool) {
  for (const [module, stage, dur, warn, escEnabled, active] of SLA_DEFINITIONS) {
    await dbPool.query(
      `INSERT INTO "SlaDefinition" ("Module","Stage","DurationMinutes","WarningMinutes","EscalationEnabled","Active")
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT ("Module","Stage") DO NOTHING`,
      [module, stage, dur, warn, escEnabled, active]
    );
  }
  for (const [module, stage, after, role] of ESCALATION_RULES) {
    await dbPool.query(
      `INSERT INTO "EscalationRule" ("Module","Stage","AfterMinutes","EscalateToRole")
       SELECT $1,$2,$3,$4
       WHERE NOT EXISTS (SELECT 1 FROM "EscalationRule" WHERE "Module" = $1 AND "Stage" = $2)`,
      [module, stage, after, role]
    );
  }
  console.log(`SLA seeded: ${SLA_DEFINITIONS.length} definitions, ${ESCALATION_RULES.length} escalation rules.`);
}

if (require.main === module) {
  const p = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hmwssb',
  });
  seedSlaData(p)
    .catch(e => { console.error('Error:', e.message); process.exit(1); })
    .finally(() => p.end());
}

module.exports = { seedSlaData };