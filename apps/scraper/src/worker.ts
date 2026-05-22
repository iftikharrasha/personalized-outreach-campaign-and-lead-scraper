import type { ScrapeRun } from "@prisma/client";
import { BlockedError } from "./block-detection.js";
import { CancelledError } from "./dedupe.js";
import { db } from "./db.js";
import { logger } from "./logger.js";

const POLL_INTERVAL_MS = 2000;

// Default Chrome desktop user-agents used when USER_AGENTS env var is not set.
const DEFAULT_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function pickUserAgent(): string {
  let pool = DEFAULT_USER_AGENTS;
  const envVal = process.env["USER_AGENTS"];
  if (envVal) {
    try {
      const parsed = JSON.parse(envVal) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) pool = parsed as string[];
    } catch {
      logger.warn("USER_AGENTS env var is not valid JSON — using defaults");
    }
  }
  return pool[Math.floor(Math.random() * pool.length)]!;
}

// On startup: reap any runs left RUNNING from a previous crashed worker.
export async function reapOrphanRuns(): Promise<void> {
  const result = await db.scrapeRun.updateMany({
    where: { status: "RUNNING" },
    data: {
      status:       "FAILED",
      finishedAt:   new Date(),
      errorMessage: "Worker crashed or restarted before this run completed",
    },
  });
  if (result.count > 0) {
    logger.info("reaped orphan runs", { count: result.count });
  }
}

// Atomically claims the next PENDING scrape_run for this worker.
async function claimNextJob(): Promise<ScrapeRun | null> {
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
    data: { status: "COMPLETED", finishedAt: new Date(), durationSec },
  });
}

async function markFailed(runId: string, errorMessage: string, durationSec: number) {
  await db.scrapeRun.update({
    where: { id: runId },
    data: { status: "FAILED", finishedAt: new Date(), durationSec, errorMessage },
  });
}

export async function processJob(job: ScrapeRun) {
  const startedAt = Date.now();
  const userAgent = pickUserAgent();
  logger.info("processing job", { runId: job.id, keyword: job.keywordUsed, userAgent: userAgent.slice(0, 40) + "…" });

  const { scrapeGoogleMaps } = await import("./google-maps.js");
  const { createBatchProcessor } = await import("./dedupe.js");

  let browser: import("playwright").BrowserContext | null = null;

  try {
    const { chromium } = await import("playwright");

    const dataDir = new URL("../.playwright-data", import.meta.url).pathname
      .replace(/^\/([A-Z]:)/, "$1");

    browser = await chromium.launchPersistentContext(dataDir, {
      headless:  process.env["SCRAPER_HEADLESS"] !== "false",
      userAgent,
      viewport:  { width: 1280, height: 720 },
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const { onBatch, finish, wasCancelled } = createBatchProcessor(job);
    await scrapeGoogleMaps(browser, job.keywordUsed, onBatch);
    await finish();

    const durationSec = Math.round((Date.now() - startedAt) / 1000);

    // If the scrape exited because the user pressed Stop, leave the run
    // CANCELLED — do NOT overwrite it with COMPLETED.
    if (wasCancelled()) {
      logger.info("job cancelled by user", { runId: job.id, durationSec });
      await db.scrapeRun.update({ where: { id: job.id }, data: { durationSec } });
    } else {
      await markCompleted(job.id, durationSec);
      logger.info("job completed", { runId: job.id, durationSec });
    }
  } catch (err) {
    const durationSec = Math.round((Date.now() - startedAt) / 1000);

    if (err instanceof CancelledError) {
      logger.info("job cancelled", { runId: job.id });
      await db.scrapeRun.update({ where: { id: job.id }, data: { durationSec } });

    } else if (err instanceof BlockedError) {
      const msg = `Blocked by Google: ${err.blockType} (${err.severity})`;
      logger.warn("job blocked", { runId: job.id, blockType: err.blockType, severity: err.severity });
      await markFailed(job.id, msg, durationSec);

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
      logger.error("worker loop error", { error: String(err) });
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
