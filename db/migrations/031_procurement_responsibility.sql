-- Migration 031: Procurement responsibility dashboards
-- Adds new statuses, workflow actions, RBAC permissions, and SLA definitions
-- for the full procurement lifecycle: FCN → AS → GM → DGM → Tender → Close → Eval → L1 → Award → WO → Agreement

-- ── 1. New EstimateHeader statuses ───────────────────────────────────────────
ALTER TABLE "EstimateHeader" DROP CONSTRAINT IF EXISTS "EstimateHeader_Status_check";
ALTER TABLE "EstimateHeader" ADD CONSTRAINT "EstimateHeader_Status_check"
  CHECK ("Status" IN (
    'Draft', 'Submitted', 'Reverted',
    'DGM_Approved', 'GM_Recommended', 'CGM_Submitted', 'DOP_Approved',
    'ED_Approved', 'MD_Approved', 'FinalApproved', 'Signed',
    'FCNGenerated', 'AdminSanctionGenerated', 'GMReviewed', 'DGMReviewed',
    'TenderPublished', 'AgencySelected',
    'WorkStarted', 'WorkCompleted',
    'Billing', 'Completed',
    'TenderClosed', 'TechnicalEvaluation', 'FinancialEvaluation',
    'L1Identified', 'WorkAwarded', 'WorkOrderIssued', 'AgreementExecuted'
  ));

-- ── 2. New Workflow.Action values ────────────────────────────────────────────
ALTER TABLE "Workflow" DROP CONSTRAINT IF EXISTS "Workflow_Action_check";
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_Action_check" CHECK (
  ("Action" = ANY (ARRAY[
    'Submit'::text, 'Revert'::text, 'Approve'::text, 'Recommend'::text,
    'SubmitForApproval'::text, 'ApproveAtDOP'::text, 'ApproveAtED'::text,
    'FinalApprove'::text, 'DigitallySign'::text, 'Sign'::text, 'Complete'::text,
    'PublishTender'::text, 'SelectAgency'::text, 'StartWork'::text,
    'CompleteWork'::text, 'SubmitBill'::text, 'Archive'::text,
    'FinanceInward'::text, 'FinanceVerified'::text, 'FinanceRecommended'::text,
    'FinanceApproved'::text, 'ChequeIssued'::text,
    'GenerateFCN'::text, 'GenerateSanction'::text,
    'ReviewForwardGM'::text, 'ReviewForwardDGM'::text,
    'CloseTender'::text, 'TechnicalEval'::text, 'FinancialEval'::text,
    'IdentifyL1'::text, 'CreateAward'::text, 'IssueWorkOrder'::text,
    'RecordAgreement'::text,
    'ReturnToFCN'::text, 'ReturnToDirector'::text, 'ReturnToGM'::text,
    'ReturnToDGM'::text
  ]))
);

-- ── 3. New RBAC permissions ──────────────────────────────────────────────────
INSERT INTO "Permission" ("PermissionKey", "Description", "Module")
VALUES
  ('tender.close', 'Close Tender', 'Tender'),
  ('tender.evaluate', 'Evaluate Bids', 'Tender'),
  ('tender.award', 'Award Tender', 'Tender'),
  ('tender.workOrder', 'Issue Work Order', 'Tender'),
  ('tender.agreement', 'Record Agreement', 'Tender'),
  ('procurement.return', 'Return Estimate', 'Procurement'),
  ('estimate.tender', 'Manage Tender', 'Estimate')
ON CONFLICT ("PermissionKey") DO NOTHING;

-- Map new permissions to roles
INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'TenderOfficer' AND p."PermissionKey" IN ('tender.close', 'estimate.tender')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'ProcurementOfficer' AND p."PermissionKey" IN ('tender.evaluate', 'tender.award', 'tender.workOrder', 'tender.agreement')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'DirectorOfAdministration' AND p."PermissionKey" IN ('procurement.return')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'GM' AND p."PermissionKey" IN ('procurement.return')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'DGM' AND p."PermissionKey" IN ('procurement.return')
ON CONFLICT DO NOTHING;

-- ── 4. New SLA definitions ───────────────────────────────────────────────────
INSERT INTO "SlaDefinition" ("Module", "Stage", "DurationMinutes", "WarningMinutes", "EscalationEnabled", "Active")
VALUES
  ('Tender', 'TenderPreparation', 1440, 240, TRUE, TRUE),
  ('Tender', 'TenderEvaluation', 2880, 480, TRUE, TRUE),
  ('Tender', 'Award', 1440, 240, TRUE, TRUE)
ON CONFLICT ("Module", "Stage") DO UPDATE SET "Active" = TRUE;

-- ── 5. New workflow tracking columns ─────────────────────────────────────────
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "ReturnRemarks" TEXT;
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "ReturnedBy" INT REFERENCES "Users";
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "ReturnedAt" TIMESTAMPTZ;
