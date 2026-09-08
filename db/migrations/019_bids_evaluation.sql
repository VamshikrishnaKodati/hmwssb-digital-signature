-- HMWSSB - v19: Bid/Contractor lifecycle, NIT/BOQ support, tender-specific fields

-- 1. Tender-specific configuration fields (NIT source data)
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "TenderType" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "BidStartDate" DATE;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "BidEndDate" DATE;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "TechnicalBidOpeningDate" DATE;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "FinancialBidOpeningDate" DATE;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "CompletionPeriod" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "EMD" NUMERIC(14,2);
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "TenderFee" NUMERIC(14,2);
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "BidValidity" INT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "EligibilityCriteria" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "RequiredDocuments" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "PerformanceSecurity" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "SpecialConditions" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "TenderRemarks" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "PublishedBy" INT REFERENCES "Users";
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "PublishedDate" TIMESTAMP;

-- 2. Contractor registry
CREATE TABLE IF NOT EXISTS "Contractor" (
  "ContractorID" SERIAL PRIMARY KEY,
  "ContractorName" TEXT NOT NULL,
  "RegistrationNo" TEXT,
  "Email" TEXT,
  "Phone" TEXT,
  "Address" TEXT,
  "ContactDetails" TEXT,
  "CreatedDate" TIMESTAMP NOT NULL DEFAULT now()
);

-- 3. Bid submissions against a tender
CREATE TABLE IF NOT EXISTS "Bid" (
  "BidID" SERIAL PRIMARY KEY,
  "TenderID" INT REFERENCES "Tender",
  "ContractorID" INT REFERENCES "Contractor",
  "BidDate" DATE DEFAULT CURRENT_DATE,
  "TechnicalBid" TEXT,
  "FinancialBidAmount" NUMERIC(14,2),
  "Documents" TEXT,
  "EMD" NUMERIC(14,2),
  "TechnicalStatus" TEXT NOT NULL DEFAULT 'Pending' CHECK ("TechnicalStatus" IN ('Pending','Eligible','Rejected')),
  "TechnicalRemarks" TEXT,
  "Rank" INT,
  "IsSelected" BOOLEAN NOT NULL DEFAULT FALSE,
  "Status" TEXT NOT NULL DEFAULT 'Submitted',
  "CreatedDate" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bid_tender ON "Bid"("TenderID");
CREATE INDEX IF NOT EXISTS idx_tender_status ON "Tender"("Status");
