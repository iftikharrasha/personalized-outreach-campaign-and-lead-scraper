import type { ScrapeRun } from "@prisma/client";
import { normalizeDomain, normalizePhone, normalizeBusinessName } from "../../../packages/shared/src/index.js";
import { db } from "./db.js";
import { logger } from "./logger.js";
import type { RawLead } from "./google-maps.js";

export class CancelledError extends Error {
  constructor() { super("Run cancelled"); this.name = "CancelledError"; }
}

interface PreparedLead {
  campaignId:       string;
  scrapeRunId:      string;
  businessName:     string;
  normalizedName:   string;
  websiteUrl:       string | null;
  normalizedDomain: string | null;
  phone:            string | null;
  normalizedPhone:  string | null;
  address:          string | null;
}

// Returns an onBatch callback to pass to scrapeGoogleMaps.
// Each scroll's new leads are immediately deduped and flushed to the DB.
// Returns true from the callback to signal the scraper to stop (cancellation).
export function createBatchProcessor(job: ScrapeRun): {
  onBatch: (batch: RawLead[]) => Promise<boolean>;
  finish:  () => Promise<void>;
} {
  // In-memory seen sets — loaded once before first batch, updated as leads are inserted
  const existingDomains = new Set<string>();
  const existingPhones  = new Set<string>();
  let seenSetsLoaded = false;

  let totalNew  = 0;
  let totalDupe = 0;

  async function loadSeenSets() {
    const existing = await db.lead.findMany({
      where:  { campaignId: job.campaignId },
      select: { normalizedDomain: true, normalizedPhone: true },
    });
    for (const l of existing) {
      if (l.normalizedDomain) existingDomains.add(l.normalizedDomain);
      if (l.normalizedPhone)  existingPhones.add(l.normalizedPhone);
    }
    seenSetsLoaded = true;
  }

  async function onBatch(rawBatch: RawLead[]): Promise<boolean> {
    if (!seenSetsLoaded) await loadSeenSets();

    const toInsert: PreparedLead[] = [];
    let batchDupes = 0;

    for (const raw of rawBatch) {
      const normalizedDomain = normalizeDomain(raw.websiteUrl);
      const normalizedPhone  = normalizePhone(raw.phone);
      const normalizedName   = normalizeBusinessName(raw.businessName);

      const isDupe =
        (normalizedDomain !== null && existingDomains.has(normalizedDomain)) ||
        (normalizedPhone  !== null && existingPhones.has(normalizedPhone));

      if (isDupe) {
        batchDupes++;
        logger.debug("duplicate skipped", { businessName: raw.businessName });
        continue;
      }

      // Mark seen immediately (intra-batch dedupe)
      if (normalizedDomain) existingDomains.add(normalizedDomain);
      if (normalizedPhone)  existingPhones.add(normalizedPhone);

      toInsert.push({
        campaignId:       job.campaignId,
        scrapeRunId:      job.id,
        businessName:     raw.businessName,
        normalizedName,
        websiteUrl:       raw.websiteUrl,
        normalizedDomain,
        phone:            raw.phone,
        normalizedPhone,
        address:          raw.address,
      });
    }

    if (toInsert.length > 0 || batchDupes > 0) {
      const inserted = await flushBatch(toInsert, job.id, batchDupes);
      totalNew  += inserted;
      totalDupe += batchDupes;
    }

    // Check for cancellation after flush
    const current = await db.scrapeRun.findUnique({ where: { id: job.id }, select: { status: true } });
    return current?.status === "CANCELLED";
  }

  async function finish() {
    // Update campaign totalLeads once at the end
    if (totalNew > 0) {
      await db.campaign.update({
        where: { id: job.campaignId },
        data:  { totalLeads: { increment: totalNew } },
      });
    }
    logger.info("dedupe complete", { runId: job.id, totalNew, totalDupe });
  }

  return { onBatch, finish };
}

async function flushBatch(
  batch: PreparedLead[],
  runId: string,
  dupeCount: number,
): Promise<number> {
  if (batch.length === 0 && dupeCount === 0) return 0;

  let inserted = 0;

  try {
    const ops: Parameters<typeof db.$transaction>[0] = [];

    if (batch.length > 0) {
      ops.push(db.lead.createMany({ data: batch, skipDuplicates: true }));
    }

    ops.push(
      db.scrapeRun.update({
        where: { id: runId },
        data: {
          ...(batch.length > 0 && { newLeadsCount:  { increment: batch.length } }),
          ...(dupeCount   > 0 && { duplicateCount: { increment: dupeCount } }),
        },
      })
    );

    const results = await db.$transaction(ops);

    if (batch.length > 0) {
      inserted = (results[0] as { count: number }).count;
      const raceDupes = batch.length - inserted;
      if (raceDupes > 0) {
        logger.debug("race-condition dupes caught by DB constraint", { count: raceDupes });
      }
    }
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      logger.debug("batch insert unique violation — batch skipped", { runId });
    } else {
      throw err;
    }
  }

  logger.debug("batch flushed", { inserted, dupeCount, runId });
  return inserted;
}

// Keep runDedupe for backward compat with tests that call it directly
export async function runDedupe(rawLeads: RawLead[], job: ScrapeRun): Promise<void> {
  const { onBatch, finish } = createBatchProcessor(job);
  // Process in chunks of 10 to match old batch behaviour
  for (let i = 0; i < rawLeads.length; i += 10) {
    const cancelled = await onBatch(rawLeads.slice(i, i + 10));
    if (cancelled) break;
  }
  await finish();
}
