-- Migration 045: Automatic, transaction-safe AS & TS sanction numbering.
-- AS and TS numbers are generated server-side from an atomic per-(Type, FinancialYear)
-- counter (never decremented), so numbers are automatic, unique, sequential, permanent,
-- and never reused after deletion/rejection. The format is configurable
-- (default AS/<FY>/<SEQ>, TS/<FY>/<SEQ>).

-- 1. Atomic per-(Type, FinancialYear) counter. Never decremented.
CREATE TABLE IF NOT EXISTS "SanctionSequence" (
  "Type"          TEXT NOT NULL,
  "FinancialYear" TEXT NOT NULL,
  "LastSequence"  INT NOT NULL DEFAULT 0,
  PRIMARY KEY ("Type","FinancialYear")
);

-- 2. New counter rows start ABOVE any previously generated numbers that already
--    follow the automatic AS/<FY>/<seq> / TS/<FY>/<seq> layout, so an existing
--    database (with older auto/manual numbers) is never renumbered or collided.
INSERT INTO "SanctionSequence" ("Type","FinancialYear","LastSequence")
SELECT 'AS', x."fy", MAX(x."seq")::INT
FROM (
  SELECT (regexp_match("SanctionNo", '^AS/([0-9]{4}-[0-9]{2})/([0-9]+)$'))[1] AS "fy",
         (regexp_match("SanctionNo", '^AS/([0-9]{4}-[0-9]{2})/([0-9]+)$'))[2]::INT AS "seq"
  FROM "AdministrativeSanction"
  WHERE "SanctionNo" ~ '^AS/[0-9]{4}-[0-9]{2}/[0-9]+$'
) x
GROUP BY x."fy"
ON CONFLICT ("Type","FinancialYear")
  DO UPDATE SET "LastSequence" = GREATEST("SanctionSequence"."LastSequence", EXCLUDED."LastSequence");

INSERT INTO "SanctionSequence" ("Type","FinancialYear","LastSequence")
SELECT 'TS', x."fy", MAX(x."seq")::INT
FROM (
  SELECT (regexp_match("TSNo", '^TS/([0-9]{4}-[0-9]{2})/([0-9]+)$'))[1] AS "fy",
         (regexp_match("TSNo", '^TS/([0-9]{4}-[0-9]{2})/([0-9]+)$'))[2]::INT AS "seq"
  FROM "TechnicalSanction"
  WHERE "TSNo" ~ '^TS/[0-9]{4}-[0-9]{2}/[0-9]+$'
) x
GROUP BY x."fy"
ON CONFLICT ("Type","FinancialYear")
  DO UPDATE SET "LastSequence" = GREATEST("SanctionSequence"."LastSequence", EXCLUDED."LastSequence");

-- 3. Defense-in-depth unique backstops, mirroring FCN_FCNNo_unique. Only created
--    when the historical data is already unique so the migration never fails on
--    legacy manual entries. The atomic counter already guarantees uniqueness.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "AdministrativeSanction" GROUP BY "SanctionNo" HAVING COUNT(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "AdminSanction_SanctionNo_unique" ON "AdministrativeSanction"("SanctionNo");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "TechnicalSanction" WHERE "TSNo" IS NOT NULL GROUP BY "TSNo" HAVING COUNT(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "TechnicalSanction_TSNo_unique" ON "TechnicalSanction"("TSNo");
  END IF;
END $$;