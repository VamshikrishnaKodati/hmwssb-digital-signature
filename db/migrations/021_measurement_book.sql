-- HMWSSB - v21: Measurement Book (MB) module.
--
-- Tracks measured quantities of work against estimate items with running
-- cumulative and balance. Recorded by the Site Engineer, verified by the
-- Billing Officer. Fills the measurement module gap (previously SKIP in e2e).

CREATE TABLE IF NOT EXISTS "MeasurementBook" (
  "MeasurementID" SERIAL PRIMARY KEY,
  "EstimateID" INT NOT NULL REFERENCES "EstimateHeader",
  "DetailID" INT REFERENCES "EstimateDetails",
  "ItemCode" TEXT,
  "Description" TEXT,
  "Unit" TEXT,
  "PreviousQty" NUMERIC(14,3) NOT NULL DEFAULT 0,
  "CurrentQty" NUMERIC(14,3) NOT NULL,
  "CumulativeQty" NUMERIC(14,3) NOT NULL DEFAULT 0,
  "BalanceQty" NUMERIC(14,3),
  "MeasuredDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "MeasuredBy" INT NOT NULL REFERENCES "Users",
  "VerifiedBy" INT REFERENCES "Users",
  "VerifiedDate" TIMESTAMP,
  "Status" TEXT NOT NULL DEFAULT 'Draft' CHECK ("Status" IN ('Draft','Verified')),
  "Remarks" TEXT
);

CREATE INDEX IF NOT EXISTS idx_measurementbook_estimate ON "MeasurementBook"("EstimateID");
