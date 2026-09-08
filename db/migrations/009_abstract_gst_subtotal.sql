-- General Abstract per official HMWSSB reference workbook:
--   subtotal   = CostOfEstimate (Civil + Material) + GST   [Part-I + Part-II]
--   GST        = CostOfEstimate * GSTPercent / 100          [Part-II, LS NOT included]
--   grandTotal = subtotal + LSProvision                     [Part-I + II + III]
-- LS Provision is manual entry shown separately under Part-III and is NOT
-- part of the GST base.

ALTER TABLE "Abstract" ADD COLUMN IF NOT EXISTS "Subtotal" NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Abstract" ADD COLUMN IF NOT EXISTS "GSTPercent" NUMERIC(5,2) NOT NULL DEFAULT 18;

-- Recompute existing abstract rows with the corrected logic.
UPDATE "Abstract" ab
SET "GSTPercent" = COALESCE(eh."GSTPercent", 18),
    "GST"        = ROUND(ab."CostOfEstimate" * COALESCE(eh."GSTPercent", 18) / 100, 2),
    "Subtotal"   = ab."CostOfEstimate"
                   + ROUND(ab."CostOfEstimate" * COALESCE(eh."GSTPercent", 18) / 100, 2),
    "GrandTotal" = ab."CostOfEstimate"
                   + ROUND(ab."CostOfEstimate" * COALESCE(eh."GSTPercent", 18) / 100, 2)
                   + ab."LSProvision"
FROM "EstimateHeader" eh
WHERE eh."EstimateID" = ab."EstimateID";
