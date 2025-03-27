/*
  Warnings:

  - You are about to drop the column `emails` on the `Domain` table. All the data in the column will be lost.
  - You are about to drop the column `registrar` on the `Domain` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Domain" DROP COLUMN "emails",
DROP COLUMN "registrar",
ADD COLUMN     "dnssecDsData" TEXT,
ADD COLUMN     "dnssecStatus" TEXT,
ADD COLUMN     "domainRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "domainStatuses" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nameServers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "queryTime" TIMESTAMP(3),
ADD COLUMN     "registrarIanaId" TEXT,
ADD COLUMN     "registrarName" TEXT,
ADD COLUMN     "registrarUrl" TEXT,
ADD COLUMN     "registrarWhoisServer" TEXT,
ADD COLUMN     "whoisRawDomain" TEXT,
ADD COLUMN     "whoisRawRegistry" TEXT,
ADD COLUMN     "whoisServer" TEXT;
