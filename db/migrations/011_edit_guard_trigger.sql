-- HMWSSB - v11: DB-level guard preventing edits to non-editable estimates.
-- Only Draft and Reverted estimates can be edited in place. Workflow transitions
-- (submit/revert/approve/sign/tender...) always change "Status", so they are not
-- affected by this trigger. An "edit" is the only EstimateHeader UPDATE that
-- leaves "Status" unchanged.

CREATE OR REPLACE FUNCTION fn_block_in_place_edit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."Status" IS NOT DISTINCT FROM OLD."Status"
     AND OLD."Status" NOT IN ('Draft', 'Reverted') THEN
    RAISE EXCEPTION 'Only Draft or Reverted estimates can be edited (current status: %)', OLD."Status"
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_in_place_edit ON "EstimateHeader";
CREATE TRIGGER trg_block_in_place_edit
  BEFORE UPDATE ON "EstimateHeader"
  FOR EACH ROW
  EXECUTE FUNCTION fn_block_in_place_edit();
