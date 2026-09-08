-- 023_deleted_estimates.sql
-- Deleted Estimates archive table + restore support

CREATE TABLE IF NOT EXISTS "DeletedEstimates" (
  "DeletedEstimateID"   SERIAL PRIMARY KEY,
  "OriginalEstimateID"  INT NOT NULL,
  "EstimateNumber"      TEXT,
  "WorkName"            TEXT,
  "WorkCategory"        TEXT,
  "DeletedBy"           INT REFERENCES "Users"("UserID"),
  "DeletedByRole"       TEXT,
  "DeletedAt"           TIMESTAMP NOT NULL DEFAULT now(),
  "DeleteReason"        TEXT,
  "StatusAtDeletion"    TEXT,
  "VersionAtDeletion"   INT,
  "GrandTotalAtDeletion" NUMERIC(15,2),
  "CreatedBy"           INT,
  "CreatedDate"         TIMESTAMP,
  "SnapshotData"        JSONB NOT NULL DEFAULT '{}',
  "RestoreStatus"       TEXT NOT NULL DEFAULT 'deleted',
  "RestoredBy"          INT REFERENCES "Users"("UserID"),
  "RestoredAt"          TIMESTAMP,
  "RestoreReason"       TEXT
);

CREATE INDEX IF NOT EXISTS "idx_deleted_estimates_original" ON "DeletedEstimates"("OriginalEstimateID");
CREATE INDEX IF NOT EXISTS "idx_deleted_estimates_deletedby" ON "DeletedEstimates"("DeletedBy");
CREATE INDEX IF NOT EXISTS "idx_deleted_estimates_restore" ON "DeletedEstimates"("RestoreStatus");
