-- HMWSSB - v22: capture who archived/completed an estimate (completion trail).
ALTER TABLE "EstimateHeader" ADD COLUMN IF NOT EXISTS "CompletedBy" INT REFERENCES "Users"("UserID");
