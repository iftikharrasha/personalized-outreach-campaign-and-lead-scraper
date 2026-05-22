import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { runDedupe } from "../../apps/scraper/src/dedupe.js";
import type { RawLead } from "../../apps/scraper/src/google-maps.js";

const db = new PrismaClient();
const TEST_PREFIX = "TEST__SCRAPER__";

let campaignId: string;
let runId: string;

beforeAll(async () => {
  await db.$connect();

  const campaign = await db.campaign.create({
    data: {
      name:     `${TEST_PREFIX}Scraper Flow`,
      keyword:  "restaurants in test city",
      category: "restaurants",
      country:  "US",
      state:    "California",
      source:   "google_maps",
      status:   "ACTIVE",
    },
  });
  campaignId = campaign.id;

  const run = await db.scrapeRun.create({
    data: {
      campaignId,
      keywordUsed: "restaurants in test city",
      status:      "RUNNING",
      startedAt:   new Date(),
    },
  });
  runId = run.id;
});

afterAll(async () => {
  await db.campaign.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await db.$disconnect();
});

function buildRawLeads(count: number, prefix = "Restaurant"): RawLead[] {
  return Array.from({ length: count }, (_, i) => ({
    businessName: `${prefix} ${i + 1}`,
    websiteUrl:   `https://${prefix.toLowerCase().replace(/\s+/g, "-")}-${i + 1}.com`,
    phone:        `555${String(i + 1).padStart(7, "0")}`,
    address:      `${i + 1} Main St`,
  }));
}

