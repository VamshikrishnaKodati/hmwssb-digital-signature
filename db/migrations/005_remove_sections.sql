-- HMWSSB - v5: Remove Sections level from location hierarchy
-- Sections had no real data; estimates now go down to Ward only.

ALTER TABLE "EstimateHeader" DROP COLUMN IF EXISTS "SectionID";
DROP TABLE IF EXISTS "Sections";
