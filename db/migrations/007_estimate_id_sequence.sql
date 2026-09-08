-- HMWSSB - v7: Automatic Estimate ID generation (EST/<FinancialYear>/<WardCode>/<Sequence>)
-- WardCode comes from the HMWSSB Location Master (numeric prefix of the Ward name).
-- Sequence increments per (FinancialYear, WardCode) via an atomic counter table
-- that is never decremented, so deleted estimates never cause number reuse.

-- 1. Dedicated fields on EstimateHeader
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "WardCode" TEXT;
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "Sequence" INT;

-- 2. Unique backstop index (defense-in-depth alongside the atomic counter)
CREATE UNIQUE INDEX IF NOT EXISTS uq_estimateheader_seq
  ON "EstimateHeader" ("FinancialYear", "WardCode", "Sequence");

-- 3. Atomic per-(FinancialYear, WardCode) counter. Never decremented.
CREATE TABLE IF NOT EXISTS "EstimateSequence" (
  "FinancialYear" TEXT NOT NULL,
  "WardCode" TEXT NOT NULL,
  "LastSequence" INT NOT NULL DEFAULT 0,
  PRIMARY KEY ("FinancialYear", "WardCode")
);

-- 4. Backfill existing estimates from the legacy EST/<fy>/<ward>/<seq> format.
--    WardCode is re-derived from the Location Master (Ward name prefix) so it is
--    consistent with the new scheme, not the legacy WardID padding.
UPDATE "EstimateHeader" eh
SET "WardCode" = lpad(COALESCE((regexp_match(w."Name", '^[0-9]+'))[1], x."WardID"::text), 3, '0'),
    "Sequence" = x.parts[3]::int
FROM (
  SELECT eh2."EstimateID", eh2."WardID",
         regexp_matches(eh2."EstimateNo", '^EST/([0-9]{4}-[0-9]{2})/([0-9]{3})/([0-9]{4})$') AS parts
  FROM "EstimateHeader" eh2
) x
LEFT JOIN "Wards" w ON w."WardID" = x."WardID"
WHERE x."EstimateID" = eh."EstimateID";

-- 5. Seed counters from existing data so new estimates continue the sequence
INSERT INTO "EstimateSequence" ("FinancialYear", "WardCode", "LastSequence")
SELECT "FinancialYear", "WardCode", MAX("Sequence")
FROM "EstimateHeader"
WHERE "WardCode" IS NOT NULL AND "Sequence" IS NOT NULL
GROUP BY "FinancialYear", "WardCode"
ON CONFLICT ("FinancialYear", "WardCode")
  DO UPDATE SET "LastSequence" = GREATEST("EstimateSequence"."LastSequence", EXCLUDED."LastSequence");
