// Test-data cleanup: each suite records the rows it creates (trackEstimate /
// trackUser) and calls cleanupTrackedData() in its after hook, so `npm test`
// never pollutes the dev database. Rows are deleted child-first so no FK
// constraint trips. Tracking by ID (not a time window) is what lets the suites
// run in parallel without deleting each other's data.
const db = require('../config/db');

const DELETE_BY_ESTIMATE = [
  `DELETE FROM "FinanceWorkflow" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "BillingPayments" WHERE "BillID" IN (SELECT "BillID" FROM "Billing" WHERE "EstimateID" = ANY($1))`,
  `DELETE FROM "Billing" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "WorkProgressImages" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "WorkProgressPhotos" WHERE "ProgressID" IN (SELECT "ProgressID" FROM "WorkProgress" WHERE "EstimateID" = ANY($1))`,
  `DELETE FROM "WorkProgress" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "SignatureOTP" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "TenderEvaluation" WHERE "TenderID" IN (SELECT "TenderID" FROM "Tender" WHERE "EstimateID" = ANY($1))`,
  `DELETE FROM "LetterOfAward" WHERE "TenderID" IN (SELECT "TenderID" FROM "Tender" WHERE "EstimateID" = ANY($1))`,
  `DELETE FROM "Bid" WHERE "TenderID" IN (SELECT "TenderID" FROM "Tender" WHERE "EstimateID" = ANY($1))`,
  `DELETE FROM "AgencyEvaluation" WHERE "TenderID" IN (SELECT "TenderID" FROM "Tender" WHERE "EstimateID" = ANY($1))`,
  `DELETE FROM "TenderDocuments" WHERE "TenderID" IN (SELECT "TenderID" FROM "Tender" WHERE "EstimateID" = ANY($1))`,
  `DELETE FROM "Agency" WHERE "EstimateID" = ANY($1) OR "TenderID" IN (SELECT "TenderID" FROM "Tender" WHERE "EstimateID" = ANY($1))`,
  `DELETE FROM "Tender" WHERE "EstimateID" = ANY($1)`,
  `UPDATE "EstimateHeader" SET "FCNID" = NULL, "AdminSanctionID" = NULL, "TSID" = NULL WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "TechnicalSanction" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "FCN" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "AdministrativeSanction" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "Workflow" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "Notification" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "Versions" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "AuditLog" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "MeasurementBook" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "EstimateDetails" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "Abstract" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "EstimateLSProvision" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "EstimateAdditionalItem" WHERE "EstimateID" = ANY($1)`,
  `DELETE FROM "EstimateDocuments" WHERE "EstimateID" = ANY($1) OR "UploadedBy" IN (SELECT "UserID" FROM "Users" WHERE "UserID" = ANY($1))`,
  `DELETE FROM "EstimateHeader" WHERE "EstimateID" = ANY($1)`,
];

async function deleteEstimates(ids) {
  if (!ids.length) return;
  // Disable in-place-edit trigger temporarily for FK cleanup
  await db.query('ALTER TABLE "EstimateHeader" DISABLE TRIGGER trg_block_in_place_edit');
  for (const sql of DELETE_BY_ESTIMATE) {
    await db.query(sql, [ids]);
  }
  await db.query('ALTER TABLE "EstimateHeader" ENABLE TRIGGER trg_block_in_place_edit');
}

const tracked = { estimates: new Set(), users: new Set() };

function trackEstimate(id) {
  if (id != null) tracked.estimates.add(Number(id));
}

function trackUser(id) {
  if (id != null) tracked.users.add(Number(id));
}

// Delete the estimates (with all child rows) and users this suite created, plus
// now-orphaned contractors. Returns number of estimates removed.
async function cleanupTrackedData() {
  const ids = [...tracked.estimates];
  await deleteEstimates(ids);
  if (tracked.users.size) {
    const userIds = [...tracked.users];
    await db.query('DELETE FROM "AuditLog" WHERE "UserID" = ANY($1)', [userIds]);
    await db.query('DELETE FROM "Users" WHERE "UserID" = ANY($1)', [userIds]);
  }
  await db.query(
    `DELETE FROM "Contractor" WHERE NOT EXISTS
       (SELECT 1 FROM "Bid" WHERE "Bid"."ContractorID" = "Contractor"."ContractorID")`
  );
  return ids.length;
}

module.exports = { deleteEstimates, trackEstimate, trackUser, cleanupTrackedData };
