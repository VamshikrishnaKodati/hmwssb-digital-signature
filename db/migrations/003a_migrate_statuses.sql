-- HMWSSB - v3a: Data migration for status/ownership (runs after 003_role_workflow.sql)
-- This was extracted from the original 003 to keep schema and data changes separate.

-- Migrate old statuses to new v3 equivalents
-- Note: GM_Approved was used in v2 but removed in v3 — map it to Approved
UPDATE "EstimateHeader" SET "Status" = 'Approved'
WHERE "Status" IN ('Approved','GM_Approved','Signed','Completed');

-- Ensure every estimate has a current owner
UPDATE "EstimateHeader" SET "CurrentOwner" = "CreatedBy"
WHERE "CurrentOwner" IS NULL;
