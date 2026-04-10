-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'PENDING', 'COMPLETE', 'RETURNED');

-- AlterEnum
ALTER TYPE "EntryType" ADD VALUE 'RETURNED';

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "blufSummary" TEXT,
ADD COLUMN     "recommendedActions" TEXT;

-- CreateTable
CREATE TABLE "case_team_statuses" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "team" "Team" NOT NULL,
    "status" "TeamStatus" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "case_team_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_team_statuses_caseId_idx" ON "case_team_statuses"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "case_team_statuses_caseId_team_key" ON "case_team_statuses"("caseId", "team");

-- AddForeignKey
ALTER TABLE "case_team_statuses" ADD CONSTRAINT "case_team_statuses_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_team_statuses" ADD CONSTRAINT "case_team_statuses_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
