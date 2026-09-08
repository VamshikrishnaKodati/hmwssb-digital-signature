-- ============================================================================
-- Migration 041: Tender pipeline hardening — evaluation, L1, award,
-- work order, agreement. Also relocks bid opening to the TenderOfficer
-- (canonical ownership, Option 1).
--
-- CANONICAL OWNERSHIP (supersedes migration 038's bid-opening assignment)
--   TenderOfficer            → preparation, publication, bid submission
--                              monitoring, closing, BID OPENING
--   Evaluation authority     → technical evaluation, financial evaluation, L1
--                              (currently the configured TenderOfficer role via
--                              tender.evaluate)
--   DirectorOfAdministration → award, work order, agreement
--
-- PIPELINE (Tender.Status progression)
--   TenderDraft → Published → BidSubmissionOpen → BidsClosed
--   → BidOpeningInProgress → TechnicalEvaluationPending
--   → UnderTechnicalEvaluation → FinancialEvaluationPending
--   → FinancialEvaluation → L1Identified → WorkAwarded
--   → WorkOrderIssued → AgreementExecuted
-- ============================================================================

BEGIN;

-- ── 1. RBAC: bid opening → TenderOfficer (Option 1) ──────────────────────────
-- TenderOfficer gains bid.open (bid.view already granted). DirectorOfAdministration
-- keeps bid.view (read-only bid records for award) but loses bid.open.
INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r, "Permission" p
WHERE r."RoleName" = 'TenderOfficer' AND p."PermissionKey" = 'bid.open'
ON CONFLICT DO NOTHING;

DELETE FROM "RolePermission" rp
USING "Role" r, "Permission" p
WHERE rp."RoleID" = r."RoleID"
  AND rp."PermissionID" = p."PermissionID"
  AND r."RoleName" = 'DirectorOfAdministration'
  AND p."PermissionKey" = 'bid.open';

-- ── 2. Bid: structured evaluation result + reasons ───────────────────────────
-- TechnicalStatus vocabulary extended with Qualified/Disqualified (historic
-- Eligible/Rejected rows are preserved). Evaluation actor/timestamp recorded
-- per evaluation stage so results are auditable end-to-end.
ALTER TABLE "Bid" DROP CONSTRAINT IF EXISTS "Bid_TechnicalStatus_check";
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_TechnicalStatus_check"
  CHECK ("TechnicalStatus" IN ('Pending','Eligible','Rejected','Qualified','Disqualified'));

ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "TechnicalEvaluatedBy" INT REFERENCES "Users"("UserID");
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "TechnicalEvaluatedAt" TIMESTAMPTZ;
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "FinancialRemarks" TEXT;
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "FinancialEvaluatedBy" INT REFERENCES "Users"("UserID");
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "FinancialEvaluatedAt" TIMESTAMPTZ;

-- ── 3. TenderEvaluation: persisted L1 / ranking result (one per tender) ───────
-- Ranking is stored server-side as a JSON snapshot; SelectedBidID is the L1.
-- Methodology records how L1 was derived (current supported methodology only).
CREATE TABLE IF NOT EXISTS "TenderEvaluation" (
  "TenderEvaluationID" SERIAL PRIMARY KEY,
  "TenderID"           INT NOT NULL REFERENCES "Tender"("TenderID") ON DELETE CASCADE UNIQUE,
  "Methodology"        TEXT NOT NULL,
  "Ranking"            JSONB NOT NULL,
  "SelectedBidID"      INT REFERENCES "Bid"("BidID"),
  "IdentifiedAt"       TIMESTAMPTZ DEFAULT now(),
  "IdentifiedBy"       INT REFERENCES "Users"("UserID")
);

-- ── 4. Tender: action metadata for evaluation / award / WO / agreement ────────
-- Same server-set action-column pattern as migration 037 (bid-opening metadata):
-- every workflow action stamps who + when on the tender row.
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "TechnicalEvaluationStartedAt" TIMESTAMPTZ;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "TechnicalEvaluationStartedBy" INT REFERENCES "Users"("UserID");
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "FinancialEvaluationAt" TIMESTAMPTZ;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "FinancialEvaluationBy" INT REFERENCES "Users"("UserID");
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "AwardedAt" TIMESTAMPTZ;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "AwardedBy" INT REFERENCES "Users"("UserID");
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "WorkOrderIssuedAt" TIMESTAMPTZ;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "WorkOrderIssuedBy" INT REFERENCES "Users"("UserID");
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "WorkOrderNo" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "AgreementExecutedAt" TIMESTAMPTZ;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "AgreementExecutedBy" INT REFERENCES "Users"("UserID");
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "AgreementNo" TEXT;

COMMIT;