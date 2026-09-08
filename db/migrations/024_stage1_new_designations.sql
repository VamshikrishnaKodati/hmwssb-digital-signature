-- HMWSSB - v24: Add CGM, DOP, ED, MD designations for Stage 1

ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "Users_Designation_check";
ALTER TABLE "Users" ADD CONSTRAINT "Users_Designation_check"
  CHECK ("Designation" IN (
    'SoRAdmin','Manager','DGM','GM','CGM',
    'TenderOfficer','ProcurementOfficer','SiteEngineer','BillingOfficer',
    'Administrator','DOP','ED','MD'
  ));
