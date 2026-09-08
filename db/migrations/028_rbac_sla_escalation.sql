-- 028_rbac_sla_escalation.sql
-- Phase 3C: RBAC, SLA, Escalation tables

-- ── RBAC ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Role" (
  "RoleID"        SERIAL PRIMARY KEY,
  "RoleName"      TEXT UNIQUE NOT NULL,
  "Description"   TEXT,
  "IsActive"      BOOLEAN NOT NULL DEFAULT TRUE,
  "CreatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Permission" (
  "PermissionID"  SERIAL PRIMARY KEY,
  "PermissionKey" TEXT UNIQUE NOT NULL,
  "Description"   TEXT,
  "Module"        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "RoleID"       INT NOT NULL REFERENCES "Role"("RoleID") ON DELETE CASCADE,
  "PermissionID" INT NOT NULL REFERENCES "Permission"("PermissionID") ON DELETE CASCADE,
  PRIMARY KEY ("RoleID", "PermissionID")
);

-- Seed roles from existing designations
INSERT INTO "Role" ("RoleName", "Description") VALUES
  ('Manager', 'Estimate creator and submitter'),
  ('DGM', 'Deputy General Manager - verification'),
  ('GM', 'General Manager - recommendation'),
  ('CGM', 'Chief General Manager - submission for approval'),
  ('DOP', 'Director of Projects - approval'),
  ('ED', 'Executive Director - approval'),
  ('MD', 'Managing Director - final approval'),
  ('TenderOfficer', 'Tender management'),
  ('ProcurementOfficer', 'Agency selection and procurement'),
  ('SiteEngineer', 'Work execution and measurement'),
  ('BillingOfficer', 'Bill creation and management'),
  ('FinanceClerk', 'Finance inward and verification'),
  ('FinanceManager', 'Finance recommendation'),
  ('FinanceHead', 'Finance approval and cheque issuance'),
  ('Administrator', 'System administration'),
  ('SoRAdmin', 'Schedule of Rates administration')
ON CONFLICT ("RoleName") DO NOTHING;

-- Seed permissions
INSERT INTO "Permission" ("PermissionKey", "Description", "Module") VALUES
  -- Estimate
  ('estimate.create', 'Create new estimates', 'Estimate'),
  ('estimate.view', 'View estimates', 'Estimate'),
  ('estimate.edit', 'Edit draft estimates', 'Estimate'),
  ('estimate.submit', 'Submit estimate to DGM', 'Estimate'),
  ('estimate.verify', 'Verify estimate (DGM)', 'Estimate'),
  ('estimate.recommend', 'Recommend estimate (GM)', 'Estimate'),
  ('estimate.submitApproval', 'Submit for approval (CGM)', 'Estimate'),
  ('estimate.approve', 'Approve estimate (DOP/ED)', 'Estimate'),
  ('estimate.finalApprove', 'Final approve (MD)', 'Estimate'),
  ('estimate.delete', 'Delete estimate', 'Estimate'),
  ('estimate.restore', 'Restore deleted estimate', 'Estimate'),
  -- Tender
  ('tender.view', 'View tenders', 'Tender'),
  ('tender.create', 'Create tender', 'Tender'),
  ('tender.publish', 'Publish tender', 'Tender'),
  ('tender.update', 'Update tender', 'Tender'),
  -- Agency
  ('agency.view', 'View agencies', 'Agency'),
  ('agency.create', 'Create agency', 'Agency'),
  ('agency.select', 'Select agency', 'Agency'),
  -- Work
  ('work.start', 'Start work', 'Work'),
  ('work.progress', 'Update work progress', 'Work'),
  ('work.complete', 'Complete work', 'Work'),
  -- Measurement
  ('measurement.create', 'Create measurement', 'Measurement'),
  ('measurement.verify', 'Verify measurement', 'Measurement'),
  -- Billing
  ('bill.create', 'Create bill', 'Billing'),
  ('bill.submit', 'Submit bill', 'Billing'),
  -- Finance
  ('finance.inward', 'Create finance inward', 'Finance'),
  ('finance.verify', 'Verify finance record', 'Finance'),
  ('finance.recommend', 'Recommend finance record', 'Finance'),
  ('finance.approve', 'Approve finance record', 'Finance'),
  ('finance.cheque', 'Issue cheque', 'Finance'),
  -- Admin
  ('audit.view', 'View audit logs', 'Admin'),
  ('reports.view', 'View reports', 'Reports'),
  ('users.manage', 'Manage users', 'Admin'),
  ('notifications.view', 'View notifications', 'Notifications')
