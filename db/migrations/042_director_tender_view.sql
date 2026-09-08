-- ============================================================================
-- Migration 042: DirectorOfAdministration gains tender.view
--
-- The Director's award pipeline (L1Identified/WorkAwarded/WorkOrderIssued/
-- AgreementExecuted) links to the tender list + detail pages (GET /api/tender,
-- GET /api/tender/:id), both guarded by requirePermission('tender.view'). The
-- role already holds tender.award/workOrder/agreement but could not open the
-- tender records it is expected to act on. Grant it view access (no write
-- beyond the award actions it already owns).
-- ============================================================================

BEGIN;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'DirectorOfAdministration' AND p."PermissionKey" = 'tender.view'
ON CONFLICT DO NOTHING;

COMMIT;