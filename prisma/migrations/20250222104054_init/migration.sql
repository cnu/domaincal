-- CreateTable
CREATE TABLE "User" (
    "id" BIGSERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "response" JSONB,
    "domainExpiryDate" TIMESTAMP(3),
    "domainCreatedDate" TIMESTAMP(3),
    "domainUpdatedDate" TIMESTAMP(3),
    "registrar" TEXT,
    "emails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDomains" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "domainId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDomains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_name_key" ON "Domain"("name");

-- CreateIndex
CREATE INDEX "Domain_name_idx" ON "Domain"("name");

-- CreateIndex
CREATE INDEX "UserDomains_userId_idx" ON "UserDomains"("userId");

-- CreateIndex
CREATE INDEX "UserDomains_domainId_idx" ON "UserDomains"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDomains_userId_domainId_key" ON "UserDomains"("userId", "domainId");

-- AddForeignKey
ALTER TABLE "UserDomains" ADD CONSTRAINT "UserDomains_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDomains" ADD CONSTRAINT "UserDomains_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
