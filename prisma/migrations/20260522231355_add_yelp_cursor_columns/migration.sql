-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "api_keyword_used" VARCHAR(500),
ADD COLUMN     "api_offset" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "api_total_available" INTEGER;
