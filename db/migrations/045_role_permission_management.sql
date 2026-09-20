-- 045_role_permission_management.sql
-- SoRAdmin Role & Permission Management: idempotent.
-- - Adds the Agency Selection keys (tender.techEval / tender.finEval / tender.l1)
--   and Bill Recommendation (bill.recommend) used by the management UI.
-- - Groups permissions under the six work modules shown to SoRAdmin.
-- - Creates the PermissionChangeAudit table (Grant/Revoke ledger).
-- Does NOT change any existing RolePermission default.

-- 1. Curated permission rows (safe to re-run on any DB state)
INSERT INTO "Permission" ("PermissionKey", "Description", "Module") VALUES
  ('tender.techEval', 'Technical Evaluation of bids', 'Agency'),
  ('tender.finEval',  'Financial Evaluation of bids', 'Agency'),
  ('tender.l1',       'Identify L1 (lowest evaluated bidder)', 'Agency'),
  ('bill.recommend',  'Recommend bill for finance approval', 'Billing')
ON CONFLICT ("PermissionKey") DO NOTHING;

-- 2. Work-module grouping (Permission.Module is display-only)
UPDATE "Permission" SET "Module" = 'Procurement'
WHERE "PermissionKey" IN ('estimate.generateFCN','estimate.verifyFCN',
  'estimate.generateSanction','estimate.verifySanction','estimate.tsApprove',
  'estimate.tsAssign','estimate.tsReturn','estimate.reviewForward');
UPDATE "Permission" SET "Module" = 'Agency'
WHERE "PermissionKey" IN ('tender.evaluate','tender.techEval','tender.finEval',
  'tender.l1','tender.award','tender.workOrder','tender.agreement');

-- 3. Default grants for the new keys, mirroring current designation holders.
--    (TenderOfficer evaluates bids; Manager/DGM/GM check bills.)
INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'TenderOfficer'
  AND p."PermissionKey" IN ('tender.techEval','tender.finEval','tender.l1')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" IN ('Manager','DGM','GM')
  AND p."PermissionKey" = 'bill.recommend'
ON CONFLICT DO NOTHING;

-- 4. Grant/Revoke audit ledger
CREATE TABLE IF NOT EXISTS "PermissionChangeAudit" (
  "AuditID"       SERIAL PRIMARY KEY,
  "UserID"        INT NOT NULL REFERENCES "Users"("UserID"),
  "RoleName"      TEXT NOT NULL,
  "PermissionKey" TEXT NOT NULL,
  "Action"        TEXT NOT NULL CHECK ("Action" IN ('GRANT','REVOKE')),
  "OldAccess"     TEXT NOT NULL CHECK ("OldAccess" IN ('ALLOWED','DENIED')),
  "NewAccess"     TEXT NOT NULL CHECK ("NewAccess" IN ('ALLOWED','DENIED')),
  "CreatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "PermissionChangeAudit_CreatedAt_idx"
  ON "PermissionChangeAudit" ("CreatedAt" DESC);