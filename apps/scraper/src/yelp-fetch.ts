import type { Campaign } from "@prisma/client";
import { CancelledError } from "./dedupe.js";
import { db } from "./db.js";
import { logger } from "./logger.js";
import type { RawLead } from "./google-maps.js";
import { fetchYelpBusinesses } from "./yelp-client.js";

const MAX_OFFSET = 950; // Yelp hard ceiling
const BATCH_SIZE = 50;  // Yelp returns at most 50 per request
const BATCH_DELAY_MS = 100; // politeness delay between requests

/**
 * Run a Yelp fetch job for one campaign.
 *
 * Resumes from campaign.apiOffset, fetches ceil(fetchCount/50) pages of 50
 * results each, hands each page to onBatch (the dedupe pipeline), and persists
 * apiOffset after every batch so a crash or cancel never loses progress.
 *
 * Stops when:
 *  - the requested count is reached
 *  - the 950-offset ceiling is hit
 *  - Yelp returns fewer than 50 (no more results)
 *  - isCancelled() returns true (throws CancelledError after the current batch)
 *
 * @param campaign    - full Campaign row (provides cursor + keyword/location)
 * @param fetchCount  - number of businesses the user requested this run
 * @param runId       - ScrapeRun id used when persisting apiOffset mid-run
 * @param onBatch     - dedupe pipeline callback; returning true means cancelled
 * @param isCancelled - async check called between batches
 */
export async function runYelpFetch(
  campaign:    Campaign,
  fetchCount:  number,
  runId:       string,
  onBatch:     (batch: RawLead[]) => Promise<boolean>,
  isCancelled: () => Promise<boolean>,
): Promise<void> {
  // Build the Yelp search location string: "City, State"
  const location = campaign.city
    ? `${campaign.city}, ${campaign.state}`
    : campaign.state;

  let offset    = campaign.apiOffset;
  let fetched   = 0;
  let totalKnown: number | null = campaign.apiTotalAvailable;

  logger.info("yelp fetch started", {
    runId,
    campaignId: campaign.id,
    keyword:    campaign.keyword,
    location,
    offset,
    fetchCount,
  });

  while (fetched < fetchCount) {
    // Hard ceiling on offset
    if (offset >= MAX_OFFSET) {
      logger.info("yelp offset ceiling reached", { runId, offset });
      break;
    }

    const remaining = fetchCount - fetched;
    // Yelp only supports limit=50; we always request 50 and stop early if needed
    const result = await fetchYelpBusinesses(campaign.keyword, location, offset);

    // Capture total on the first ever request for this campaign
    if (totalKnown === null) {
      totalKnown = result.total;
      await db.campaign.update({
        where: { id: campaign.id },
        data:  { apiTotalAvailable: result.total },
      });
      logger.info("yelp total captured", { runId, total: result.total });
    }

    const page = result.businesses;

    if (page.length === 0) {
      logger.info("yelp returned empty page — no more results", { runId, offset });
      break;
    }

    // Trim the page to exactly what the user asked for (last batch may be partial)
    const slice = remaining < page.length ? page.slice(0, remaining) : page;

    const cancelled = await onBatch(slice);

    fetched += slice.length;
    offset  += BATCH_SIZE; // always advance by full page — cursor is page-aligned

    // Persist the advanced offset after every batch (crash/cancel safe)
    await db.campaign.update({
      where: { id: campaign.id },
      data:  {
        apiOffset:      offset,
        apiKeywordUsed: campaign.keyword,
      },
    });

    logger.debug("yelp batch done", { runId, offset, fetched, total: totalKnown });

    // Respect cancellation signal — checked after persisting progress
    if (cancelled || await isCancelled()) {
      throw new CancelledError();
    }

    // If Yelp returned a short page, there are no more results
    if (page.length < BATCH_SIZE) {
      logger.info("yelp short page — search exhausted", { runId, offset, pageSize: page.length });
      break;
    }

    // Politeness delay between requests
    if (fetched < fetchCount) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  logger.info("yelp fetch complete", { runId, fetched, offset });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
