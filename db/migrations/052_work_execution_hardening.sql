-- HMWSSB - v52: work-execution chain hardening.
--
-- Duplicate protection + idempotency for the estimate-side execution flow
-- (startWork -> progress/measurement -> completeWork):
--   * startWork stamps Agency.StartDate and starts the execution SLA.
--   * completeWork is atomic via a status-guarded UPDATE (409 on replay),
--     persists CompletedDate/CompletedBy, stamps Agency.CompletionDate and
--     resolves the execution SLA.
--   * createProgress / createMeasurement reject duplicate records: an exact
--     re-submission returns the existing row instead of inserting a second.

-- 1. Progress entries: (estimate, stage, percentage, day) is the natural key.
--    Clean any pre-existing duplicates before the unique index lands.
DELETE FROM "WorkProgress" a
USING "WorkProgress" b
WHERE a."ProgressID" > b."ProgressID"
  AND a."EstimateID" = b."EstimateID"
  AND a."Stage" IS NOT DISTINCT FROM b."Stage"
  AND a."Percentage" = b."Percentage"
  AND a."Date" IS NOT DISTINCT FROM b."Date";

CREATE UNIQUE INDEX IF NOT EXISTS uq_workprogress_duplicate
  ON "WorkProgress" ("EstimateID","Stage","Percentage","Date");

-- 2. Measurement records: (estimate, detail, date, previous, current) is the
--    natural key for a single measurement submission.
DELETE FROM "MeasurementBook" a
USING "MeasurementBook" b
WHERE a."MeasurementID" > b."MeasurementID"
  AND a."EstimateID" = b."EstimateID"
  AND a."DetailID" IS NOT DISTINCT FROM b."DetailID"
  AND a."MeasuredDate" = b."MeasuredDate"
  AND a."PreviousQty" = b."PreviousQty"
  AND a."CurrentQty" = b."CurrentQty";

CREATE UNIQUE INDEX IF NOT EXISTS uq_measurementbook_duplicate
  ON "MeasurementBook" ("EstimateID","DetailID","MeasuredDate","PreviousQty","CurrentQty");

-- 3. Execution-stage SLA: started on startWork (Estimate/WorkStarted), resolved
--    on completeWork. Config-only — reuses the existing estimate SLA columns.
INSERT INTO "SlaDefinition" ("Module","Stage","DurationMinutes","WarningMinutes","EscalationEnabled","Active")
VALUES ('Estimate', 'WorkStarted', 43200, 1440, TRUE, TRUE)
ON CONFLICT ("Module","Stage") DO NOTHING;