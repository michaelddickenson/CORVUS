-- CreateEnum
CREATE TYPE "AttackVector" AS ENUM ('PHISHING', 'REMOVABLE_MEDIA', 'WEB_APPLICATION', 'SUPPLY_CHAIN', 'INSIDER', 'CREDENTIAL_COMPROMISE', 'PHYSICAL', 'UNKNOWN', 'OTHER');

-- CreateEnum
CREATE TYPE "MissionImpact" AS ENUM ('NONE', 'DEGRADED', 'MISSION_FAILURE', 'UNKNOWN');

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "affectedNetwork" TEXT,
ADD COLUMN     "attackVector" "AttackVector",
ADD COLUMN     "detectionSource" TEXT,
ADD COLUMN     "externalTicketId" TEXT,
ADD COLUMN     "incidentDetectedAt" TIMESTAMP(3),
ADD COLUMN     "incidentEndedAt" TIMESTAMP(3),
ADD COLUMN     "incidentReportedAt" TIMESTAMP(3),
ADD COLUMN     "incidentStartedAt" TIMESTAMP(3),
ADD COLUMN     "missionImpact" "MissionImpact",
ADD COLUMN     "reportingRequired" BOOLEAN NOT NULL DEFAULT false;
