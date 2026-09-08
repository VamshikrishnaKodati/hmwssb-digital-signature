-- Evaluation → L1 → Agency Award: per-tender Evaluation Authority.
-- Ownership split (brief): TenderOfficer = prep / publication / bid closing admin / bid opening.
-- Configured Evaluation Authority = technical evaluation / financial evaluation / L1.
-- DirectorOfAdministration = work award / work order / agreement.
--
-- EvaluationAuthorityID is per-tender (NULL → legacy fallback: any tender.evaluate
-- holder, kept so pre-043 tenders and tests behave as before). TechnicalChecklist
-- is the structured per-bid evaluation result (JSONB [{Criterion,Passed,Remarks}]).
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "EvaluationAuthorityID" INT REFERENCES "Users"("UserID");
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "TechnicalChecklist" JSONB;