-- Work Details simplification:
--  * Remove the free-form WorkType column entirely.
--  * Add a Description column for the estimate's large description field.
--  * Constrain WorkCategory to the fixed dropdown values (Water Supply / Sewerage / EAM).
--    Legacy rows are normalised first so the constraint can be added.

ALTER TABLE "EstimateHeader" DROP COLUMN IF EXISTS "WorkType";

ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "Description" TEXT;

-- Normalise legacy values (e.g. 'water supply', 'Pipeline', NULL) into the fixed set.
UPDATE "EstimateHeader"
SET "WorkCategory" = 'Water Supply'
WHERE "WorkCategory" IS NULL
   OR "WorkCategory" NOT IN ('Water Supply', 'Sewerage', 'EAM');

ALTER TABLE "EstimateHeader" DROP CONSTRAINT IF EXISTS "chk_estimate_work_category";
ALTER TABLE "EstimateHeader"
  ADD CONSTRAINT "chk_estimate_work_category"
  CHECK ("WorkCategory" IS NULL OR "WorkCategory" IN ('Water Supply', 'Sewerage', 'EAM'));
