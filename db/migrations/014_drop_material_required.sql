-- Remove the MaterialRequired flag from EstimateHeader. Whether an estimate
-- contains material is now derived automatically from its Estimate Items
-- (any item with Category = 'Material').
ALTER TABLE "EstimateHeader" DROP COLUMN IF EXISTS "MaterialRequired";
