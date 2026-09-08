-- 038: Remove ProcurementOfficer from the RBAC model.
-- ProcurementOfficer's duties are redistributed (frozen role model):
--   Agency create/select + work order/agreement + bid opening -> DirectorOfAdministration
--   Tech/fin evaluation + L1 (bid evaluation) -> TenderOfficer
-- Then the ProcurementOfficer Role row is deleted.

BEGIN;

-- 1. Drop ProcurementOfficer's own role-permission grants (they move below).
DELETE FROM "RolePermission" rp
USING "Role" r
WHERE rp."RoleID" = r."RoleID" AND r."RoleName" = 'ProcurementOfficer';

-- 2. Agency + award + work order + agreement + bid opening -> DirectorOfAdministration.
INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'DirectorOfAdministration'
  AND p."PermissionKey" IN ('agency.view','agency.create','agency.select',
                            'tender.award','tender.workOrder','tender.agreement',
                            'bid.view','bid.open')
ON CONFLICT DO NOTHING;

-- 3. Bid evaluation + L1 -> TenderOfficer.
INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'TenderOfficer'
  AND p."PermissionKey" IN ('tender.evaluate')
ON CONFLICT DO NOTHING;

-- 4. Delete the now-orphaned ProcurementOfficer role.
DELETE FROM "Role" WHERE "RoleName" = 'ProcurementOfficer';

-- 5. The lone ProcurementOfficer user has no remaining duties; leave the row
--    (history integrity) but deactivate it so it can no longer log in or be
--    selected in the UI.
UPDATE "Users" SET "IsActive" = FALSE, "Designation" = 'DirectorOfAdministration'
WHERE "Username" = 'procurement_officer';

-- 6. Rebuild the Tender escalation target that referenced ProcurementOfficer.
--    BidSubmission escalates to the bid-opening authority (DirectorOfAdministration);
--    BidOpening stays escalated to MD.
DELETE FROM "EscalationRule"
WHERE "Module" = 'Tender' AND "Stage" = 'BidSubmission';
INSERT INTO "EscalationRule" ("Module","Stage","AfterMinutes","EscalateToRole")
VALUES ('Tender','BidSubmission', 1440, 'DirectorOfAdministration')
ON CONFLICT DO NOTHING;

COMMIT;
