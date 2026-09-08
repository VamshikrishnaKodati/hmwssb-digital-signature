-- Migration 037: T3 Procurement Phase — Bid submission window (server time),
-- bid opening, segregated bid documents, tender RBAC + SLA.
-- Tender-table-driven pipeline:
--   TenderDraft → Published → BidSubmissionOpen → BidsClosed → BidOpeningInProgress → TechnicalEvaluationPending
-- Evaluation / L1 / award / work order are LATER phases (not in this migration).

-- ── 1. Tender: submission-window & bid-opening transition metadata (server-set) ──
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "BidSubmissionOpenedAt" TIMESTAMPTZ;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "BidsClosedAt" TIMESTAMPTZ;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "BidsClosedBy" INT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "BidOpeningStartedAt" TIMESTAMPTZ;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "BidOpeningStartedBy" INT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "BidOpeningCompletedAt" TIMESTAMPTZ;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "BidOpeningCompletedBy" INT;

-- Tender carries the standard SLA tracking columns (same contract as
-- EstimateHeader / FinanceWorkflow) so the shared sla.js drives it.
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "SlaStartedAt" TIMESTAMPTZ;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "SlaDueAt" TIMESTAMPTZ;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "SlaStatus" TEXT DEFAULT 'Normal';
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "EscalationLevel" INT DEFAULT 0;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "LastEscalatedAt" TIMESTAMPTZ;

-- ── 2. Bid: server-authoritative submission metadata + per-bid opening ─────────
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "SubmissionReference" TEXT;
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "SubmittedAt" TIMESTAMPTZ DEFAULT now();
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "SubmittedBy" INT REFERENCES "Users"("UserID");
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "OpeningStatus" TEXT NOT NULL DEFAULT 'Pending'
  CHECK ("OpeningStatus" IN ('Pending','Opened'));
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "OpenedAt" TIMESTAMPTZ;
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "OpenedBy" INT REFERENCES "Users"("UserID");
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "Declarations" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bid_submission_ref ON "Bid"("SubmissionReference");
-- One submission per bidder per tender (spec default rule; enforced at the DB).
CREATE UNIQUE INDEX IF NOT EXISTS uq_bid_tender_contractor ON "Bid"("TenderID","ContractorID");

-- ── 3. Segregated bid documents (Technical / Financial / EMD / Declaration) ────
CREATE TABLE IF NOT EXISTS "BidDocument" (
  "BidDocumentID" SERIAL PRIMARY KEY,
  "BidID" INT NOT NULL REFERENCES "Bid"("BidID") ON DELETE CASCADE,
  "Category" TEXT NOT NULL CHECK ("Category" IN ('Technical','Financial','EMD','Declaration')),
  "DocumentName" TEXT NOT NULL,
  "FilePath" TEXT,
  "UploadedBy" INT REFERENCES "Users"("UserID"),
  "UploadedAt" TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_biddoc_bid ON "BidDocument"("BidID");

-- ── 4. Bid opening record (one per tender) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BidOpening" (
  "BidOpeningID" SERIAL PRIMARY KEY,
  "TenderID" INT NOT NULL REFERENCES "Tender"("TenderID") ON DELETE CASCADE UNIQUE,
  "OpenedBy" INT REFERENCES "Users"("UserID"),
  "StartedAt" TIMESTAMPTZ DEFAULT now(),
  "Status" TEXT NOT NULL DEFAULT 'InProgress' CHECK ("Status" IN ('InProgress','Completed')),
  "CompletedAt" TIMESTAMPTZ,
  "CompletedBy" INT REFERENCES "Users"("UserID"),
  "Remarks" TEXT
);

-- Submission reference sequence (server-generated acknowledgement numbers)
CREATE SEQUENCE IF NOT EXISTS bid_submission_ref_seq;

-- ── 5. RBAC: bid submission / viewing / opening ────────────────────────────────
INSERT INTO "Permission" ("PermissionKey","Description","Module") VALUES
  ('bid.submit',   'Submit a bid for a tender', 'Tender'),
  ('bid.view',     'View bid records', 'Tender'),
  ('bid.open',     'Open bids at bid opening', 'Tender'),
  ('bid.financial.view', 'View financial bid content (default: no one)', 'Tender')
ON CONFLICT ("PermissionKey") DO NOTHING;

INSERT INTO "RolePermission" ("RoleID","PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r
JOIN "Permission" p ON (
  (r."RoleName" = 'TenderOfficer' AND p."PermissionKey" IN ('bid.submit','bid.view'))
  OR (r."RoleName" = 'ProcurementOfficer' AND p."PermissionKey" IN ('bid.view','bid.open'))
)
ON CONFLICT DO NOTHING;
-- NOTE: bid.financial.view is deliberately granted to NO role by default.
-- Financial content is revealed only when the financial-evaluation phase ships.

-- ── 6. Tender SLA definitions + escalation rules ───────────────────────────────
-- Placeholder durations; admin can tune in SlaDefinition.
INSERT INTO "SlaDefinition" ("Module","Stage","DurationMinutes","WarningMinutes","EscalationEnabled") VALUES
  ('Tender','BidSubmission', 10080, 1440, TRUE),
  ('Tender','BidOpening',    2880,  720,  TRUE)
ON CONFLICT ("Module","Stage") DO NOTHING;

INSERT INTO "EscalationRule" ("Module","Stage","AfterMinutes","EscalateToRole") VALUES
  ('Tender','BidSubmission', 1440, 'ProcurementOfficer'),
  ('Tender','BidOpening',    1440, 'MD')
ON CONFLICT DO NOTHING;