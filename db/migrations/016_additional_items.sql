-- PART-II Additional Items entries per estimate (mirrors LS Provisions).
-- EstimateHeader keeps no summed column: the Abstract stores the total that the
-- official General Abstract output prints as the single "Additional Items" line.

CREATE TABLE IF NOT EXISTS "EstimateAdditionalItem" (
  "ID" SERIAL PRIMARY KEY,
  "EstimateID" INTEGER NOT NULL REFERENCES "EstimateHeader"("EstimateID") ON DELETE CASCADE,
  "Description" TEXT NOT NULL,
  "Amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "SortOrder" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_estimateadditionalitem_estimateid"
  ON "EstimateAdditionalItem" ("EstimateID");

-- General Abstract Part-II total:
--   GrandTotal = CostOfEstimate + GST + AdditionalItemsTotal + LSProvision
ALTER TABLE "Abstract" ADD COLUMN IF NOT EXISTS "AdditionalItemsTotal" NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Backfill: existing abstracts keep their GrandTotal (no additional items yet),
-- so only the new column default applies.
