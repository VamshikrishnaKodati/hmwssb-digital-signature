-- Multiple LS Provision entries per estimate.
-- EstimateHeader.LSProvision remains the summed total used by the official
-- General Abstract output; individual entries live here.

CREATE TABLE IF NOT EXISTS "EstimateLSProvision" (
  "ID" SERIAL PRIMARY KEY,
  "EstimateID" INTEGER NOT NULL REFERENCES "EstimateHeader"("EstimateID") ON DELETE CASCADE,
  "Description" TEXT NOT NULL,
  "Amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "SortOrder" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_estimatelsprovision_estimateid"
  ON "EstimateLSProvision" ("EstimateID");
