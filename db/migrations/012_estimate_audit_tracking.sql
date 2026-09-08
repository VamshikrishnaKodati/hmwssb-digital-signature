-- HMWSSB - v12: Track last-modified metadata on estimates and record an
-- immutable audit log alongside the existing Workflow movement history.

ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "LastModifiedBy" INT REFERENCES "Users";
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "LastModifiedDate" TIMESTAMP;

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "AuditID" SERIAL PRIMARY KEY,
  "EstimateID" INT REFERENCES "EstimateHeader",
  "UserID" INT REFERENCES "Users",
  "Action" TEXT NOT NULL,
  "Remarks" TEXT,
  "CreatedDate" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditlog_estimateid ON "AuditLog"("EstimateID");
