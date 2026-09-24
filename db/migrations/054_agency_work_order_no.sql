-- ============================================================================
-- Migration 054: Agency.WorkOrderNo.
--
-- The finalized-agency record must carry every contract prerequisite that
-- StartWork is gated on (Agency Finalization → Agreement → Work Order →
-- Work Start). The Agency row already carried AgreementNo/AgreementDate,
-- TenderValue, PerformanceGuarantee and WorkOrderDate; the work-order NUMBER
-- was only ever stored on the Tender, so a legacy estimate finalized purely
-- through the Agency record could never prove a work order existed.
--
-- Gaps ARE allowed: startWork reports the exact missing prerequisite and no
-- state is invented. The tender-module path mirrors the authoritative
-- Tender.WorkOrderNo here at issue-time.
-- ============================================================================
BEGIN;

ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "WorkOrderNo" TEXT;

COMMIT;