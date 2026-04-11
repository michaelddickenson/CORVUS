-- CreateEnum
CREATE TYPE "CaseAccess" AS ENUM ('READ', 'WRITE');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'OBSERVER';

-- CreateTable
CREATE TABLE "case_permissions" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessLevel" "CaseAccess" NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "case_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_permissions_caseId_idx" ON "case_permissions"("caseId");

-- CreateIndex
CREATE INDEX "case_permissions_userId_idx" ON "case_permissions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "case_permissions_caseId_userId_key" ON "case_permissions"("caseId", "userId");

-- AddForeignKey
ALTER TABLE "case_permissions" ADD CONSTRAINT "case_permissions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_permissions" ADD CONSTRAINT "case_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_permissions" ADD CONSTRAINT "case_permissions_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
