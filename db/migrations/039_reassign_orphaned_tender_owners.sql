-- ============================================================================
-- Migration 039: Reassign in-flight TenderPublished estimates from the removed
-- ProcurementOfficer to DirectorOfAdministration (the current actionable owner).
--
-- ROOT CAUSE
--   Migration 038 removed the ProcurementOfficer role from the RBAC model and
--   deactivated its lone user (UserID = procurement_officer), but did NOT
--   re-point EstimateHeader.CurrentOwner for the four TenderPublished estimates
--   that were still assigned to that user. Those four records were orphaned:
--   no active role could act on them.
--
-- CANONICAL ROUTING
--   workflowController.publishTender() sets EstimateHeader.CurrentOwner to the
--   active DirectorOfAdministration when a tender is published, and the
--   agency-selection action (selectAgency) belongs to DirectorOfAdministration.
--   Therefore every estimate whose status is TenderPublished must currently be
--   owned by DirectorOfAdministration — not by the removed ProcurementOfficer.
--
-- SCOPE (deliberately narrow)
--   Updates ONLY EstimateHeader.CurrentOwner on the four affected rows.
--   No historical audit/workflow/tender records are created, edited or deleted.
--   Guards: source must be the deactivated ProcurementOfficer user, status must
--   still be TenderPublished, and exactly the four known EstimateIDs match.
--
-- AUDIT
--   Applied via db/migrate.mjs (tracked in the _migrations table). Before/after
--   and reasoning are documented in docs/PHASE2_DATA_FLOW_AUDIT.md.
--   Before: ProcurementOfficer. After: DirectorOfAdministration.
--   Reason: ProcurementOfficer permanently removed from the active role model.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_director INT;
  v_po       INT;
  v_rows     INT;
BEGIN
  SELECT "UserID" INTO v_director
    FROM "Users" WHERE "Designation" = 'DirectorOfAdministration' AND "IsActive" = TRUE
    ORDER BY "UserID" LIMIT 1;
  SELECT "UserID" INTO v_po FROM "Users" WHERE "Username" = 'procurement_officer';

  IF v_director IS NULL THEN RAISE EXCEPTION 'No active DirectorOfAdministration found; aborting'; END IF;
  IF v_po IS NULL THEN RAISE EXCEPTION 'ProcurementOfficer user not found; aborting'; END IF;

  -- The edit-guard trigger (trg_block_in_place_edit) permits only status/SLA
  -- changes once an estimate leaves Draft/Reverted. This migration changes only
  -- the actionable owner, so the guard is suspended for the single UPDATE and
  -- re-enabled immediately after — both within this transaction (DDL is
  -- transactional in PostgreSQL; a rollback restores the trigger too).
  ALTER TABLE "EstimateHeader" DISABLE TRIGGER trg_block_in_place_edit;

  UPDATE "EstimateHeader"
     SET "CurrentOwner" = v_director
   WHERE "CurrentOwner" = v_po
     AND "Status" = 'TenderPublished'
     AND "EstimateID" IN (1246, 1420, 1496, 1506);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 4 THEN
    RAISE WARNING 'Expected exactly 4 rows to change, updated % instead; verify state before relying on this migration', v_rows;
  END IF;

  ALTER TABLE "EstimateHeader" ENABLE TRIGGER trg_block_in_place_edit;

  RAISE NOTICE 'Reassigned % TenderPublished estimate(s) from ProcurementOfficer (UserID %) to DirectorOfAdministration (UserID %). Why: ProcurementOfficer permanently removed from the active role model; TenderPublished ownership is DirectorOfAdministration (agency selection).', v_rows, v_po, v_director;
END $$;

COMMIT;