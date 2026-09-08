-- Track when and by whom work was started on an estimate.
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "StartedDate" TIMESTAMP;
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "StartedBy" INT REFERENCES "Users"("UserID");
