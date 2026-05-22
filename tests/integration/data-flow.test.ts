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

// ---------------------------------------------------------------------------
// Slice 4.12 — Outreach lifecycle: exercises the Phase 4 route handlers
// end-to-end (scrape → status → notes → email → search → filter → export →
// bulk delete) and asserts every step's effect on the database.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";

function req(url: string, init?: { method?: string; body?: unknown }): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method:  init?.method ?? "GET",
    ...(init?.body !== undefined && {
      body:    JSON.stringify(init.body),
      headers: { "Content-Type": "application/json" },
    }),
  });
}

describe("outreach lifecycle (Slice 4.12)", () => {
  it("scrape → status → notes → email → search → filter → export → bulk delete", async () => {
    // ── Step 1: create a campaign and seed leads via a mocked scrape ───────
    const campaign = await db.campaign.create({
      data: {
        name:     `${TEST_FLOW_PREFIX}Lifecycle`,
        keyword:  "lifecycle leads",
        category: "restaurants",
        country:  "US",
        state:    "California",
        source:   "google_maps",
        status:   "ACTIVE",
      },
    });

    const run = await db.scrapeRun.update({
      where: { id: (await db.scrapeRun.create({
        data: { campaignId: campaign.id, keywordUsed: campaign.keyword, status: "PENDING" },
      })).id },
      data: { status: "RUNNING", startedAt: new Date() },
    });
    const { processJob } = await import("../../apps/scraper/src/worker.js");
    await processJob(run);

    const seeded = await db.lead.findMany({
      where:   { campaignId: campaign.id },
      orderBy: { businessName: "asc" },
    });
    expect(seeded).toHaveLength(3); // Corner Bistro, Happy Diner, Sunset Grill
    const [corner, happy, sunset] = seeded;

    // ── Step 2: change a lead's status — writes a lead_history audit row ──
    const statusRoute = await import("../../apps/web/app/api/leads/[id]/status/route.js");
    await statusRoute.PUT(
      req(`/api/leads/${happy!.id}/status`, { method: "PUT", body: { status: "CONTACTED" } }),
      { params: Promise.resolve({ id: happy!.id }) },
    );
    const afterStatus = await db.lead.findUniqueOrThrow({ where: { id: happy!.id } });
    expect(afterStatus.status).toBe("CONTACTED");
    const statusHistory = await db.leadHistory.findMany({ where: { leadId: happy!.id } });
    expect(statusHistory.some((h) => h.newStatus === "CONTACTED" && h.previousStatus === "NEW")).toBe(true);

    // ── Step 3: add a note — writes a lead_history audit row ─────────────
    const notesRoute = await import("../../apps/web/app/api/leads/[id]/notes/route.js");
    await notesRoute.PUT(
      req(`/api/leads/${corner!.id}/notes`, { method: "PUT", body: { notes: "Call back Tuesday" } }),
      { params: Promise.resolve({ id: corner!.id }) },
    );
    const afterNote = await db.lead.findUniqueOrThrow({ where: { id: corner!.id } });
    expect(afterNote.notes).toBe("Call back Tuesday");
    const noteHistory = await db.leadHistory.findMany({ where: { leadId: corner!.id, note: { not: null } } });
    expect(noteHistory.length).toBeGreaterThanOrEqual(1);

    // ── Step 4: add an email — manual entry, validated ───────────────────
    const emailRoute = await import("../../apps/web/app/api/leads/[id]/email/route.js");
    const badEmail = await emailRoute.PUT(
      req(`/api/leads/${sunset!.id}/email`, { method: "PUT", body: { email: "not-an-email" } }),
      { params: Promise.resolve({ id: sunset!.id }) },
    );
    expect(badEmail.status).toBe(422); // invalid format rejected

    await emailRoute.PUT(
      req(`/api/leads/${sunset!.id}/email`, { method: "PUT", body: { email: "chef@sunsetgrill.com" } }),
      { params: Promise.resolve({ id: sunset!.id }) },
    );
    const afterEmail = await db.lead.findUniqueOrThrow({ where: { id: sunset!.id } });
    expect(afterEmail.email).toBe("chef@sunsetgrill.com");

    // ── Step 5: search the leads list (server-side) ──────────────────────
    const leadsRoute = await import("../../apps/web/app/api/campaigns/[id]/leads/route.js");
    const searchRes = await leadsRoute.GET(
      req(`/api/campaigns/${campaign.id}/leads?q=corner`),
      { params: Promise.resolve({ id: campaign.id }) },
    );
    const searchLeads = await searchRes.json() as { id: string }[];
    expect(searchLeads).toHaveLength(1);
    expect(searchLeads[0]!.id).toBe(corner!.id);

    // ── Step 6: filter by status ─────────────────────────────────────────
    const filterRes = await leadsRoute.GET(
      req(`/api/campaigns/${campaign.id}/leads?status=CONTACTED`),
      { params: Promise.resolve({ id: campaign.id }) },
    );
    const filterLeads = await filterRes.json() as { id: string }[];
    expect(filterLeads).toHaveLength(1);
    expect(filterLeads[0]!.id).toBe(happy!.id);

    // ── Step 7: campaign stats payload reflects the changes ──────────────
    const campaignRoute = await import("../../apps/web/app/api/campaigns/[id]/route.js");
    const statsRes = await campaignRoute.GET(
      req(`/api/campaigns/${campaign.id}`),
      { params: Promise.resolve({ id: campaign.id }) },
    );
    const statsBody = await statsRes.json() as { stats: { total: number; new: number; contacted: number } };
    expect(statsBody.stats.total).toBe(3);
    expect(statsBody.stats.contacted).toBe(1); // Happy Diner is CONTACTED
    expect(statsBody.stats.new).toBe(2);

    // ── Step 8: CSV export (all scope) ───────────────────────────────────
    const exportRoute = await import("../../apps/web/app/api/campaigns/[id]/export/route.js");
    const exportRes = await exportRoute.GET(
      req(`/api/campaigns/${campaign.id}/export?scope=all`),
      { params: Promise.resolve({ id: campaign.id }) },
    );
    expect(exportRes.headers.get("Content-Type")).toContain("text/csv");
    expect(exportRes.headers.get("Content-Disposition")).toContain("attachment");
    const csv = await exportRes.text();
    const csvLines = csv.trim().split("\r\n");
    expect(csvLines).toHaveLength(4); // header + 3 leads
    expect(csvLines[0]).toContain("Business Name");
    expect(csv).toContain("chef@sunsetgrill.com");

    // ── Step 9: bulk delete every lead ───────────────────────────────────
    const bulkRoute = await import("../../apps/web/app/api/leads/bulk/route.js");
    const delRes = await bulkRoute.DELETE(
      req(`/api/leads/bulk`, { method: "DELETE", body: { ids: seeded.map((l) => l.id) } }),
    );
    const delBody = await delRes.json() as { count: number };
    expect(delBody.count).toBe(3);

    const remaining = await db.lead.count({ where: { campaignId: campaign.id } });
    expect(remaining).toBe(0);

    // totalLeads counter was decremented back down
    const finalCampaign = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(finalCampaign.totalLeads).toBe(0);
  });
});
