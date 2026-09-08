-- HMWSSB - v10: Version history with change diffs for the Draft -> Edit -> Submit workflow.
-- Every edit save records a full snapshot in "Versions" plus a machine-readable list of
-- field-level changes, matching the e-Office "draft (edited)" versioning model:
--   Draft -> Draft (Edited) -> Draft (Edited Again) -> Submitted to DGM

ALTER TABLE "Versions" ADD COLUMN IF NOT EXISTS "Changes" JSONB;

CREATE INDEX IF NOT EXISTS idx_versions_estimateid_version
  ON "Versions"("EstimateID", "VersionNumber");
