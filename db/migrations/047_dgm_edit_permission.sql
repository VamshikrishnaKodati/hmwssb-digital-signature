-- DGM is an authoring role (holds estimate.create) but could not correct its
-- own Draft, because estimate.edit was granted only to the Manager. Grant it so
-- the Edit Estimate action appears for a DGM-created estimate whenever it is
-- in scope and still editable (Draft/Reverted). The API gate is unchanged:
-- requirePermission('estimate.edit') + editableBy (scope + status).
INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'DGM'
  AND p."PermissionKey" = 'estimate.edit'
ON CONFLICT DO NOTHING;