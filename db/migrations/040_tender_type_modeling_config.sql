-- ============================================================================
-- Migration 040: Tender type-modeling — inert configuration foundation (Option 1)
--
-- PURPOSE
--   Introduces TenderConfig option lists as separate, configured concepts for
--   the tender type model: procurement method, electronic channel, participation
--   mode, and evaluation-criteria presets. This is a DATA-ONLY foundation: the
--   keys are seeded for reference so downstream design (Tender columns, workbench
--   form, persistence, NIT/PDF, bidder participation, evaluation methodology)
--   can decide against a stable vocabulary later.
--
-- SCOPE (deliberately inert)
--   ❌ No Tender table schema changes.
--   ❌ No TenderForm / DRAFT_FIELD_COLS changes.
--   ❌ No workflow, evaluation-logic, NIT/PDF, or bidder-portal changes.
--   ❌ No NEGOTIATED, no RFP, no invented unsupported procurement methods.
--   ✔ Seed configuration/reference values only, in the same TenderConfig table
--     that migration 036 created (keys are inert unless a future feature reads
--     them — no current code does).
--
-- CONCEPTS (kept separate, never merged into one field)
--   procurementMethod        — how the market is approached (Open / Limited).
--   electronicChannel        — the submission medium (E-Procurement / Offline).
--   participationMode        — who may bid (Open / Limited).
--   evaluationCriteriaPreset — documented, reusable evaluation-framework labels.
--
-- VALUES
--   Conservative, standard HMWSSB practice vocabulary. Deliberately excludes
--   NEGOTIATED / RFP / Single-source / Two-stage etc. until a future business
--   decision explicitly activates them. No default values are created; config
--   lists are inert metadata keyed by name only.
--
-- AUDIT
--   Applied via db/migrate.mjs (tracked in the _migrations table). Documented
--   in docs/PHASE2_DATA_FLOW_AUDIT.md (Tender type-modeling gap section).
-- ============================================================================

INSERT INTO "TenderConfig" ("ConfigKey", "ConfigValues") VALUES
  ('procurementMethod',        '["Open Tender","Limited Tender"]'::jsonb),
  ('electronicChannel',        '["E-Procurement","Offline"]'::jsonb),
  ('participationMode',        '["Open","Limited"]'::jsonb),
  ('evaluationCriteriaPreset', '["Pass/Fail (Technical)","L1 Lowest Bid","Composite Scoring"]'::jsonb)
ON CONFLICT ("ConfigKey") DO UPDATE SET "ConfigValues" = EXCLUDED."ConfigValues";