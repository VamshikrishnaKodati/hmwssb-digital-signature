-- ============================================================================
-- Migration 053: Letter of Award (LOA).
--
-- Sits BETWEEN Work Award and Work Order in the tender pipeline:
--   ... → L1Identified → WorkAwarded → [LetterOfAward] → WorkOrderIssued →
--   AgreementExecuted
--
-- The LOA is a real record of the award, issued by the DirectorOfAdministration
-- for the already-awarded work. It does NOT move Tender.Status — the tender
-- stays `WorkAwarded`, so Work Order remains the next workflow action. One LOA
-- per tender (UNIQUE on TenderID) — repeated "generate" clicks/refreshes can
-- never create duplicates at the database level.
--
-- Status vocabulary (clear states only, no invented workflow stages):
--   Draft     (reserved; no data-entry flow creates it today)
--   Generated (created by the Director's Generate action)
--   Printed   (first print/download captured; stays printed thereafter)
-- ============================================================================

BEGIN;

CREATE SEQUENCE IF NOT EXISTS loa_number_seq;

CREATE TABLE IF NOT EXISTS "LetterOfAward" (
  "LOAID"        SERIAL PRIMARY KEY,
  "TenderID"     INT NOT NULL UNIQUE REFERENCES "Tender"("TenderID") ON DELETE CASCADE,
  "EstimateID"   INT REFERENCES "EstimateHeader"("EstimateID"),
  "BidID"        INT REFERENCES "Bid"("BidID"),
  "AgencyID"     INT REFERENCES "Agency"("AgencyID"),
  "LOANumber"    TEXT NOT NULL UNIQUE,
  "Status"       TEXT NOT NULL DEFAULT 'Generated'
                 CHECK ("Status" IN ('Draft','Generated','Printed')),
  "Conditions"   TEXT,
  "GeneratedBy"  INT REFERENCES "Users"("UserID"),
  "GeneratedAt"  TIMESTAMPTZ DEFAULT now(),
  "PrintedAt"    TIMESTAMPTZ,
  "PrintedBy"    INT REFERENCES "Users"("UserID")
);

COMMIT;