ON CONFLICT ("PermissionKey") DO NOTHING;

-- Map permissions to roles
INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r
JOIN "Permission" p ON (
  -- Manager
  (r."RoleName" = 'Manager' AND p."PermissionKey" IN ('estimate.create','estimate.view','estimate.edit','estimate.submit','tender.view','notifications.view'))
  OR (r."RoleName" = 'DGM' AND p."PermissionKey" IN ('estimate.view','estimate.verify','notifications.view'))
  OR (r."RoleName" = 'GM' AND p."PermissionKey" IN ('estimate.view','estimate.recommend','notifications.view'))
  OR (r."RoleName" = 'CGM' AND p."PermissionKey" IN ('estimate.view','estimate.submitApproval','notifications.view'))
  OR (r."RoleName" = 'DOP' AND p."PermissionKey" IN ('estimate.view','estimate.approve','notifications.view'))
  OR (r."RoleName" = 'ED' AND p."PermissionKey" IN ('estimate.view','estimate.approve','notifications.view'))
  OR (r."RoleName" = 'MD' AND p."PermissionKey" IN ('estimate.view','estimate.finalApprove','notifications.view'))
  OR (r."RoleName" = 'TenderOfficer' AND p."PermissionKey" IN ('tender.view','tender.create','tender.publish','tender.update','estimate.view','notifications.view'))
  OR (r."RoleName" = 'ProcurementOfficer' AND p."PermissionKey" IN ('agency.view','agency.create','agency.select','estimate.view','notifications.view'))
  OR (r."RoleName" = 'SiteEngineer' AND p."PermissionKey" IN ('work.start','work.progress','work.complete','measurement.create','estimate.view','notifications.view'))
  OR (r."RoleName" = 'BillingOfficer' AND p."PermissionKey" IN ('bill.create','bill.submit','measurement.verify','estimate.view','notifications.view'))
  OR (r."RoleName" = 'FinanceClerk' AND p."PermissionKey" IN ('finance.inward','finance.verify','estimate.view','notifications.view'))
  OR (r."RoleName" = 'FinanceManager' AND p."PermissionKey" IN ('finance.verify','finance.recommend','estimate.view','notifications.view'))
  OR (r."RoleName" = 'FinanceHead' AND p."PermissionKey" IN ('finance.approve','finance.cheque','estimate.view','notifications.view'))
  OR (r."RoleName" = 'Administrator' AND p."PermissionKey" IN ('estimate.view','estimate.delete','estimate.restore','audit.view','reports.view','users.manage','notifications.view','tender.view','agency.view'))
  OR (r."RoleName" = 'SoRAdmin' AND p."PermissionKey" IN ('estimate.view','reports.view','notifications.view'))
)
ON CONFLICT DO NOTHING;

-- ── SLA ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "SlaDefinition" (
  "SlaID"              SERIAL PRIMARY KEY,
  "Module"             TEXT NOT NULL,         -- 'Estimate', 'Finance', 'Tender', 'Work', 'Billing', 'Measurement'
  "Stage"              TEXT NOT NULL,         -- 'DGM', 'GM', 'CGM', 'DOP', 'ED', 'MD', 'Inward', etc.
  "DurationMinutes"    INT NOT NULL,          -- SLA duration in minutes
  "WarningMinutes"     INT NOT NULL DEFAULT 60, -- warning before deadline
  "EscalationEnabled"  BOOLEAN NOT NULL DEFAULT TRUE,
  "Active"             BOOLEAN NOT NULL DEFAULT TRUE,
  "CreatedBy"          INT REFERENCES "Users"("UserID"),
  "CreatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "UpdatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("Module", "Stage")
);

