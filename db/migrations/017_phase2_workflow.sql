-- Phase-2: Digital signature OTP, certificate metadata, and module field extensions

CREATE TABLE IF NOT EXISTS "SignatureOTP" (
  "OTPID" SERIAL PRIMARY KEY,
  "EstimateID" INT REFERENCES "EstimateHeader"("EstimateID") ON DELETE CASCADE,
  "UserID" INT REFERENCES "Users"("UserID"),
  "CodeHash" TEXT NOT NULL,
  "Purpose" TEXT NOT NULL DEFAULT 'signature',
  "ExpiresAt" TIMESTAMP NOT NULL,
  "Attempts" INT NOT NULL DEFAULT 0,
  "Verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "CreatedDate" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signatureotp_estimate ON "SignatureOTP"("EstimateID");

ALTER TABLE "EstimateHeader"
  ADD COLUMN IF NOT EXISTS "CertificateID" TEXT,
  ADD COLUMN IF NOT EXISTS "SignatureHash" TEXT;

ALTER TABLE "Agency"
  ADD COLUMN IF NOT EXISTS "ContractorName" TEXT,
  ADD COLUMN IF NOT EXISTS "WorkOrderDate" DATE,
  ADD COLUMN IF NOT EXISTS "StartDate" DATE,
  ADD COLUMN IF NOT EXISTS "CompletionDate" DATE;

ALTER TABLE "WorkProgress"
  ADD COLUMN IF NOT EXISTS "Photos" TEXT,
  ADD COLUMN IF NOT EXISTS "InspectionNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "EngineerRemarks" TEXT,
  ADD COLUMN IF NOT EXISTS "DelayReason" TEXT;

ALTER TABLE "Billing"
  ADD COLUMN IF NOT EXISTS "BillNo" TEXT,
  ADD COLUMN IF NOT EXISTS "BillDate" DATE,
  ADD COLUMN IF NOT EXISTS "Measurements" TEXT,
  ADD COLUMN IF NOT EXISTS "ApprovedAmount" NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS "SubmittedBy" INT REFERENCES "Users"("UserID"),
  ADD COLUMN IF NOT EXISTS "SubmissionDate" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "CurrentStep" TEXT;
