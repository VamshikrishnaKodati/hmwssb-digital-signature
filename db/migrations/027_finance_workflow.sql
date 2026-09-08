-- Phase 2: Finance Workflow
-- Adds FinanceClerk, FinanceManager, FinanceHead roles
-- Creates FinanceWorkflow table for Inward → Verification → Recommended → Approved → ChequeIssued

-- 1. Add finance roles to Users.Designation CHECK
ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "Users_Designation_check";
ALTER TABLE "Users" ADD CONSTRAINT "Users_Designation_check"
  CHECK ("Designation" IN (
    'SoRAdmin','Manager','DGM','GM','CGM',
    'TenderOfficer','ProcurementOfficer','SiteEngineer','BillingOfficer',
    'Administrator','DOP','ED','MD',
    'FinanceClerk','FinanceManager','FinanceHead'
  ));

-- 2. Create FinanceWorkflow table
CREATE TABLE IF NOT EXISTS "FinanceWorkflow" (
  "FinanceID"      SERIAL PRIMARY KEY,
  "BillID"         INT NOT NULL REFERENCES "Billing"("BillID"),
  "EstimateID"     INT NOT NULL REFERENCES "EstimateHeader"("EstimateID"),
  "InwardNumber"   TEXT,
  "InwardDate"     TIMESTAMP,
  "ReceivedBy"     INT REFERENCES "Users"("UserID"),
  "VerifiedBy"     INT REFERENCES "Users"("UserID"),
  "VerifiedDate"   TIMESTAMP,
  "RecommendedBy"  INT REFERENCES "Users"("UserID"),
  "RecommendedDate" TIMESTAMP,
  "ApprovedBy"     INT REFERENCES "Users"("UserID"),
  "ApprovedDate"   TIMESTAMP,
  "ChequeNumber"   TEXT,
  "ChequeDate"     DATE,
  "Amount"         NUMERIC(14,2) NOT NULL,
  "Status"         TEXT NOT NULL DEFAULT 'Inward'
                   CHECK ("Status" IN ('Inward','Verification','Recommended','Approved','ChequeIssued')),
  "CurrentOwner"   INT REFERENCES "Users"("UserID"),
  "Remarks"        TEXT,
  "CreatedDate"    TIMESTAMP DEFAULT now(),
  "UpdatedDate"    TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_finance_bill" ON "FinanceWorkflow"("BillID");
CREATE INDEX IF NOT EXISTS "idx_finance_estimate" ON "FinanceWorkflow"("EstimateID");
CREATE INDEX IF NOT EXISTS "idx_finance_status" ON "FinanceWorkflow"("Status");
CREATE INDEX IF NOT EXISTS "idx_finance_owner" ON "FinanceWorkflow"("CurrentOwner");

-- 3. Add finance action values to Workflow Action CHECK
ALTER TABLE "Workflow" DROP CONSTRAINT IF EXISTS "Workflow_Action_check";
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_Action_check"
  CHECK ("Action" IN (
    'Submit', 'Revert', 'Approve', 'Recommend', 'SubmitForApproval',
    'ApproveAtDOP', 'ApproveAtED', 'FinalApprove',
    'DigitallySign', 'Sign', 'Complete',
    'PublishTender', 'SelectAgency', 'StartWork', 'CompleteWork',
    'SubmitBill', 'Archive',
    'FinanceInward', 'FinanceVerified', 'FinanceRecommended',
    'FinanceApproved', 'ChequeIssued'
  ));
