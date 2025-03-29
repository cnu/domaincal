/*
  Warnings:

  - You are about to drop the `UserDomains` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserDomains" DROP CONSTRAINT "UserDomains_domainId_fkey";

-- DropForeignKey
ALTER TABLE "UserDomains" DROP CONSTRAINT "UserDomains_userId_fkey";

-- DropTable
DROP TABLE "UserDomains";

-- CreateTable
CREATE TABLE "UserDomain" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "domainId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDomain_userId_idx" ON "UserDomain"("userId");

-- CreateIndex
CREATE INDEX "UserDomain_domainId_idx" ON "UserDomain"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDomain_userId_domainId_key" ON "UserDomain"("userId", "domainId");

-- AddForeignKey
ALTER TABLE "UserDomain" ADD CONSTRAINT "UserDomain_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDomain" ADD CONSTRAINT "UserDomain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
