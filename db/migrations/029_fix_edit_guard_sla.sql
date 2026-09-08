CREATE OR REPLACE FUNCTION fn_block_in_place_edit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."Status" IS NOT DISTINCT FROM OLD."Status"
     AND OLD."Status" NOT IN ('Draft', 'Reverted') THEN
    -- Allow SLA/escalation metadata updates (no user-editable data changes)
    IF NEW."SlaStartedAt" IS DISTINCT FROM OLD."SlaStartedAt"
       OR NEW."SlaDueAt" IS DISTINCT FROM OLD."SlaDueAt"
       OR NEW."SlaStatus" IS DISTINCT FROM OLD."SlaStatus"
       OR NEW."EscalationLevel" IS DISTINCT FROM OLD."EscalationLevel"
       OR NEW."LastEscalatedAt" IS DISTINCT FROM OLD."LastEscalatedAt" THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only Draft or Reverted estimates can be edited (current status: %)', OLD."Status"
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
