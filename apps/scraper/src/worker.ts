import type { EnrichmentRun, ScrapeRun } from "@prisma/client";
import { BlockedError } from "./block-detection.js";
import { CancelledError } from "./dedupe.js";
import { db } from "./db.js";
import { logger } from "./logger.js";
import { enrichLeads, writeLeadEmail } from "./enrich.js";
import type { LeadForEnrichment } from "./enrich.js";

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
  const [scrapeResult, enrichResult] = await Promise.all([
    db.scrapeRun.updateMany({
      where: { status: "RUNNING" },
      data: {
        status:       "FAILED",
        finishedAt:   new Date(),
        errorMessage: "Worker crashed or restarted before this run completed",
      },
    }),
    db.enrichmentRun.updateMany({
      where: { status: "RUNNING" },
      data: {
        status:       "FAILED",
        finishedAt:   new Date(),
        errorMessage: "Worker crashed or restarted before this run completed",
      },
    }),
  ]);
  const total = scrapeResult.count + enrichResult.count;
  if (total > 0) {
    logger.info("reaped orphan runs", { scrape: scrapeResult.count, enrich: enrichResult.count });
  }
}

type JobClaim =
  | { type: "scrape";     job: ScrapeRun }
  | { type: "enrichment"; job: EnrichmentRun };

/**
 * Atomically claims the oldest PENDING job of either type.
 * Uses FOR UPDATE SKIP LOCKED on each table separately, then picks the older one.
 */
async function claimNextJob(): Promise<JobClaim | null> {
  // Claim one pending scrape run
  const scrapeRows = await db.$queryRaw<{ id: string; created_at: Date }[]>`
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
    RETURNING id, created_at
  `;

  // Claim one pending enrichment run
  const enrichRows = await db.$queryRaw<{ id: string; created_at: Date }[]>`
    UPDATE enrichment_runs
    SET    status     = 'RUNNING',
           started_at = NOW()
    WHERE  id = (
      SELECT id
      FROM   enrichment_runs
      WHERE  status = 'PENDING'
      ORDER  BY created_at ASC
      LIMIT  1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, created_at
  `;

  const scrape  = scrapeRows[0];
  const enrich  = enrichRows[0];

  if (!scrape && !enrich) return null;

  // If both claimed, release the newer one — process the older first
  if (scrape && enrich) {
    if (scrape.created_at <= enrich.created_at) {
      // Release the enrichment claim back to PENDING
      await db.enrichmentRun.update({
        where: { id: enrich.id },
        data:  { status: "PENDING", startedAt: null },
      });
      const job = await db.scrapeRun.findUnique({ where: { id: scrape.id } });
      return job ? { type: "scrape", job } : null;
    } else {
      // Release the scrape claim back to PENDING
      await db.scrapeRun.update({
        where: { id: scrape.id },
        data:  { status: "PENDING", startedAt: null },
      });
      const job = await db.enrichmentRun.findUnique({ where: { id: enrich.id } });
      return job ? { type: "enrichment", job } : null;
    }
  }

  if (scrape) {
    const job = await db.scrapeRun.findUnique({ where: { id: scrape.id } });
    return job ? { type: "scrape", job } : null;
  }

  const job = await db.enrichmentRun.findUnique({ where: { id: enrich!.id } });
  return job ? { type: "enrichment", job } : null;
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

// ── Enrichment job processor (§13) ──────────────────────────────────────────

export async function processEnrichmentJob(job: EnrichmentRun): Promise<void> {
  const startedAt = Date.now();
  logger.info("enrichment job started", { runId: job.id, totalLeads: job.totalLeads });

  try {
    // Load the worklist leads from DB; some may have gained an email since queue time
    const rawLeads = await db.lead.findMany({
      where:  { id: { in: job.leadIds } },
      select: { id: true, normalizedDomain: true, email: true },
    });

    // Leads that already have an email since queue time count as skipped
    const leads: LeadForEnrichment[] = rawLeads.map((l) => ({
      id:               l.id,
      normalizedDomain: l.normalizedDomain,
      email:            l.email,
    }));

    const upfrontSkipped = leads.filter((l) => l.email !== null).length;
    if (upfrontSkipped > 0) {
      await db.enrichmentRun.update({
        where: { id: job.id },
        data:  { skippedCount: { increment: upfrontSkipped } },
      });
    }

    // Leads that still need enrichment
    const toProcess = leads.filter((l) => l.email === null);

    let foundCount     = 0;
    let failedCount    = 0;
    let skippedCount   = upfrontSkipped;
    let processedCount = 0;

    await enrichLeads(
      toProcess,
      async ({ leadId, email, skipped }) => {
        if (skipped) {
          skippedCount++;
        } else {
          processedCount++;
          if (email) {
            foundCount++;
            await writeLeadEmail(leadId, email);
          } else {
            failedCount++;
          }
        }

        // Update run counters immediately after each lead
        await db.enrichmentRun.update({
          where: { id: job.id },
          data:  {
            processedCount,
            foundCount,
            failedCount,
            skippedCount,
          },
        });
      },
      // Cancellation check — called between batches
      async () => {
        const current = await db.enrichmentRun.findUnique({
          where:  { id: job.id },
          select: { status: true },
        });
        return current?.status === "CANCELLED";
      },
    );

    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    await db.enrichmentRun.update({
      where: { id: job.id },
      data:  { status: "COMPLETED", finishedAt: new Date(), durationSec },
    });
    logger.info("enrichment complete", {
      runId: job.id,
      found: foundCount,
      failed: failedCount,
      skipped: skippedCount,
      total: job.totalLeads,
      durationSec,
    });

  } catch (err) {
    const durationSec = Math.round((Date.now() - startedAt) / 1000);

    if (err instanceof CancelledError) {
      logger.info("enrichment cancelled", { runId: job.id, durationSec });
      await db.enrichmentRun.update({
        where: { id: job.id },
        data:  { durationSec },
      });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("enrichment failed", { runId: job.id, error: message });
      await db.enrichmentRun.update({
        where: { id: job.id },
        data:  { status: "FAILED", finishedAt: new Date(), durationSec, errorMessage: message },
      });
    }
  }
}

export async function runWorkerLoop(): Promise<never> {
  logger.info("worker loop started — polling every 2 s");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const claim = await claimNextJob();
      if (claim) {
        if (claim.type === "scrape") {
          await processJob(claim.job);
        } else {
          await processEnrichmentJob(claim.job);
        }
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
