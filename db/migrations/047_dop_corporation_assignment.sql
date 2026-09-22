-- HMWSSB v47: DOP corporation assignments.
-- DOP is corporation-scoped. Its corporation assignment is DATA (stored in a
-- dedicated assignment record), not hardcoded role logic. The table mirrors
-- the Manager/DGM/GM/CGM assignment tables from migration 044 so the same
-- assignment + audit lifecycle applies. DOP approval/routing behaviour is
-- unchanged (DOP stays board-wide for estimate scope in the service layer).

CREATE TABLE IF NOT EXISTS "DOPCorporationAssignment" (
    "AssignmentID" SERIAL PRIMARY KEY,
    "UserID" INTEGER NOT NULL REFERENCES "Users"("UserID") ON DELETE CASCADE,
    "RegionID" INTEGER NOT NULL REFERENCES "Regions"("RegionID") ON DELETE CASCADE,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "AssignedBy" INTEGER REFERENCES "Users"("UserID"),
    "AssignedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "DeactivatedAt" TIMESTAMPTZ,
    "Notes" TEXT
);
CREATE INDEX IF NOT EXISTS "ix_dopca_active_region" ON "DOPCorporationAssignment" ("RegionID") WHERE "IsActive" = TRUE;
CREATE INDEX IF NOT EXISTS "ix_dopca_user" ON "DOPCorporationAssignment" ("UserID");

-- Backfill from the existing per-DOP configuration already stored on the user
-- (Users.RegionID). Idempotent: only real DOP users, only their active config,
-- never inventing users or corporations.
INSERT INTO "DOPCorporationAssignment" ("UserID", "RegionID", "IsActive", "AssignedBy", "Notes")
SELECT u."UserID", u."RegionID", TRUE, NULL, 'Backfilled from existing DOP configuration'
FROM "Users" u
WHERE u."Designation" = 'DOP'
  AND u."RegionID" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM "DOPCorporationAssignment" a
      WHERE a."UserID" = u."UserID" AND a."RegionID" = u."RegionID" AND a."IsActive" = TRUE
  );