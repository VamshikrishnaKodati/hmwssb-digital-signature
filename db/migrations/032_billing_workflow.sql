-- 032_billing_workflow.sql
-- Role-based bill workflow: Billing Officer → Manager → DGM → GM → Finance.
-- Adds stage ownership / returns / SLA to Billing plus per-bill items, documents
-- and a dedicated BillWorkflow history table (Workflow is estimate-scoped).

-- ── Billing header: ownership, returns, SLA ───────────────────────────────────

ALTER TABLE "Billing"
  ADD COLUMN IF NOT EXISTS "CurrentOwner" INT REFERENCES "Users"("UserID"),
  ADD COLUMN IF NOT EXISTS "PreviousStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "ReturnedBy" INT REFERENCES "Users"("UserID"),
  ADD COLUMN IF NOT EXISTS "ReturnedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "ReturnRemarks" TEXT,
  ADD COLUMN IF NOT EXISTS "SlaStartedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "SlaDueAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "SlaStatus" TEXT DEFAULT 'Normal',
  ADD COLUMN IF NOT EXISTS "EscalationLevel" INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "LastEscalatedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_billing_status ON "Billing"("Status");
CREATE INDEX IF NOT EXISTS idx_billing_owner ON "Billing"("CurrentOwner");

-- ── Bill items (snapshot of estimate details + verified measurement) ──────────

CREATE TABLE IF NOT EXISTS "BillItems" (
  "BillItemID"    SERIAL PRIMARY KEY,
  "BillID"        INT NOT NULL REFERENCES "Billing"("BillID") ON DELETE CASCADE,
  "DetailID"      INT REFERENCES "EstimateDetails"("DetailID"),
  "ItemCode"      TEXT,
  "ItemName"      TEXT,
  "Description"   TEXT,
  "Unit"          TEXT,
  "Category"      TEXT,
  "Rate"          NUMERIC(14,2) NOT NULL,
  "EstimateQty"   NUMERIC(14,3),
  "PreviousQty"   NUMERIC(14,3) DEFAULT 0,
  "CurrentQty"    NUMERIC(14,3) NOT NULL,
  "CumulativeQty" NUMERIC(14,3) DEFAULT 0,
  "BalanceQty"    NUMERIC(14,3) DEFAULT 0,
  "Amount"        NUMERIC(14,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billitems_bill ON "BillItems"("BillID");
CREATE INDEX IF NOT EXISTS idx_billitems_detail ON "BillItems"("DetailID");

-- ── Bill documents (stage-aware checklist) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS "BillDocuments" (
  "DocumentID"  SERIAL PRIMARY KEY,
  "BillID"      INT NOT NULL REFERENCES "Billing"("BillID") ON DELETE CASCADE,
  "DocType"     TEXT NOT NULL,
  "DocName"     TEXT NOT NULL,
  "FilePath"    TEXT,
  "UploadedBy"  INT REFERENCES "Users"("UserID"),
  "UploadedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billdocuments_bill ON "BillDocuments"("BillID");

-- ── Bill workflow history (mirrors Workflow but bill-scoped) ──────────────────

CREATE TABLE IF NOT EXISTS "BillWorkflow" (
  "WorkflowID"  SERIAL PRIMARY KEY,
  "BillID"      INT NOT NULL REFERENCES "Billing"("BillID") ON DELETE CASCADE,
  "FromUserID"  INT REFERENCES "Users"("UserID"),
  "ToUserID"    INT REFERENCES "Users"("UserID"),
  "Action"      TEXT NOT NULL,
  "Stage"       TEXT,
  "Remarks"     TEXT,
  "DateTime"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billworkflow_bill ON "BillWorkflow"("BillID");
CREATE INDEX IF NOT EXISTS idx_billworkflow_bill_dt ON "BillWorkflow"("BillID", "DateTime");

-- ── SLA definitions for bill stages ───────────────────────────────────────────

INSERT INTO "SlaDefinition" ("Module", "Stage", "DurationMinutes", "WarningMinutes", "EscalationEnabled") VALUES
  ('Billing', 'SubmittedToManager',   960, 120, TRUE),  -- 16 hours, warn 14h
  ('Billing', 'ManagerChecked',       480, 60,  TRUE),  -- 8 hours
  ('Billing', 'DGMChecked',           480, 60,  TRUE),  -- 8 hours
  ('Billing', 'SubmittedToFinance',   240, 60,  TRUE)   -- 4 hours
ON CONFLICT ("Module", "Stage") DO NOTHING;

-- ── RBAC: bill check / return permissions ─────────────────────────────────────

INSERT INTO "Permission" ("PermissionKey", "Description", "Module") VALUES
  ('bill.check', 'Check bill at current approval stage', 'Billing'),
  ('bill.return', 'Return bill to previous stage', 'Billing')
ON CONFLICT ("PermissionKey") DO NOTHING;

INSERT INTO "RolePermission" ("RoleID", "PermissionID")
SELECT r."RoleID", p."PermissionID"
FROM "Role" r
JOIN "Permission" p ON (
  (r."RoleName" IN ('Manager','DGM','GM') AND p."PermissionKey" IN ('bill.check','bill.return'))
  OR (r."RoleName" = 'BillingOfficer' AND p."PermissionKey" IN ('bill.check','bill.return'))
)
ON CONFLICT DO NOTHING;