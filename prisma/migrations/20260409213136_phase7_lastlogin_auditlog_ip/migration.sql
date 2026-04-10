-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SOC_ANALYST', 'IR_ANALYST', 'MALWARE_ANALYST', 'CTI_ANALYST', 'COUNTERMEASURES', 'TEAM_LEAD');

-- CreateEnum
CREATE TYPE "Team" AS ENUM ('SOC', 'IR', 'MALWARE', 'CTI', 'COUNTERMEASURES');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('NEW', 'TRIAGED', 'IN_PROGRESS', 'PENDING_REVIEW', 'CLOSED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('MALWARE', 'INTRUSION', 'PHISHING', 'INSIDER_THREAT', 'NONCOMPLIANCE', 'VULNERABILITY', 'ANOMALOUS_ACTIVITY', 'OTHER');

-- CreateEnum
CREATE TYPE "Disposition" AS ENUM ('TRUE_POSITIVE', 'FALSE_POSITIVE', 'BENIGN', 'UNDETERMINED');

-- CreateEnum
CREATE TYPE "TLP" AS ENUM ('WHITE', 'GREEN', 'AMBER', 'RED');

-- CreateEnum
CREATE TYPE "AssetImpact" AS ENUM ('CONFIRMED', 'SUSPECTED', 'CLEARED');

-- CreateEnum
CREATE TYPE "IocType" AS ENUM ('IP', 'DOMAIN', 'URL', 'MD5', 'SHA1', 'SHA256', 'EMAIL', 'FILE_PATH', 'REGISTRY_KEY', 'YARA_RULE', 'OTHER');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('NOTE', 'STATUS_CHANGE', 'ESCALATION', 'ASSIGNMENT', 'EVIDENCE_ADDED', 'IOC_ADDED', 'TTP_TAGGED', 'SIGNATURE_CREATED', 'DISPOSITION_SET', 'FIELD_EDIT', 'CORRECTION');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'SOC_ANALYST',
    "team" "Team",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'NEW',
    "severity" "Severity" NOT NULL,
    "category" "Category" NOT NULL,
    "tlp" "TLP" NOT NULL DEFAULT 'GREEN',
    "disposition" "Disposition" NOT NULL DEFAULT 'UNDETERMINED',
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "teamsInvolved" "Team"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_entries" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorTeam" "Team" NOT NULL,
    "entryType" "EntryType" NOT NULL,
    "body" TEXT NOT NULL,
    "corrects" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iocs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "IocType" NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "tlp" "TLP" NOT NULL DEFAULT 'GREEN',
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iocs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "hostname" TEXT,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "os" TEXT,
    "assetType" TEXT,
    "impact" "AssetImpact" NOT NULL DEFAULT 'SUSPECTED',
    "owner" TEXT,
    "description" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ttps" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "techniqueId" TEXT NOT NULL,
    "techniqueName" TEXT NOT NULL,
    "tactic" TEXT NOT NULL,
    "description" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ttps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "description" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "detail" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "targetTeam" "Team" NOT NULL,
    "targetUserId" TEXT,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_links" (
    "id" TEXT NOT NULL,
    "sourceCaseId" TEXT NOT NULL,
    "targetCaseId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cases_caseId_key" ON "cases"("caseId");

-- CreateIndex
CREATE INDEX "cases_caseId_idx" ON "cases"("caseId");

-- CreateIndex
CREATE INDEX "cases_status_idx" ON "cases"("status");

-- CreateIndex
CREATE INDEX "cases_severity_idx" ON "cases"("severity");

-- CreateIndex
CREATE INDEX "cases_tlp_idx" ON "cases"("tlp");

-- CreateIndex
CREATE INDEX "cases_createdAt_idx" ON "cases"("createdAt");

-- CreateIndex
CREATE INDEX "case_entries_caseId_createdAt_idx" ON "case_entries"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "iocs_caseId_idx" ON "iocs"("caseId");

-- CreateIndex
CREATE INDEX "iocs_value_idx" ON "iocs"("value");

-- CreateIndex
CREATE INDEX "assets_caseId_idx" ON "assets"("caseId");

-- CreateIndex
CREATE INDEX "ttps_caseId_idx" ON "ttps"("caseId");

-- CreateIndex
CREATE INDEX "ttps_techniqueId_idx" ON "ttps"("techniqueId");

-- CreateIndex
CREATE INDEX "artifacts_caseId_idx" ON "artifacts"("caseId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_targetTeam_isRead_idx" ON "notifications"("targetTeam", "isRead");

-- CreateIndex
CREATE INDEX "notifications_targetUserId_isRead_idx" ON "notifications"("targetUserId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_caseId_idx" ON "notifications"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "case_links_sourceCaseId_targetCaseId_key" ON "case_links"("sourceCaseId", "targetCaseId");

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_entries" ADD CONSTRAINT "case_entries_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_entries" ADD CONSTRAINT "case_entries_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iocs" ADD CONSTRAINT "iocs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ttps" ADD CONSTRAINT "ttps_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_links" ADD CONSTRAINT "case_links_sourceCaseId_fkey" FOREIGN KEY ("sourceCaseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_links" ADD CONSTRAINT "case_links_targetCaseId_fkey" FOREIGN KEY ("targetCaseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
