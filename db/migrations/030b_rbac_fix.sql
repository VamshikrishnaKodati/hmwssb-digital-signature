-- Fix RBAC inserts for migration 030 (PowerShell escaped double-quotes)

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'FinanceHead' AND p."PermissionKey" IN ('estimate.generateFCN', 'estimate.verifyFCN')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'DirectorOfAdministration' AND p."PermissionKey" IN ('estimate.generateSanction', 'estimate.verifySanction')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'GM' AND p."PermissionKey" = 'estimate.reviewForward'
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'DGM' AND p."PermissionKey" = 'estimate.reviewForward'
ON CONFLICT DO NOTHING;

INSERT INTO "Role" ("RoleName", "Description", "IsActive")
VALUES ('DirectorOfAdministration', 'Director of Administration - generates and verifies administrative sanctions', TRUE)
ON CONFLICT DO NOTHING;
