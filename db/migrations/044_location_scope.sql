ALTER TABLE "Users"
    ADD COLUMN "DesignationTitle" VARCHAR(120),
    ADD COLUMN "EmployeeCode" VARCHAR(50) UNIQUE,
    ADD COLUMN "EffectiveFrom" TIMESTAMPTZ,
    ADD COLUMN "EffectiveTo" TIMESTAMPTZ;

-- One active assignment per scope node is enforced in the service layer
-- (assignUserScope returns 409 on conflict). The index is intentionally
-- non-unique because the dev seed co-hosts the mapped officer and the legacy
-- demo persona on nodes 1 while keeping a single primary (AssignedAt DESC).
CREATE TABLE "ManagerCircleAssignment" (
    "AssignmentID" SERIAL PRIMARY KEY,
    "UserID" INTEGER NOT NULL REFERENCES "Users"("UserID") ON DELETE CASCADE,
    "CircleID" INTEGER NOT NULL REFERENCES "Circles"("CircleID") ON DELETE CASCADE,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "AssignedBy" INTEGER REFERENCES "Users"("UserID"),
    "AssignedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "DeactivatedAt" TIMESTAMPTZ,
    "Notes" TEXT
);
CREATE INDEX "ix_mca_active_circle" ON "ManagerCircleAssignment" ("CircleID") WHERE "IsActive" = TRUE;
CREATE INDEX "ix_mca_user" ON "ManagerCircleAssignment" ("UserID");

CREATE TABLE "DGMDivisionAssignment" (
    "AssignmentID" SERIAL PRIMARY KEY,
    "UserID" INTEGER NOT NULL REFERENCES "Users"("UserID") ON DELETE CASCADE,
    "DivisionID" INTEGER NOT NULL REFERENCES "Divisions"("DivisionID") ON DELETE CASCADE,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "AssignedBy" INTEGER REFERENCES "Users"("UserID"),
    "AssignedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "DeactivatedAt" TIMESTAMPTZ,
    "Notes" TEXT
);
CREATE INDEX "ix_dgda_active_division" ON "DGMDivisionAssignment" ("DivisionID") WHERE "IsActive" = TRUE;
CREATE INDEX "ix_dgda_user" ON "DGMDivisionAssignment" ("UserID");

CREATE TABLE "GMZoneAssignment" (
    "AssignmentID" SERIAL PRIMARY KEY,
    "UserID" INTEGER NOT NULL REFERENCES "Users"("UserID") ON DELETE CASCADE,
    "ZoneID" INTEGER NOT NULL REFERENCES "Zones"("ZoneID") ON DELETE CASCADE,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "AssignedBy" INTEGER REFERENCES "Users"("UserID"),
    "AssignedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "DeactivatedAt" TIMESTAMPTZ,
    "Notes" TEXT
);
CREATE INDEX "ix_gmza_active_zone" ON "GMZoneAssignment" ("ZoneID") WHERE "IsActive" = TRUE;
CREATE INDEX "ix_gmza_user" ON "GMZoneAssignment" ("UserID");

CREATE TABLE "CGMCorporationAssignment" (
    "AssignmentID" SERIAL PRIMARY KEY,
    "UserID" INTEGER NOT NULL REFERENCES "Users"("UserID") ON DELETE CASCADE,
    "RegionID" INTEGER NOT NULL REFERENCES "Regions"("RegionID") ON DELETE CASCADE,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "AssignedBy" INTEGER REFERENCES "Users"("UserID"),
    "AssignedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "DeactivatedAt" TIMESTAMPTZ,
    "Notes" TEXT
);
CREATE INDEX "ix_cgmca_active_region" ON "CGMCorporationAssignment" ("RegionID") WHERE "IsActive" = TRUE;
CREATE INDEX "ix_cgmca_user" ON "CGMCorporationAssignment" ("UserID");

CREATE TABLE "AssignmentAudit" (
    "AuditID" SERIAL PRIMARY KEY,
    "UserID" INTEGER NOT NULL REFERENCES "Users"("UserID") ON DELETE CASCADE,
    "Role" VARCHAR(50) NOT NULL,
    "Action" VARCHAR(20) NOT NULL CHECK ("Action" IN ('Create', 'Update', 'Deactivate')),
    "OldScope" JSONB,
    "NewScope" JSONB,
    "ChangedBy" INTEGER REFERENCES "Users"("UserID"),
    "ChangedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "Notes" TEXT
);
CREATE INDEX "ix_assignment_audit_user" ON "AssignmentAudit" ("UserID", "ChangedAt" DESC);