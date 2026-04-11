-- DropEnum (old Category) and create IncidentSource
-- Rename incident_class to incident_source on the cases table

-- Step 1: Create the new enum
CREATE TYPE "IncidentSource" AS ENUM ('EXTERNAL_THREAT', 'INSIDER_THREAT', 'THIRD_PARTY', 'UNKNOWN', 'OTHER');

-- Step 2: Add incidentSource column with a default (maps old category values → UNKNOWN as fallback)
ALTER TABLE "cases" ADD COLUMN "incidentSource" "IncidentSource" NOT NULL DEFAULT 'UNKNOWN';

-- Step 3: Add incidentSourceCustom column (nullable)
ALTER TABLE "cases" ADD COLUMN "incidentSourceCustom" TEXT;

-- Step 4: Drop the old category column
ALTER TABLE "cases" DROP COLUMN "category";

-- Step 5: Drop the old Category enum
DROP TYPE "Category";
