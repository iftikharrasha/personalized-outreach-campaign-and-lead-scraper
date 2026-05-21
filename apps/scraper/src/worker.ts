import type { ScrapeRun } from "@prisma/client";
import { CancelledError } from "./dedupe.js";
import { db } from "./db.js";
import { logger } from "./logger.js";

const POLL_INTERVAL_MS = 2000;

// Atomically claims the next PENDING scrape_run for this worker.
// Uses raw SQL with FOR UPDATE SKIP LOCKED so multiple worker processes
// can run concurrently without claiming the same job.
async function claimNextJob(): Promise<ScrapeRun | null> {
  // $queryRaw returns raw snake_case column names, not Prisma camelCase.
  // We only need the id from the UPDATE — then fetch the full typed row.
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE scrape_runs
    SET    status     = 'RUNNING',
           started_at = NOW()
    WHERE  id = (
      SELECT id
      FROM   scrape_runs
      WHERE  status = 'PENDING'
      ORDER  BY created_at ASC
      LIMIT  1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `;
  const claimed = rows[0];
  if (!claimed) return null;
  return db.scrapeRun.findUnique({ where: { id: claimed.id } });
}

async function markCompleted(runId: string, durationSec: number) {
  await db.scrapeRun.update({
    where: { id: runId },
    data: {
      status:      "COMPLETED",
      finishedAt:  new Date(),
      durationSec,
    },
  });
}

async function markFailed(runId: string, errorMessage: string, durationSec: number) {
  await db.scrapeRun.update({
    where: { id: runId },
    data: {
      status:       "FAILED",
      finishedAt:   new Date(),
      durationSec,
      errorMessage,
    },
  });
}

export async function processJob(job: ScrapeRun) {
  const startedAt = Date.now();
  logger.info("processing job", { runId: job.id, keyword: job.keywordUsed });

  // Import scrape function lazily — Playwright is only loaded when there's
  // actual work to do, so a cold-start idle worker doesn't touch the browser.
  const { scrapeGoogleMaps } = await import("./google-maps.js");
  const { createBatchProcessor } = await import("./dedupe.js");

  let browser: import("playwright").BrowserContext | null = null;

  try {
    const { chromium } = await import("playwright");

    const dataDir = new URL("../.playwright-data", import.meta.url).pathname
      .replace(/^\/([A-Z]:)/, "$1"); // strip leading / on Windows paths

    browser = await chromium.launchPersistentContext(dataDir, {
      headless: process.env["SCRAPER_HEADLESS"] !== "false",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const { onBatch, finish } = createBatchProcessor(job);
    await scrapeGoogleMaps(browser, job.keywordUsed, onBatch);
    await finish();

    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    await markCompleted(job.id, durationSec);
    logger.info("job completed", { runId: job.id, durationSec });
  } catch (err) {
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    if (err instanceof CancelledError) {
      logger.info("job cancelled", { runId: job.id });
      // Status is already CANCELLED in the DB — just update duration
      await db.scrapeRun.update({
        where: { id: job.id },
        data:  { durationSec },
      });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("job failed", { runId: job.id, error: message });
      await markFailed(job.id, message, durationSec);
    }
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* best-effort */ }
    }
  }
}

export async function runWorkerLoop(): Promise<never> {
  logger.info("worker loop started — polling every 2 s");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const job = await claimNextJob();
      if (job) {
        await processJob(job);
      } else {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (err) {
      // Don't crash the loop on a transient DB error; log and keep going.
      logger.error("worker loop error", { error: String(err) });
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