-- Default SLA definitions (configurable by admin, seed with illustrative values)
INSERT INTO "SlaDefinition" ("Module", "Stage", "DurationMinutes", "WarningMinutes", "EscalationEnabled") VALUES
  ('Estimate', 'DGM', 480, 60, TRUE),       -- 8 hours, warn at 7h
  ('Estimate', 'GM', 480, 60, TRUE),        -- 8 hours
  ('Estimate', 'CGM', 480, 60, TRUE),       -- 8 hours
  ('Estimate', 'DOP', 720, 120, TRUE),      -- 12 hours
  ('Estimate', 'ED', 720, 120, TRUE),       -- 12 hours
  ('Estimate', 'MD', 1440, 240, TRUE),      -- 24 hours
  ('Finance', 'Inward', 240, 60, TRUE),     -- 4 hours
  ('Finance', 'Verification', 480, 60, TRUE), -- 8 hours
  ('Finance', 'Recommended', 480, 60, TRUE), -- 8 hours
  ('Finance', 'Approved', 240, 60, TRUE)     -- 4 hours
ON CONFLICT ("Module", "Stage") DO NOTHING;

-- Add SLA tracking columns to EstimateHeader (safe — column add is idempotent)
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "SlaStartedAt" TIMESTAMPTZ;
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "SlaDueAt" TIMESTAMPTZ;
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "SlaStatus" TEXT DEFAULT 'Normal';
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "EscalationLevel" INT DEFAULT 0;
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "LastEscalatedAt" TIMESTAMPTZ;

-- Add SLA tracking to FinanceWorkflow
ALTER TABLE "FinanceWorkflow" ADD COLUMN IF NOT EXISTS "SlaStartedAt" TIMESTAMPTZ;
ALTER TABLE "FinanceWorkflow" ADD COLUMN IF NOT EXISTS "SlaDueAt" TIMESTAMPTZ;
ALTER TABLE "FinanceWorkflow" ADD COLUMN IF NOT EXISTS "SlaStatus" TEXT DEFAULT 'Normal';
ALTER TABLE "FinanceWorkflow" ADD COLUMN IF NOT EXISTS "EscalationLevel" INT DEFAULT 0;
ALTER TABLE "FinanceWorkflow" ADD COLUMN IF NOT EXISTS "LastEscalatedAt" TIMESTAMPTZ;

-- ── Escalation Rules ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "EscalationRule" (
  "RuleID"            SERIAL PRIMARY KEY,
  "Module"            TEXT NOT NULL,
  "Stage"             TEXT NOT NULL,
  "AfterMinutes"      INT NOT NULL,           -- minutes after SLA deadline
  "EscalateToRole"    TEXT NOT NULL,          -- who receives escalation
  "NotificationType"  TEXT NOT NULL DEFAULT 'Escalation',
  "Active"            BOOLEAN NOT NULL DEFAULT TRUE,
  "CreatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default escalation rules (configurable)
INSERT INTO "EscalationRule" ("Module", "Stage", "AfterMinutes", "EscalateToRole") VALUES
  ('Estimate', 'DGM', 120, 'GM'),
  ('Estimate', 'GM', 120, 'CGM'),
  ('Estimate', 'CGM', 120, 'DOP'),
  ('Estimate', 'DOP', 240, 'ED'),
  ('Estimate', 'ED', 240, 'MD'),
  ('Finance', 'Verification', 120, 'FinanceManager'),
  ('Finance', 'Recommended', 120, 'FinanceHead')
ON CONFLICT DO NOTHING;

-- Escalation audit log
CREATE TABLE IF NOT EXISTS "EscalationLog" (
  "EscalationID"   SERIAL PRIMARY KEY,
  "Module"         TEXT NOT NULL,
  "RecordID"       INT NOT NULL,              -- EstimateID or FinanceID
  "Stage"          TEXT NOT NULL,
  "EscalationLevel" INT NOT NULL DEFAULT 1,
  "EscalatedTo"    TEXT NOT NULL,
  "TriggeredAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ResolvedAt"     TIMESTAMPTZ,
  "ResolutionType" TEXT                         -- 'actioned', 'reverted', 'cancelled'
);

-- Login audit table
CREATE TABLE IF NOT EXISTS "LoginAudit" (
  "AuditID"       SERIAL PRIMARY KEY,
  "Username"      TEXT NOT NULL,
  "IPAddress"     TEXT,
  "Success"       BOOLEAN NOT NULL,
  "FailureReason" TEXT,
  "AttemptedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Password change audit
CREATE TABLE IF NOT EXISTS "PasswordChangeAudit" (
  "AuditID"     SERIAL PRIMARY KEY,
  "UserID"      INT NOT NULL REFERENCES "Users"("UserID"),
  "ActorID"     INT NOT NULL REFERENCES "Users"("UserID"),
  "ChangedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
