-- HMWSSB - v4: Item Master Enhancement
-- Adds: Units lookup, subcategories, full-text search, data quality

-- 1. Units lookup table
CREATE TABLE IF NOT EXISTS "Units" (
  "UnitID" SERIAL PRIMARY KEY,
  "UnitCode" TEXT UNIQUE NOT NULL,
  "UnitName" TEXT NOT NULL,
  "UnitType" TEXT NOT NULL CHECK ("UnitType" IN ('Count','Length','Area','Volume','Weight','Time','Rate')),
  "SortOrder" INT NOT NULL DEFAULT 0
);

INSERT INTO "Units" ("UnitCode","UnitName","UnitType","SortOrder") VALUES
  ('NOS','Numbers','Count',1),
  ('RMT','Running Metre','Length',2),
  ('SQM','Square Metre','Area',3),
  ('CUM','Cubic Metre','Volume',4),
  ('KG','Kilogram','Weight',5),
  ('MT','Metric Tonne','Weight',6),
  ('LTR','Litre','Volume',7),
  ('HR','Hour','Time',8),
  ('DAY','Day','Time',9),
  ('LS','Lump Sum','Rate',10),
  ('SQ','Sq (100 SQF approx)','Area',11)
ON CONFLICT ("UnitCode") DO NOTHING;

-- 2. Add normalized UnitCode, subcategory, short description, and search vector
ALTER TABLE "ItemMaster" ADD COLUMN IF NOT EXISTS "UnitCode" TEXT;
ALTER TABLE "ItemMaster" ADD COLUMN IF NOT EXISTS "SubCategory" TEXT;
ALTER TABLE "ItemMaster" ADD COLUMN IF NOT EXISTS "ShortDescription" TEXT;
ALTER TABLE "ItemMaster" ADD COLUMN IF NOT EXISTS "SearchVector" TSVECTOR;

-- 3. Migrate existing Unit values to UnitCode
UPDATE "ItemMaster" SET "UnitCode" = 
  CASE UPPER(TRIM("Unit"))
    WHEN 'NOS' THEN 'NOS'
    WHEN 'NOS.' THEN 'NOS'
    WHEN 'CUM' THEN 'CUM'
    WHEN 'CUM ' THEN 'CUM'
    WHEN 'SQ' THEN 'SQ'
    WHEN 'SQM' THEN 'SQM'
    WHEN 'SQM ' THEN 'SQM'
    WHEN 'SQ. M' THEN 'SQM'
    WHEN '10 SQM' THEN 'SQM'
    WHEN 'RMT' THEN 'RMT'
    WHEN 'RMT ' THEN 'RMT'
    WHEN 'RM' THEN 'RMT'
    WHEN 'RUNNING METRE' THEN 'RMT'
    WHEN 'KG' THEN 'KG'
    WHEN 'KGS' THEN 'KG'
    WHEN 'MT' THEN 'MT'
    WHEN 'DAY' THEN 'DAY'
    WHEN 'DAY ' THEN 'DAY'
    WHEN 'HR' THEN 'HR'
    WHEN 'HP-HR' THEN 'HR'
    WHEN '5 HP-HR' THEN 'HR'
    WHEN '10 HP-HR' THEN 'HR'
    WHEN '5Hp-Hr' THEN 'HR'
    WHEN 'LTR' THEN 'LTR'
    WHEN 'PER LTR' THEN 'LTR'
    WHEN 'LS' THEN 'LS'
    ELSE UPPER(TRIM("Unit"))
  END
WHERE "UnitCode" IS NULL;

-- Add extra unit entries for existing data variants
INSERT INTO "Units" ("UnitCode","UnitName","UnitType","SortOrder") VALUES
  ('10 SQM','10 Square Metre','Area',12),
  ('5 HP-HR','5 Horsepower-Hour','Time',13),
  ('10 HP-HR','10 Horsepower-Hour','Time',14),
  ('HP-HR','Horsepower-Hour','Time',15),
  ('PER LTR','Per Litre','Volume',16)
ON CONFLICT ("UnitCode") DO NOTHING;

-- 4. Add full-text search index
CREATE INDEX IF NOT EXISTS idx_itemmaster_searchvector ON "ItemMaster" USING GIN("SearchVector");

CREATE OR REPLACE FUNCTION itemmaster_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW."SearchVector" := to_tsvector('english',
    COALESCE(NEW."ItemCode",'') || ' ' ||
    COALESCE(NEW."ShortDescription", NEW."Description",'') || ' ' ||
    COALESCE(NEW."SubCategory",'')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_itemmaster_search ON "ItemMaster";
CREATE TRIGGER trg_itemmaster_search
  BEFORE INSERT OR UPDATE OF "ItemCode", "ShortDescription", "Description", "SubCategory"
  ON "ItemMaster"
  FOR EACH ROW EXECUTE FUNCTION itemmaster_search_update();

-- 5. Index for subcategory filtering
CREATE INDEX IF NOT EXISTS idx_itemmaster_subcategory ON "ItemMaster"("SubCategory");
CREATE INDEX IF NOT EXISTS idx_itemmaster_unitcode ON "ItemMaster"("UnitCode");

-- 6. Update existing rows to populate search vectors
UPDATE "ItemMaster" SET "SearchVector" = to_tsvector('english',
  COALESCE("ItemCode",'') || ' ' ||
  COALESCE("ShortDescription", "Description",'') || ' ' ||
  COALESCE("SubCategory",'')
);
