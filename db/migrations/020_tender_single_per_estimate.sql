-- HMWSSB - v20: H3 — one Tender per estimate, enforced at the DB level.
--
-- The sign flow auto-creates a Tender and previously had a race: two concurrent
-- OTP-verified sign requests could both pass the OTP check and insert two Tender
-- rows for the same estimate (observed in real data for estimate 173). The OTP
-- claim is now single-use in the app; this unique index is the DB backstop.
--
-- Dedupe first: keep the lowest TenderID per estimate, dropping only duplicates
-- that no child record (Bid / Agency / TenderDocuments / AgencyEvaluation)
-- references. If a duplicate still has children the CREATE below fails loudly,
-- which is the correct signal for manual resolution.

DELETE FROM "Tender" t
USING "Tender" t2
WHERE t."EstimateID" IS NOT NULL
  AND t."EstimateID" = t2."EstimateID"
  AND t."TenderID" > t2."TenderID"
  AND NOT EXISTS (SELECT 1 FROM "Bid" b WHERE b."TenderID" = t."TenderID")
  AND NOT EXISTS (SELECT 1 FROM "Agency" a WHERE a."TenderID" = t."TenderID")
  AND NOT EXISTS (SELECT 1 FROM "TenderDocuments" d WHERE d."TenderID" = t."TenderID")
  AND NOT EXISTS (SELECT 1 FROM "AgencyEvaluation" e WHERE e."TenderID" = t."TenderID");

CREATE UNIQUE INDEX IF NOT EXISTS uq_tender_estimate ON "Tender"("EstimateID");
