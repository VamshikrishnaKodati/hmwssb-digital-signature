-- Migration 033: Technical Sanction Authority Routing
-- Adds TS table, FCN authority assignment, TSPending/TSApproved statuses,
-- SLA definitions for TS stages, escalation rules, and RBAC permissions.

-- ── 1. TechnicalSanction table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "TechnicalSanction" (
  "TSID"             SERIAL PRIMARY KEY,
  "EstimateID"       INT NOT NULL UNIQUE REFERENCES "EstimateHeader"("EstimateID"),
  "TSNo"             TEXT,
  "TSDate"           DATE,
  "AuthorityRole"    TEXT NOT NULL,
  "AuthorityUserID"  INT NOT NULL REFERENCES "Users"("UserID"),
  "AssignedBy"       INT NOT NULL REFERENCES "Users"("UserID"),
  "AssignedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Status"           TEXT NOT NULL DEFAULT 'Pending' CHECK ("Status" IN ('Pending','Approved','Returned')),
  "ApprovedBy"       INT REFERENCES "Users"("UserID"),
  "ApprovedAt"       TIMESTAMPTZ,
  "Remarks"          TEXT,
  "CreatedDate"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "TechnicalSanction_EstimateID_idx" ON "TechnicalSanction"("EstimateID");

-- ── 2. EstimateHeader: TS + FCN authority columns ─────────────────────────────

ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "TSID" INT REFERENCES "TechnicalSanction"("TSID");
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "FCNAuthorityRole" TEXT;
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "FCNAuthorityUserID" INT REFERENCES "Users"("UserID");

-- ── 3. Status CHECK: add TSPending, TSApproved ────────────────────────────────

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
    'L1Identified', 'WorkAwarded', 'WorkOrderIssued', 'AgreementExecuted',
    'TSPending', 'TSApproved'
  ));

-- ── 4. Workflow.Action CHECK: add TS actions ──────────────────────────────────

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
    'ReturnToDGM'::text,
    'AssignFCNAuthority'::text, 'AssignTSAuthority'::text,
    'ApproveTS'::text, 'ReturnTS'::text
  ]))
);

-- ── 5. SLA definitions for TS + tender preparation under Estimate ─────────────

INSERT INTO "SlaDefinition" ("Module", "Stage", "DurationMinutes", "WarningMinutes", "EscalationEnabled", "Active")
VALUES
  ('Estimate', 'TechnicalSanction', 480, 60, TRUE, TRUE),
  ('Estimate', 'TenderPreparation', 1440, 240, TRUE, TRUE)
ON CONFLICT ("Module", "Stage") DO UPDATE SET "Active" = TRUE, "DurationMinutes" = EXCLUDED."DurationMinutes";

-- ── 6. Escalation rules for FCN/DirectorAdmin/TS stages ──────────────────────

INSERT INTO "EscalationRule" ("Module", "Stage", "AfterMinutes", "EscalateToRole", "NotificationType", "Active")
SELECT 'Estimate', 'FCN', 120, 'MD', 'Escalation', TRUE
WHERE NOT EXISTS (SELECT 1 FROM "EscalationRule" WHERE "Module" = 'Estimate' AND "Stage" = 'FCN');

INSERT INTO "EscalationRule" ("Module", "Stage", "AfterMinutes", "EscalateToRole", "NotificationType", "Active")
SELECT 'Estimate', 'DirectorAdmin', 120, 'MD', 'Escalation', TRUE
WHERE NOT EXISTS (SELECT 1 FROM "EscalationRule" WHERE "Module" = 'Estimate' AND "Stage" = 'DirectorAdmin');

INSERT INTO "EscalationRule" ("Module", "Stage", "AfterMinutes", "EscalateToRole", "NotificationType", "Active")
SELECT 'Estimate', 'TechnicalSanction', 120, 'MD', 'Escalation', TRUE
WHERE NOT EXISTS (SELECT 1 FROM "EscalationRule" WHERE "Module" = 'Estimate' AND "Stage" = 'TechnicalSanction');

INSERT INTO "EscalationRule" ("Module", "Stage", "AfterMinutes", "EscalateToRole", "NotificationType", "Active")
SELECT 'Estimate', 'TenderPreparation', 240, 'MD', 'Escalation', TRUE
WHERE NOT EXISTS (SELECT 1 FROM "EscalationRule" WHERE "Module" = 'Estimate' AND "Stage" = 'TenderPreparation');

-- ── 7. RBAC permissions ──────────────────────────────────────────────────────

INSERT INTO "Permission" ("PermissionKey", "Description", "Module")
VALUES
  ('estimate.fcnAssign', 'Assign FCN authority', 'Estimate'),
  ('estimate.tsAssign', 'Assign TS authority', 'Estimate'),
  ('estimate.tsApprove', 'Approve Technical Sanction', 'Estimate'),
  ('estimate.tsReturn', 'Return Technical Sanction', 'Estimate')
ON CONFLICT ("PermissionKey") DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'MD' AND p."PermissionKey" = 'estimate.fcnAssign'
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'Administrator' AND p."PermissionKey" = 'estimate.fcnAssign'
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'DirectorOfAdministration' AND p."PermissionKey" IN ('estimate.tsAssign', 'estimate.tsReturn')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" IN ('DirectorOfAdministration', 'GM', 'DGM') AND p."PermissionKey" IN ('estimate.tsApprove', 'estimate.tsReturn')
ON CONFLICT DO NOTHING;

-- ── 8. TSNo sequence ──────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS "TS_Seq" START 1;
