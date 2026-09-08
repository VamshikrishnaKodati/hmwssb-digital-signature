-- General Abstract GST base change: GST computed on Cost of Estimate only
-- (Part-I). LS Provision (Part-III) is added after GST.
--   GST        = CostOfEstimate * GSTPercent / 100
--   Subtotal   = CostOfEstimate + GST                      [Part-I + Part-II]
--   GrandTotal = Subtotal + LSProvision                    [Part-I + II + III]

UPDATE "Abstract" ab
SET "GSTPercent" = COALESCE(eh."GSTPercent", 18),
    "GST"        = ROUND(ab."CostOfEstimate" * COALESCE(eh."GSTPercent", 18) / 100, 2),
    "Subtotal"   = ab."CostOfEstimate"
                   + ROUND(ab."CostOfEstimate" * COALESCE(eh."GSTPercent", 18) / 100, 2),
    "GrandTotal" = ab."CostOfEstimate"
                   + ROUND(ab."CostOfEstimate" * COALESCE(eh."GSTPercent", 18) / 100, 2)
                   + ab."LSProvision"
FROM "EstimateHeader" eh
WHERE eh."EstimateID" = ab."EstimateID";
