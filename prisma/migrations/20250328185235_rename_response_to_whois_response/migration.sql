/*
  Warnings:

  - You are about to drop the column `response` on the `Domain` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Domain" DROP COLUMN "response",
ADD COLUMN     "emails" TEXT,
ADD COLUMN     "registrar" TEXT,
ADD COLUMN     "whoisResponse" JSONB;
