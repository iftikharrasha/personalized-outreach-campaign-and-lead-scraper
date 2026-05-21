-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'REPLIED', 'IGNORED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ScrapeRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "keyword" VARCHAR(500) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "city" VARCHAR(100),
    "source" VARCHAR(50) NOT NULL DEFAULT 'google_maps',
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "notify_email" VARCHAR(255),
    "total_leads" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "scrape_run_id" UUID,
    "business_name" VARCHAR(500) NOT NULL,
    "normalized_name" VARCHAR(500),
    "website_url" TEXT,
    "normalized_domain" VARCHAR(255),
    "phone" VARCHAR(50),
    "normalized_phone" VARCHAR(50),
    "email" VARCHAR(255),
    "address" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "raised" INTEGER,
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_runs" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "keyword_used" VARCHAR(500) NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "status" "ScrapeRunStatus" NOT NULL DEFAULT 'PENDING',
    "new_leads_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "duration_sec" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrape_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_history" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "previous_status" "LeadStatus",
    "new_status" "LeadStatus",
    "note" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_campaign_id_idx" ON "leads"("campaign_id");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_normalized_domain_idx" ON "leads"("normalized_domain");

-- CreateIndex
CREATE INDEX "leads_normalized_phone_idx" ON "leads"("normalized_phone");

-- CreateIndex
CREATE UNIQUE INDEX "leads_campaign_id_normalized_domain_key" ON "leads"("campaign_id", "normalized_domain");

-- CreateIndex
CREATE UNIQUE INDEX "leads_campaign_id_normalized_phone_key" ON "leads"("campaign_id", "normalized_phone");

-- CreateIndex
CREATE INDEX "scrape_runs_campaign_id_idx" ON "scrape_runs"("campaign_id");

-- CreateIndex
CREATE INDEX "scrape_runs_status_idx" ON "scrape_runs"("status");

-- CreateIndex
CREATE INDEX "lead_history_lead_id_idx" ON "lead_history"("lead_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_scrape_run_id_fkey" FOREIGN KEY ("scrape_run_id") REFERENCES "scrape_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrape_runs" ADD CONSTRAINT "scrape_runs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_history" ADD CONSTRAINT "lead_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
