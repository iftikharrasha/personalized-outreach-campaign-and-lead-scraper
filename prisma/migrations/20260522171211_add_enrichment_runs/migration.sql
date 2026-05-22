-- CreateEnum
CREATE TYPE "EnrichmentRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "enrichment_runs" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "status" "EnrichmentRunStatus" NOT NULL DEFAULT 'PENDING',
    "lead_ids" TEXT[],
    "total_leads" INTEGER NOT NULL,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "found_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrichment_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enrichment_runs_campaign_id_idx" ON "enrichment_runs"("campaign_id");

-- CreateIndex
CREATE INDEX "enrichment_runs_status_idx" ON "enrichment_runs"("status");

-- AddForeignKey
ALTER TABLE "enrichment_runs" ADD CONSTRAINT "enrichment_runs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
