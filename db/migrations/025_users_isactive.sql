-- HMWSSB - v25: Add "IsActive" to Users.
-- The live schema was initialized from an older 001_schema.sql without this
-- column, while the application code (dashboard/item controllers) references
-- it. Idempotent for databases that already have it.

ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "IsActive" BOOLEAN NOT NULL DEFAULT TRUE;
