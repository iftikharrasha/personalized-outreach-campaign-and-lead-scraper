import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RawLead } from "../../apps/scraper/src/google-maps.js";

const db = new PrismaClient();

const TEST_FLOW_PREFIX = "TEST__FLOW__";

beforeAll(async () => {
  await db.$connect();
});

afterAll(async () => {
  await db.campaign.deleteMany({ where: { name: { startsWith: TEST_FLOW_PREFIX } } });
  await db.$disconnect();
});

describe("Campaign CRUD data flow", () => {
  let campaignId: string;

  it("creates a campaign (POST shape)", async () => {
    const campaign = await db.campaign.create({
      data: {
        name: `${TEST_FLOW_PREFIX}Integration Test Campaign`,
        keyword: "restaurants in test city",
        category: "restaurants",
        country: "US",
        state: "California",
        city: "Test City",
        source: "google_maps",
        status: "ACTIVE",
      },
    });
    expect(campaign.id).toBeTruthy();
    expect(campaign.name).toBe(`${TEST_FLOW_PREFIX}Integration Test Campaign`);
    expect(campaign.status).toBe("ACTIVE");
    campaignId = campaign.id;
  });

  it("reads the campaign back (GET shape)", async () => {
    const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
    expect(campaign).not.toBeNull();
    expect(campaign!.keyword).toBe("restaurants in test city");
  });

  it("pauses a campaign (PUT status=PAUSED)", async () => {
    const updated = await db.campaign.update({
      where: { id: campaignId },
      data: { status: "PAUSED" },
    });
    expect(updated.status).toBe("PAUSED");
  });

  it("archives a campaign (PUT status=ARCHIVED)", async () => {
    const updated = await db.campaign.update({
      where: { id: campaignId },
      data: { status: "ARCHIVED" },
    });
    expect(updated.status).toBe("ARCHIVED");
  });

  it("restores a campaign back to ACTIVE", async () => {
    const updated = await db.campaign.update({
      where: { id: campaignId },
      data: { status: "ACTIVE" },
    });
    expect(updated.status).toBe("ACTIVE");
  });
});

// ---------------------------------------------------------------------------
// End-to-end happy path: campaign → scrape run → leads (mocked scraper)
// ---------------------------------------------------------------------------

const E2E_LEADS: RawLead[] = [
  { businessName: "Happy Diner",   websiteUrl: "https://happydiner.com",   phone: "(555) 100-0001", address: "1 Happy St"   },
  { businessName: "Corner Bistro", websiteUrl: "https://cornerbistro.com", phone: "(555) 100-0002", address: "2 Corner Ave" },
  { businessName: "Sunset Grill",  websiteUrl: "https://sunsetgrill.com",  phone: "(555) 100-0003", address: "3 Sunset Rd"  },
];

vi.mock("../../apps/scraper/src/google-maps.js", () => ({
  scrapeGoogleMaps: vi.fn(async (
    _browser: unknown,
    _keyword: string,
    onBatch: (batch: RawLead[]) => Promise<boolean>,
  ) => { await onBatch(E2E_LEADS); }),
}));

vi.mock("playwright", () => ({
  chromium: {
    launchPersistentContext: vi.fn(async () => ({ close: vi.fn(async () => undefined) })),
  },
}));

describe("end-to-end scrape happy path (Slice 2.9)", () => {
  it("creates a campaign, runs a scrape job, and lands leads in the DB", async () => {
    const campaign = await db.campaign.create({
      data: {
        name:     `${TEST_FLOW_PREFIX}E2E Happy Path`,
        keyword:  "restaurants in e2e city",
        category: "restaurants",
        country:  "US",
        state:    "California",
        source:   "google_maps",
        status:   "ACTIVE",
      },
    });

    // Simulate what POST /api/scrape/run does
    const run = await db.scrapeRun.create({
      data: { campaignId: campaign.id, keywordUsed: campaign.keyword, status: "PENDING" },
    });

    // Claim it (mirrors worker claimNextJob)
    const job = await db.scrapeRun.update({
      where: { id: run.id },
      data:  { status: "RUNNING", startedAt: new Date() },
    });

    // Run the job in-process with mocked extraction
    const { processJob } = await import("../../apps/scraper/src/worker.js");
    await processJob(job);

    // Assert run completed
    const finalRun = await db.scrapeRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(finalRun.status).toBe("COMPLETED");
    expect(finalRun.newLeadsCount).toBe(3);
    expect(finalRun.duplicateCount).toBe(0);

    // Assert leads landed
    const leads = await db.lead.findMany({ where: { campaignId: campaign.id } });
    expect(leads).toHaveLength(3);
    expect(leads.map((l) => l.businessName).sort()).toEqual(
      ["Corner Bistro", "Happy Diner", "Sunset Grill"]
    );

    // Assert campaign total updated
    const updatedCampaign = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(updatedCampaign.totalLeads).toBe(3);
  });
});
