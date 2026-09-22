-- Migration 030: Post-approval workflow (FCN -> AdminSanction -> GM/DGM Review)
-- After MD Final Approval: FinanceHead generates FCN -> DirectorOfAdmin generates
-- Administrative Sanction -> GM reviews/forwards -> DGM reviews/forwards -> Tender.
-- No BEGIN/COMMIT: each statement is independent for incremental application.

-- ── 1. New designations ──────────────────────────────────────────────────────

ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "Users_Designation_check";
ALTER TABLE "Users" ADD CONSTRAINT "Users_Designation_check"
  CHECK ("Designation" IN (
    'SoRAdmin','Manager','DGM','GM','CGM',
    'TenderOfficer','ProcurementOfficer','SiteEngineer','BillingOfficer',
    'Administrator','DOP','ED','MD',
    'FinanceClerk','FinanceManager','FinanceHead',
    'DirectorOfAdministration'
  ));

-- ── 2. New statuses on EstimateHeader ─────────────────────────────────────────

ALTER TABLE "EstimateHeader" DROP CONSTRAINT IF EXISTS "EstimateHeader_Status_check";
ALTER TABLE "EstimateHeader" ADD CONSTRAINT "EstimateHeader_Status_check"
  CHECK ("Status" IN (
    'Draft', 'Submitted', 'Reverted',
    'DGM_Approved', 'GM_Recommended', 'CGM_Submitted', 'DOP_Approved',
    'ED_Approved', 'MD_Approved', 'FinalApproved', 'Signed',
    'FCNGenerated', 'AdminSanctionGenerated', 'GMReviewed', 'DGMReviewed',
    'TenderPublished', 'AgencySelected',
    'WorkStarted', 'WorkCompleted',
    'Billing', 'Completed'
  ));

-- ── 2b. New actions on Workflow ───────────────────────────────────────────────

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
    'ReviewForwardGM'::text, 'ReviewForwardDGM'::text
  ]))
);

-- ── 3. FCN table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "FCN" (
  "FCNID"           SERIAL PRIMARY KEY,
  "EstimateID"      INT NOT NULL REFERENCES "EstimateHeader"("EstimateID"),
  "FCNNo"           TEXT NOT NULL,
  "FCNDate"         DATE NOT NULL DEFAULT CURRENT_DATE,
  "GeneratedBy"     INT REFERENCES "Users"("UserID"),
  "GeneratedDate"   TIMESTAMP DEFAULT now(),
  "VerifiedBy"      INT REFERENCES "Users"("UserID"),
  "VerifiedDate"    TIMESTAMP,
  "Status"          TEXT DEFAULT 'Generated' CHECK ("Status" IN ('Generated','Verified','Rejected')),
  "Remarks"         TEXT,
  "CreatedDate"     TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "FCN_EstimateID_unique" ON "FCN"("EstimateID");
CREATE INDEX IF NOT EXISTS "FCN_Status_idx" ON "FCN"("Status");

-- ── 4. Administrative Sanction table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AdministrativeSanction" (
  "SanctionID"      SERIAL PRIMARY KEY,
  "EstimateID"      INT NOT NULL REFERENCES "EstimateHeader"("EstimateID"),
  "SanctionNo"      TEXT NOT NULL,
  "SanctionDate"    DATE NOT NULL DEFAULT CURRENT_DATE,
  "GeneratedBy"     INT REFERENCES "Users"("UserID"),
  "GeneratedDate"   TIMESTAMP DEFAULT now(),
  "VerifiedBy"      INT REFERENCES "Users"("UserID"),
  "VerifiedDate"    TIMESTAMP,
  "Status"          TEXT DEFAULT 'Generated' CHECK ("Status" IN ('Generated','Verified','Rejected')),
  "Remarks"         TEXT,
  "CreatedDate"     TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminSanction_EstimateID_unique" ON "AdministrativeSanction"("EstimateID");
CREATE INDEX IF NOT EXISTS "AdminSanction_Status_idx" ON "AdministrativeSanction"("Status");

-- ── 5. FK columns on EstimateHeader ──────────────────────────────────────────

ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "FCNID" INT REFERENCES "FCN"("FCNID");
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "AdminSanctionID" INT REFERENCES "AdministrativeSanction"("SanctionID");

-- ── 6. Seed DirectorOfAdministration user ─────────────────────────────────────

INSERT INTO "Users" ("Username", "Name", "Email", "Designation", "PasswordHash", "IsActive")
VALUES (
  'director_admin',
  'Dr. Priya Nair',
  'director.admin@hmwssb.gov.in',
  'DirectorOfAdministration',
  '$2b$10$defaulthash',
  TRUE
) ON CONFLICT ("Username") DO NOTHING;

-- ── 7. SLA definitions for new stages ────────────────────────────────────────

INSERT INTO "SlaDefinition" ("Module", "Stage", "DurationMinutes", "WarningMinutes", "Active", "CreatedAt")
VALUES
  ('Estimate', 'FCN', 480, 60, TRUE, now()),
  ('Estimate', 'DirectorAdmin', 480, 60, TRUE, now()),
  ('Estimate', 'GMReview', 480, 60, TRUE, now()),
  ('Estimate', 'DGMReview', 480, 60, TRUE, now())
ON CONFLICT DO NOTHING;

-- ── 8. RBAC permissions for new stages ───────────────────────────────────────

INSERT INTO "Permission" ("PermissionKey", "Description", "Module")
VALUES
  ('estimate.generateFCN', 'Generate FCN', 'estimate'),
  ('estimate.verifyFCN', 'Verify FCN', 'estimate'),
  ('estimate.generateSanction', 'Generate Administrative Sanction', 'estimate'),
  ('estimate.verifySanction', 'Verify Administrative Sanction', 'estimate'),
  ('estimate.reviewForward', 'Review and Forward', 'estimate')
ON CONFLICT ("PermissionKey") DO NOTHING;

-- Map permissions to roles
INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'FinanceHead' AND p."PermissionKey" IN ('estimate.generateFCN', 'estimate.verifyFCN')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'DirectorOfAdministration' AND p."PermissionKey" IN ('estimate.generateSanction', 'estimate.verifySanction')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'GM' AND p."PermissionKey" = 'estimate.reviewForward'
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'DGM' AND p."PermissionKey" = 'estimate.reviewForward'
ON CONFLICT DO NOTHING;

-- ── 9. Seed DirectorOfAdministration role ─────────────────────────────────────

INSERT INTO "Role" ("RoleName", "Description")
VALUES ('DirectorOfAdministration', 'Director of Administration - generates and verifies administrative sanctions')
ON CONFLICT ("RoleName") DO NOTHING;

-- ── 10. Generate sequence for FCN and Sanction numbers ───────────────────────

CREATE SEQUENCE IF NOT EXISTS "FCN_Seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "AdminSanction_Seq" START 1;
