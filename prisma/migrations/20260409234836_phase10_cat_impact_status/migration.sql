/*
  Warnings:

  - The values [TRIAGED] on the enum `Status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `disposition` on the `cases` table. All the data in the column will be lost.
  - You are about to drop the column `severity` on the `cases` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "IncidentCat" AS ENUM ('CAT_1', 'CAT_2', 'CAT_3', 'CAT_4', 'CAT_5', 'CAT_6', 'CAT_7', 'CAT_8', 'CAT_9');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterEnum
BEGIN;
CREATE TYPE "Status_new" AS ENUM ('NEW', 'IN_PROGRESS', 'PENDING_REVIEW', 'CLOSED');
ALTER TABLE "public"."cases" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "cases" ALTER COLUMN "status" TYPE "Status_new" USING ("status"::text::"Status_new");
ALTER TYPE "Status" RENAME TO "Status_old";
ALTER TYPE "Status_new" RENAME TO "Status";
DROP TYPE "public"."Status_old";
ALTER TABLE "cases" ALTER COLUMN "status" SET DEFAULT 'NEW';
COMMIT;

-- DropIndex
DROP INDEX "cases_severity_idx";

-- AlterTable
ALTER TABLE "cases" DROP COLUMN "disposition",
DROP COLUMN "severity",
ADD COLUMN     "cat" "IncidentCat" NOT NULL DEFAULT 'CAT_8',
ADD COLUMN     "impactLevel" "ImpactLevel" NOT NULL DEFAULT 'LOW';

-- DropEnum
DROP TYPE "Disposition";

-- DropEnum
DROP TYPE "Severity";

-- CreateIndex
CREATE INDEX "cases_cat_idx" ON "cases"("cat");
