-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "response" JSONB,
    "registrar" TEXT,
    "emails" TEXT,
    "domain_expiry_date" TIMESTAMP(3),
    "domain_created_date" TIMESTAMP(3),
    "domain_updated_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_refreshed_at" TIMESTAMP(3),

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_domains" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "domain_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "domains_name_key" ON "domains"("name");

-- CreateIndex
CREATE INDEX "domains_name_idx" ON "domains"("name");

-- CreateIndex
CREATE INDEX "user_domains_user_id_idx" ON "user_domains"("user_id");

-- CreateIndex
CREATE INDEX "user_domains_domain_id_idx" ON "user_domains"("domain_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_domains_user_id_domain_id_key" ON "user_domains"("user_id", "domain_id");

-- AddForeignKey
ALTER TABLE "user_domains" ADD CONSTRAINT "user_domains_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_domains" ADD CONSTRAINT "user_domains_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
