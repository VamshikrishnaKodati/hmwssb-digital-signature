-- HMWSSB Works Management System - v2 Workflow Completion
-- Adds: EstimateNo, CurrentOwner, Versions, Digital Signature, Completed status

ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "EstimateNo" TEXT;
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "CurrentOwner" INT REFERENCES "Users";
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "IsDigitallySigned" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "DigitallySignedBy" INT REFERENCES "Users";
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "DigitallySignedDate" TIMESTAMP;
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "IsCompleted" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "CompletedDate" TIMESTAMP;
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "ActionTakenReport" TEXT;
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "FinancialYear" TEXT;
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "SubmissionDate" TIMESTAMP;
ALTER TABLE "EstimateHeader" DROP CONSTRAINT IF EXISTS "EstimateHeader_Status_check";
ALTER TABLE "EstimateHeader" ADD CONSTRAINT "EstimateHeader_Status_check"
  CHECK ("Status" IN ('Draft','Submitted','DGM_Approved','GM_Approved','Reverted','Approved','Signed','Completed'));

ALTER TABLE "Workflow" ADD COLUMN IF NOT EXISTS "ActionTakenReport" TEXT;
ALTER TABLE "Workflow" DROP CONSTRAINT IF EXISTS "Workflow_Action_check";
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_Action_check"
  CHECK ("Action" IN ('Submit','Revert','Approve','Recommend','Sign','Complete'));
ALTER TABLE "Workflow" DROP CONSTRAINT IF EXISTS "revert_needs_remarks";
ALTER TABLE "Workflow" ADD CONSTRAINT "revert_needs_remarks"
  CHECK ("Action" <> 'Revert' OR "Remarks" IS NOT NULL);

CREATE TABLE IF NOT EXISTS "Versions" (
  "VersionID" SERIAL PRIMARY KEY,
  "EstimateID" INT REFERENCES "EstimateHeader" NOT NULL,
  "VersionNumber" INT NOT NULL,
  "Data" JSONB NOT NULL,
  "CreatedBy" INT REFERENCES "Users",
  "CreatedDate" TIMESTAMP NOT NULL DEFAULT now(),
  "Remarks" TEXT
);

CREATE INDEX IF NOT EXISTS idx_versions_estimateid ON "Versions"("EstimateID");