describe("dedupe + batch insert pipeline (Slice 2.5 + 2.6)", () => {
  it("inserts 20 new leads and records 5 duplicates when 5 are pre-seeded", async () => {
    const allRaw = buildRawLeads(25);

    // Seed 5 existing leads that match the first 5 raw entries (domain dedupe)
    await db.lead.createMany({
      data: allRaw.slice(0, 5).map((r) => ({
        campaignId,
        scrapeRunId:      runId,
        businessName:     r.businessName,
        normalizedDomain: `${r.businessName.toLowerCase().replace(/\s+/g, "-")}.com`,
        normalizedPhone:  r.phone!.replace(/\D/g, ""),
      })),
    });

    const job = await db.scrapeRun.findUniqueOrThrow({ where: { id: runId } });
    await runDedupe(allRaw, job);

    const finalRun = await db.scrapeRun.findUniqueOrThrow({ where: { id: runId } });
    expect(finalRun.newLeadsCount).toBeGreaterThanOrEqual(20);
    expect(finalRun.duplicateCount).toBeGreaterThanOrEqual(5);

    const totalLeads = await db.lead.count({ where: { campaignId } });
    expect(totalLeads).toBe(25); // 5 pre-seeded + 20 new
  });

  it("updates campaign totalLeads after insert", async () => {
    const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(campaign.totalLeads).toBeGreaterThanOrEqual(20);
  });

  it("does not insert duplicates on a second run with the same leads", async () => {
    const run2 = await db.scrapeRun.create({
      data: { campaignId, keywordUsed: "restaurants in test city", status: "RUNNING", startedAt: new Date() },
    });

    const sameLeads = buildRawLeads(25);
    const job2 = await db.scrapeRun.findUniqueOrThrow({ where: { id: run2.id } });
    await runDedupe(sameLeads, job2);

    const finalRun2 = await db.scrapeRun.findUniqueOrThrow({ where: { id: run2.id } });
    expect(finalRun2.newLeadsCount).toBe(0);
    expect(finalRun2.duplicateCount).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// Slice 2.9 — worker in-process test with mocked Playwright + extraction
// ---------------------------------------------------------------------------

const STUB_LEADS: RawLead[] = buildRawLeads(25, "Cafe");

// Mock google-maps.ts: call onBatch once with all stub leads, return void
vi.mock("../../apps/scraper/src/google-maps.js", () => ({
  scrapeGoogleMaps: vi.fn(async (
    _browser: unknown,
    _keyword: string,
    onBatch: (batch: RawLead[]) => Promise<boolean>,
  ) => { await onBatch(STUB_LEADS); }),
}));

// Mock playwright itself so the worker never tries to open a browser
vi.mock("playwright", () => ({
  chromium: {
    launchPersistentContext: vi.fn(async () => ({
      close: vi.fn(async () => undefined),
    })),
  },
}));

describe("worker processJob end-to-end (Slice 2.9)", () => {
  it("processes a PENDING job: RUNNING→COMPLETED with correct counters", async () => {
    // Create a fresh campaign and a PENDING run
    const campaign = await db.campaign.create({
      data: {
        name:     `${TEST_PREFIX}Worker E2E`,
        keyword:  "cafes in test city",
        category: "cafes",
        country:  "US",
        state:    "California",
        source:   "google_maps",
        status:   "ACTIVE",
      },
    });

    const pendingRun = await db.scrapeRun.create({
      data: {
        campaignId: campaign.id,
        keywordUsed: "cafes in test city",
        status:      "PENDING",
      },
    });

    // Manually claim the job (mirrors claimNextJob) so we have the typed row
    const job = await db.scrapeRun.update({
      where: { id: pendingRun.id },
      data:  { status: "RUNNING", startedAt: new Date() },
    });

    // Run processJob directly — no browser, no network, uses mocked scrapeGoogleMaps
    const { processJob } = await import("../../apps/scraper/src/worker.js");
    await processJob(job);

    // Run should be COMPLETED
    const finalRun = await db.scrapeRun.findUniqueOrThrow({ where: { id: pendingRun.id } });
    expect(finalRun.status).toBe("COMPLETED");
    expect(finalRun.finishedAt).not.toBeNull();
    expect(finalRun.durationSec).not.toBeNull();

    // 25 stub leads inserted, 0 duplicates (fresh campaign)
    expect(finalRun.newLeadsCount).toBe(25);
    expect(finalRun.duplicateCount).toBe(0);

    // Leads are in the DB
    const leadCount = await db.lead.count({ where: { campaignId: campaign.id } });
    expect(leadCount).toBe(25);

    // Campaign totalLeads updated
    const updatedCampaign = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(updatedCampaign.totalLeads).toBe(25);
  });

  it("marks a job FAILED when scrapeGoogleMaps throws", async () => {
    const { scrapeGoogleMaps } = await import("../../apps/scraper/src/google-maps.js");
    vi.mocked(scrapeGoogleMaps).mockRejectedValueOnce(new Error("selector timeout"));

    const campaign = await db.campaign.create({
      data: {
        name:     `${TEST_PREFIX}Worker Fail`,
        keyword:  "bars in test city",
        category: "bars",
        country:  "US",
        state:    "California",
        source:   "google_maps",
        status:   "ACTIVE",
      },
    });

    const job = await db.scrapeRun.create({
      data: {
        campaignId:  campaign.id,
        keywordUsed: "bars in test city",
        status:      "RUNNING",
        startedAt:   new Date(),
      },
    });

    const { processJob } = await import("../../apps/scraper/src/worker.js");
    await processJob(job);

    const finalRun = await db.scrapeRun.findUniqueOrThrow({ where: { id: job.id } });
    expect(finalRun.status).toBe("FAILED");
    expect(finalRun.errorMessage).toContain("selector timeout");
    expect(finalRun.finishedAt).not.toBeNull();
  });

  it("marks a job FAILED with block message when scraper throws BlockedError", async () => {
    const { scrapeGoogleMaps } = await import("../../apps/scraper/src/google-maps.js");
    const { BlockedError } = await import("../../apps/scraper/src/block-detection.js");
    vi.mocked(scrapeGoogleMaps).mockRejectedValueOnce(new BlockedError("CAPTCHA", "hard"));

    const campaign = await db.campaign.create({
      data: {
        name:     `${TEST_PREFIX}Block Test`,
        keyword:  "blocked query",
        category: "restaurants",
        country:  "US",
        state:    "California",
        source:   "google_maps",
        status:   "ACTIVE",
      },
    });

    const job = await db.scrapeRun.create({
      data: { campaignId: campaign.id, keywordUsed: "blocked query", status: "RUNNING", startedAt: new Date() },
    });

    const { processJob } = await import("../../apps/scraper/src/worker.js");
    await processJob(job);

    const finalRun = await db.scrapeRun.findUniqueOrThrow({ where: { id: job.id } });
    expect(finalRun.status).toBe("FAILED");
    expect(finalRun.errorMessage).toContain("CAPTCHA");
  });
});

// ---------------------------------------------------------------------------
// Slice 3.5 — Orphan run reaper
// ---------------------------------------------------------------------------

describe("reapOrphanRuns (Slice 3.5)", () => {
  it("marks all RUNNING runs as FAILED on worker restart", async () => {
    const campaign = await db.campaign.create({
      data: {
        name:     `${TEST_PREFIX}Orphan Test`,
        keyword:  "orphan query",
        category: "restaurants",
        country:  "US",
        state:    "California",
        source:   "google_maps",
        status:   "ACTIVE",
      },
    });

    // Simulate two runs left stuck at RUNNING (worker crashed)
    const run1 = await db.scrapeRun.create({
      data: { campaignId: campaign.id, keywordUsed: "orphan query", status: "RUNNING", startedAt: new Date() },
    });
    const run2 = await db.scrapeRun.create({
      data: { campaignId: campaign.id, keywordUsed: "orphan query", status: "RUNNING", startedAt: new Date() },
    });

    const { reapOrphanRuns } = await import("../../apps/scraper/src/worker.js");
    await reapOrphanRuns();

    const [r1, r2] = await Promise.all([
      db.scrapeRun.findUniqueOrThrow({ where: { id: run1.id } }),
      db.scrapeRun.findUniqueOrThrow({ where: { id: run2.id } }),
    ]);
    expect(r1.status).toBe("FAILED");
    expect(r1.errorMessage).toContain("crashed");
    expect(r2.status).toBe("FAILED");
    expect(r2.finishedAt).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Slice 3.6 — Cancellation: partial leads preserved
// ---------------------------------------------------------------------------

describe("cancellation preserves partial leads (Slice 3.6)", () => {
  it("stops mid-scrape and keeps already-flushed leads", async () => {
    const { scrapeGoogleMaps } = await import("../../apps/scraper/src/google-maps.js");

    const campaign = await db.campaign.create({
      data: {
        name:     `${TEST_PREFIX}Cancel Test`,
        keyword:  "cancel query",
        category: "restaurants",
        country:  "US",
        state:    "California",
        source:   "google_maps",
        status:   "ACTIVE",
      },
    });

    const pendingRun = await db.scrapeRun.create({
      data: { campaignId: campaign.id, keywordUsed: "cancel query", status: "PENDING" },
    });
    const job = await db.scrapeRun.update({
      where: { id: pendingRun.id },
      data:  { status: "RUNNING", startedAt: new Date() },
    });

    // Scraper sends first batch then simulates user pressing Stop mid-way.
    // The dedupe cancellation check is throttled to once per 3 s, so we wait
    // past that window before the second batch to guarantee it re-checks.
    vi.mocked(scrapeGoogleMaps).mockImplementationOnce(async (
      _browser: unknown,
      _keyword: string,
      onBatch: (batch: RawLead[]) => Promise<boolean>,
    ) => {
      // Send first batch of 3 leads
      await onBatch(buildRawLeads(3, "Cancel"));
      // Simulate the DB being marked CANCELLED before next batch
      await db.scrapeRun.update({ where: { id: job.id }, data: { status: "CANCELLED", finishedAt: new Date() } });
      // Wait past the 3 s cancellation-check throttle window
      await new Promise((r) => setTimeout(r, 3100));
      // Send second batch — onBatch should now re-check and return true (stop)
      await onBatch(buildRawLeads(3, "CancelB"));
    });

    const { processJob } = await import("../../apps/scraper/src/worker.js");
    await processJob(job);

    // Partial leads from first batch should be in DB
    const leads = await db.lead.findMany({ where: { campaignId: campaign.id } });
    expect(leads.length).toBeGreaterThanOrEqual(3);

    // Run should be CANCELLED (not FAILED)
    const finalRun = await db.scrapeRun.findUniqueOrThrow({ where: { id: job.id } });
    expect(finalRun.status).toBe("CANCELLED");
  });
});
