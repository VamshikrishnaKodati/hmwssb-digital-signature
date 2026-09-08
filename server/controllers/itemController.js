const db = require('../config/db');

exports.listItems = async (req, res, next) => {
  try {
    const { search, category, subcategory, unit, active } = req.query;
    let sql = `SELECT i.*, r."Rate", r."EffectiveFrom"
               FROM "ItemMaster" i
               LEFT JOIN LATERAL (
                 SELECT "Rate","EffectiveFrom" FROM "ItemMasterRateHistory"
                 WHERE "ItemID" = i."ItemID" AND "EffectiveTo" IS NULL
                 ORDER BY "EffectiveFrom" DESC LIMIT 1
               ) r ON TRUE`;
    const params = [];
    const conditions = [];

    if (search) {
      conditions.push(`(
        i."SearchVector" @@ plainto_tsquery('english', $${params.length + 1})
        OR i."ItemCode" ILIKE $${params.length + 2}
        OR i."Description" ILIKE $${params.length + 3}
        OR i."Category" ILIKE $${params.length + 4}
      )`);
      const searchTerm = `%${search}%`;
      params.push(search, searchTerm, searchTerm, searchTerm);
    }
    if (category) {
      conditions.push(`i."Category" = $${params.length + 1}`);
      params.push(category);
    }
    if (subcategory) {
      conditions.push(`i."SubCategory" = $${params.length + 1}`);
      params.push(subcategory);
    }
    if (unit) {
      conditions.push(`i."UnitCode" = $${params.length + 1}`);
      params.push(unit.toUpperCase());
    }
    if (active !== undefined) {
      conditions.push(`i."IsActive" = $${params.length + 1}`);
      params.push(active === 'true');
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY i."ItemCode"';

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getItem = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT i.*, r."Rate", r."EffectiveFrom"
       FROM "ItemMaster" i
       LEFT JOIN LATERAL (
         SELECT "Rate","EffectiveFrom" FROM "ItemMasterRateHistory"
         WHERE "ItemID" = i."ItemID" AND "EffectiveTo" IS NULL
         ORDER BY "EffectiveFrom" DESC LIMIT 1
       ) r ON TRUE
       WHERE i."ItemID" = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.createItem = async (req, res, next) => {
  try {
    const { ItemCode, Description, ShortDescription, Unit, Category, SubCategory, FormulaType, RateIncludesGST, Rate } = req.body;
    if (!ItemCode || !Description || !Unit || !Category || !FormulaType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const exists = await db.query('SELECT 1 FROM "ItemMaster" WHERE "ItemCode" = $1', [ItemCode]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Item code already exists' });
    }

    const itemResult = await db.query(
      `INSERT INTO "ItemMaster" ("ItemCode","Description","ShortDescription","Unit","UnitCode","Category","SubCategory","FormulaType","RateIncludesGST","IsActive")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE) RETURNING *`,
      [ItemCode, Description, ShortDescription || Description, Unit, Unit.toUpperCase(),
       Category, SubCategory || null, FormulaType, RateIncludesGST || false]
    );

    if (Rate !== undefined && Rate !== null && Rate !== '') {
      await db.query(
        `INSERT INTO "ItemMasterRateHistory" ("ItemID","Rate","EffectiveFrom")
         VALUES ($1,$2,CURRENT_DATE)`,
        [itemResult.rows[0].ItemID, Rate]
      );
    }

    res.status(201).json(itemResult.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.updateItem = async (req, res, next) => {
  try {
    const { Description, ShortDescription, Unit, Category, SubCategory, FormulaType, RateIncludesGST, IsActive, Rate } = req.body;
    const itemId = req.params.id;

    const fields = [];
    const params = [];
    let idx = 1;

    if (Description !== undefined) { fields.push(`"Description" = $${idx++}`); params.push(Description); }
    if (ShortDescription !== undefined) { fields.push(`"ShortDescription" = $${idx++}`); params.push(ShortDescription); }
    if (Unit !== undefined) { fields.push(`"Unit" = $${idx++}`); params.push(Unit); fields.push(`"UnitCode" = $${idx++}`); params.push(Unit.toUpperCase()); }
    if (Category !== undefined) { fields.push(`"Category" = $${idx++}`); params.push(Category); }
    if (SubCategory !== undefined) { fields.push(`"SubCategory" = $${idx++}`); params.push(SubCategory); }
    if (FormulaType !== undefined) { fields.push(`"FormulaType" = $${idx++}`); params.push(FormulaType); }
    if (RateIncludesGST !== undefined) { fields.push(`"RateIncludesGST" = $${idx++}`); params.push(RateIncludesGST); }
    if (IsActive !== undefined) { fields.push(`"IsActive" = $${idx++}`); params.push(IsActive); }

    if (fields.length > 0) {
      params.push(itemId);
      await db.query(
        `UPDATE "ItemMaster" SET ${fields.join(', ')} WHERE "ItemID" = $${idx}`,
        params
      );
    }

    if (Rate !== undefined && Rate !== null && Rate !== '') {
      await db.query(
        `UPDATE "ItemMasterRateHistory" SET "EffectiveTo" = CURRENT_DATE - 1
         WHERE "ItemID" = $1 AND "EffectiveTo" IS NULL`,
        [itemId]
      );
      await db.query(
        `INSERT INTO "ItemMasterRateHistory" ("ItemID","Rate","EffectiveFrom")
         VALUES ($1,$2,CURRENT_DATE)`,
        [itemId, Rate]
      );
    }

    const updated = await db.query(
      `SELECT i.*, r."Rate", r."EffectiveFrom"
       FROM "ItemMaster" i
       LEFT JOIN LATERAL (
         SELECT "Rate","EffectiveFrom" FROM "ItemMasterRateHistory"
         WHERE "ItemID" = i."ItemID" AND "EffectiveTo" IS NULL
         ORDER BY "EffectiveFrom" DESC LIMIT 1
       ) r ON TRUE
       WHERE i."ItemID" = $1`,
      [itemId]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getRateHistory = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT rh.*, i."ItemCode", i."Description"
       FROM "ItemMasterRateHistory" rh
       JOIN "ItemMaster" i ON i."ItemID" = rh."ItemID"
       WHERE rh."ItemID" = $1
       ORDER BY rh."EffectiveFrom" DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.listCategories = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT "Category", "SubCategory", COUNT(*)::int as "itemCount"
       FROM "ItemMaster"
       WHERE "IsActive" = TRUE
       GROUP BY "Category", "SubCategory"
       ORDER BY "Category", "SubCategory"`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.listUnits = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT u.*, COUNT(i."ItemID")::int as "itemCount"
       FROM "Units" u
       LEFT JOIN "ItemMaster" i ON i."UnitCode" = u."UnitCode" AND i."IsActive" = TRUE
       GROUP BY u."UnitID", u."UnitCode", u."UnitName", u."UnitType", u."SortOrder"
       ORDER BY u."SortOrder"`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};
