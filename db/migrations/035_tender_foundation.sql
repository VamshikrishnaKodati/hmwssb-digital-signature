-- Migration 035: Tender Foundation (Phase T1)
-- Adds the tender foundation fields so the Tender Officer can build a full
-- TenderDraft from a genuinely tender-ready estimate (FinalApproved -> FCN ->
-- AS -> TS approved). No evaluation/award changes here; that is a later phase.

-- ── 1. Tender foundation columns ──────────────────────────────────────────────

ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "TenderCategory" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "TenderInvitingAuthority" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "BidOpeningAuthority" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "EvaluationType" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "EvaluationCriteria" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "PackageNumber" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "BidCallNumber" TEXT;
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "PreBidMeetingDate" DATE;

-- ── 2. Ready Date + SLA source: ensure the tendered estimate link is indexed ──

CREATE INDEX IF NOT EXISTS "TechnicalSanction_ApprovedAt_idx" ON "TechnicalSanction"("ApprovedAt");