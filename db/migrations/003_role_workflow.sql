-- HMWSSB - v3: Role-based workflow, ownership transfer, and granular statuses

-- 0. Guard: ensure CurrentOwner column exists (may have been missed if 002 not run)
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "CurrentOwner" INT REFERENCES "Users";

-- 1. Update Users Designation constraint to include all roles
ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "Users_Designation_check";
ALTER TABLE "Users" ADD CONSTRAINT "Users_Designation_check"
  CHECK ("Designation" IN (
    'SoRAdmin','Manager','DGM','GM',
    'TenderOfficer','ProcurementOfficer','SiteEngineer','BillingOfficer','Administrator'
  ));

-- 2. Update EstimateHeader statuses to full workflow
ALTER TABLE "EstimateHeader" DROP CONSTRAINT IF EXISTS "EstimateHeader_Status_check";
ALTER TABLE "EstimateHeader" ADD CONSTRAINT "EstimateHeader_Status_check"
  CHECK ("Status" IN (
    'Draft','Submitted','Reverted',
    'DGM_Approved','Approved',
    'TenderPublished','AgencySelected',
    'WorkStarted','WorkCompleted',
    'Billing','Completed'
  ));

-- 3. Update Workflow Action check to include new transitions
ALTER TABLE "Workflow" DROP CONSTRAINT IF EXISTS "Workflow_Action_check";
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_Action_check"
  CHECK ("Action" IN (
    'Submit','Revert','Approve','Recommend','Sign','Complete',
    'PublishTender','SelectAgency','StartWork','CompleteWork','SubmitBill','Archive'
  ));

-- 4. Add tender-related tables if not already present
CREATE TABLE IF NOT EXISTS "TenderDocuments" (
  "DocumentID" SERIAL PRIMARY KEY,
  "TenderID" INT REFERENCES "Tender",
  "DocumentName" TEXT,
  "DocumentType" TEXT,
  "FilePath" TEXT,
  "UploadedDate" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "AgencyEvaluation" (
  "EvaluationID" SERIAL PRIMARY KEY,
  "TenderID" INT REFERENCES "Tender",
  "AgencyName" TEXT,
  "BidAmount" NUMERIC(14,2),
  "EvaluationRemarks" TEXT,
  "IsSelected" BOOLEAN NOT NULL DEFAULT FALSE,
  "EvaluatedBy" INT REFERENCES "Users",
  "EvaluatedDate" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "WorkProgressPhotos" (
  "PhotoID" SERIAL PRIMARY KEY,
  "ProgressID" INT REFERENCES "WorkProgress",
  "FilePath" TEXT,
  "Caption" TEXT,
  "UploadedDate" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "BillingPayments" (
  "PaymentID" SERIAL PRIMARY KEY,
  "BillID" INT REFERENCES "Billing",
  "PaymentAmount" NUMERIC(14,2),
  "PaymentDate" DATE,
  "PaymentMode" TEXT,
  "TransactionRef" TEXT,
  "Remarks" TEXT
);

-- 5. Index for CurrentOwner lookups
CREATE INDEX IF NOT EXISTS idx_estimateheader_currentowner ON "EstimateHeader"("CurrentOwner");

-- Users are seeded via seed.js to respect foreign key dependencies
