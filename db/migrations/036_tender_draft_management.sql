-- Migration 036: Tender Draft Management (Phase T2)
-- Wires the full tender-creation workbench: draft-only lifecycle, versioning,
-- documents checklist, authority/timeline/description fields and a central
-- master-data source for tender type/category. No publishing, evaluation or
-- award changes here (later phases).

-- ── 1. Tender draft/workbench columns ────────────────────────────────────────
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "ReferenceNo" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "BiddingType" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "OfficerInvitingBids" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "ScopeOfWork" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "QualificationCriteria" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "TechnicalRequirements" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "InstructionsToBidders" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "ContractPeriod" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "DefectLiabilityPeriod" TEXT;

-- Ownership / audit / version tracking (backend-set, never from the form)
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "CurrentOwner" INTEGER;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "CreatedBy" INTEGER;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "CreatedAt" TIMESTAMPTZ DEFAULT now();
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "UpdatedBy" INTEGER;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "UpdatedAt" TIMESTAMPTZ;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "Version" INTEGER DEFAULT 1;

-- One tender per estimate is already enforced by uq_tender_estimate. Guard the
-- human-facing tender number too (race prevention for server-side generation).
CREATE UNIQUE INDEX IF NOT EXISTS uq_tender_no ON "Tender"("TenderNo");

-- ── 2. Tender version history (immutable snapshots per version) ──────────────
CREATE TABLE IF NOT EXISTS "TenderVersion" (
  "VersionID" SERIAL PRIMARY KEY,
  "TenderID" INTEGER NOT NULL REFERENCES "Tender"("TenderID") ON DELETE CASCADE,
  "Version" INTEGER NOT NULL,
  "Snapshot" JSONB NOT NULL,
  "CreatedBy" INTEGER,
  "CreatedAt" TIMESTAMPTZ DEFAULT now(),
  UNIQUE ("TenderID", "Version")
);

-- ── 3. Tender documents checklist ────────────────────────────────────────────
-- Existing TenderDocuments row: DocumentID, TenderID, DocumentName,
-- DocumentType, FilePath, UploadedDate. Add checklist semantics.
ALTER TABLE "TenderDocuments" ADD COLUMN IF NOT EXISTS "Required" BOOLEAN DEFAULT FALSE;
ALTER TABLE "TenderDocuments" ADD COLUMN IF NOT EXISTS "Version" INTEGER DEFAULT 1;
ALTER TABLE "TenderDocuments" ADD COLUMN IF NOT EXISTS "UploadedBy" INTEGER;
ALTER TABLE "TenderDocuments" ADD COLUMN IF NOT EXISTS "UploadedAt" TIMESTAMPTZ DEFAULT now();

-- ── 4. Central master data for tender dropdowns ──────────────────────────────
CREATE TABLE IF NOT EXISTS "TenderConfig" (
  "ConfigKey" TEXT PRIMARY KEY,
  "ConfigValues" JSONB NOT NULL
);

INSERT INTO "TenderConfig" ("ConfigKey", "ConfigValues") VALUES
  ('tenderType',    '["Open","Limited"]'::jsonb),
  ('tenderCategory','["Civil","Water Supply","Sewerage"]'::jsonb),
  ('biddingType',   '["Single Cover","Two Cover"]'::jsonb),
  ('evaluationType','["Percentage","Item Rate","Warranty"]'::jsonb),
  ('documentTypes', '["NIT","Tender Document","BOQ","Technical Specifications","Drawings","Eligibility / Qualification","EMD / Bid Security Instructions","Other"]'::jsonb)
ON CONFLICT ("ConfigKey") DO UPDATE SET "ConfigValues" = EXCLUDED."ConfigValues";