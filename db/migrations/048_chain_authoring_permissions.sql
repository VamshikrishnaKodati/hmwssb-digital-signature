-- GM/CGM/DOP/ED are chain authoring roles: each must be able to create an
-- estimate (estimate.create) and correct its own Draft/Reverted copy
-- (estimate.edit), matching the Manager/DGM authoring set. The API gates are
-- unchanged: requirePermission('estimate.create') and
-- requirePermission('estimate.edit') + editableBy (scope + status).
INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" IN ('GM', 'CGM', 'DOP', 'ED')
  AND p."PermissionKey" IN ('estimate.create', 'estimate.edit')
ON CONFLICT DO NOTHING;