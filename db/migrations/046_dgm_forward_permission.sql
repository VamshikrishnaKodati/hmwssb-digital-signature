-- Grant the forward/submit permission to every approval-pipeline role.
-- A role that creates an estimate stands in for the Manager at the front of the
-- approval ladder; the maker-checker rule in submitEstimate resolves the actual
-- next authority (e.g. DGM-creator -> GM) from the current owner. These roles
-- therefore need the forward (estimate.submit) permission to hand their own
-- Draft over. MD is terminal (no forward target) and is intentionally omitted.
INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" IN ('DGM','GM','CGM','DOP','ED')
  AND p."PermissionKey" = 'estimate.submit'
ON CONFLICT DO NOTHING;