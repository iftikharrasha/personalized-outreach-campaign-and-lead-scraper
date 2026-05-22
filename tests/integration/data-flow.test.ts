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

// ---------------------------------------------------------------------------
// Slice 5.1 — Data-flow parity: the whole MVP lifecycle in one scenario.
// scrape (50 leads, 10 dupes) → inline status → bulk status → notes →
// audit-row assertions → search → CSV export → cancel → archive.
// ---------------------------------------------------------------------------

describe("data-flow parity — full lifecycle (Slice 5.1)", () => {
  it("runs the whole MVP lifecycle end-to-end and asserts every step", async () => {
    const { scrapeGoogleMaps } = await import("../../apps/scraper/src/google-maps.js");
    const { processJob } = await import("../../apps/scraper/src/worker.js");

    // ── Step 1: create the campaign ──────────────────────────────────────
    const campaign = await db.campaign.create({
      data: {
        name:     `${TEST_FLOW_PREFIX}Parity`,
        keyword:  "parity leads",
        category: "restaurants",
        country:  "US",
        state:    "California",
        source:   "google_maps",
        status:   "ACTIVE",
      },
    });

    // ── Step 2: scrape — 50 leads, but 10 are exact duplicates of the
    // first 10, so the dedupe should land 40 and count 10 duplicates. ────
    const unique: RawLead[] = Array.from({ length: 40 }, (_, i) => ({
      businessName: `Parity Biz ${i + 1}`,
      websiteUrl:   `https://parity-biz-${i + 1}.com`,
      phone:        `555${String(i + 1).padStart(7, "0")}`,
      address:      `${i + 1} Parity St`,
    }));
    const duplicates = unique.slice(0, 10); // same domain+phone → dupes
    const fiftyLeads = [...unique, ...duplicates];

    vi.mocked(scrapeGoogleMaps).mockImplementationOnce(async (
      _browser: unknown,
      _keyword: string,
      onBatch: (batch: RawLead[]) => Promise<boolean>,
    ) => { await onBatch(fiftyLeads); });

    const run = await db.scrapeRun.update({
      where: { id: (await db.scrapeRun.create({
        data: { campaignId: campaign.id, keywordUsed: campaign.keyword, status: "PENDING" },
      })).id },
      data: { status: "RUNNING", startedAt: new Date() },
    });
    await processJob(run);

    // ── Step 3: 40 inserted, 10 duplicates, run COMPLETED ────────────────
    const finalRun = await db.scrapeRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(finalRun.status).toBe("COMPLETED");
    expect(finalRun.newLeadsCount).toBe(40);
    expect(finalRun.duplicateCount).toBe(10);

    const leads = await db.lead.findMany({
      where:   { campaignId: campaign.id },
      orderBy: { businessName: "asc" },
    });
    expect(leads).toHaveLength(40);

    const statusRoute = await import("../../apps/web/app/api/leads/[id]/status/route.js");
    const notesRoute  = await import("../../apps/web/app/api/leads/[id]/notes/route.js");
    const bulkStatusRoute = await import("../../apps/web/app/api/leads/bulk-status/route.js");

    // ── Step 4: inline-edit 5 leads to CONTACTED (one by one) ────────────
    const firstFive = leads.slice(0, 5);
    for (const lead of firstFive) {
      await statusRoute.PUT(
        req(`/api/leads/${lead.id}/status`, { method: "PUT", body: { status: "CONTACTED" } }),
        { params: Promise.resolve({ id: lead.id }) },
      );
    }

    // ── Step 5: move 3 of those to REPLIED ───────────────────────────────
    const threeReplied = firstFive.slice(0, 3);
    for (const lead of threeReplied) {
      await statusRoute.PUT(
        req(`/api/leads/${lead.id}/status`, { method: "PUT", body: { status: "REPLIED" } }),
        { params: Promise.resolve({ id: lead.id }) },
      );
    }

    // ── Step 6: bulk-update 10 other leads to IGNORED ────────────────────
    const tenIgnored = leads.slice(5, 15);
    await bulkStatusRoute.PUT(
      req(`/api/leads/bulk-status`, {
        method: "PUT",
        body:   { ids: tenIgnored.map((l) => l.id), status: "IGNORED" },
      }),
    );

    // ── Step 7: add notes to 2 leads ─────────────────────────────────────
    const twoNoted = leads.slice(15, 17);
    for (const lead of twoNoted) {
      await notesRoute.PUT(
        req(`/api/leads/${lead.id}/notes`, { method: "PUT", body: { notes: `note for ${lead.businessName}` } }),
        { params: Promise.resolve({ id: lead.id }) },
      );
    }

    // ── Step 8: lead_history holds exactly the expected rows ─────────────
    const allHistory = await db.leadHistory.findMany({
      where: { lead: { campaignId: campaign.id } },
    });
    // Status changes: 5 (→CONTACTED) + 3 (→REPLIED) + 10 (→IGNORED) = 18
    const statusRows = allHistory.filter((h) => h.newStatus !== null);
    expect(statusRows).toHaveLength(18);
    expect(statusRows.filter((h) => h.newStatus === "CONTACTED")).toHaveLength(5);
    expect(statusRows.filter((h) => h.newStatus === "REPLIED")).toHaveLength(3);
    expect(statusRows.filter((h) => h.newStatus === "IGNORED")).toHaveLength(10);
    // Note changes: 2 rows, each with note text and null statuses
    const noteRows = allHistory.filter((h) => h.note !== null && h.newStatus === null);
    expect(noteRows).toHaveLength(2);

    // ── Step 9: search returns the right subset ──────────────────────────
    const leadsRoute = await import("../../apps/web/app/api/campaigns/[id]/leads/route.js");
    // "Parity Biz 1" matches "Parity Biz 1", "...10".."...19" → 11 leads
    const searchRes = await leadsRoute.GET(
      req(`/api/campaigns/${campaign.id}/leads?q=${encodeURIComponent("Parity Biz 1")}`),
      { params: Promise.resolve({ id: campaign.id }) },
    );
    const searchLeads = await searchRes.json() as unknown[];
    expect(searchLeads).toHaveLength(11);

    // ── Step 10: export filtered (status=IGNORED) to CSV ─────────────────
    const exportRoute = await import("../../apps/web/app/api/campaigns/[id]/export/route.js");
    const exportRes = await exportRoute.GET(
      req(`/api/campaigns/${campaign.id}/export?scope=filtered&status=IGNORED`),
      { params: Promise.resolve({ id: campaign.id }) },
    );
    expect(exportRes.headers.get("Content-Type")).toContain("text/csv");
    const csv = await exportRes.text();
    const csvLines = csv.trim().split("\r\n");
    expect(csvLines[0]).toContain("Business Name");
    expect(csvLines).toHaveLength(11); // header + 10 IGNORED leads

    // ── Step 11: cancel a fresh scrape mid-flight ────────────────────────
    const cancelRun = await db.scrapeRun.update({
      where: { id: (await db.scrapeRun.create({
        data: { campaignId: campaign.id, keywordUsed: campaign.keyword, status: "PENDING" },
      })).id },
      data: { status: "RUNNING", startedAt: new Date() },
    });
    vi.mocked(scrapeGoogleMaps).mockImplementationOnce(async (
      _browser: unknown,
      _keyword: string,
      onBatch: (batch: RawLead[]) => Promise<boolean>,
    ) => {
      // First partial batch lands, then the user cancels.
      await onBatch([
        { businessName: "Cancel Biz A", websiteUrl: "https://cancel-a.com", phone: "5559990001", address: "A" },
        { businessName: "Cancel Biz B", websiteUrl: "https://cancel-b.com", phone: "5559990002", address: "B" },
      ]);
      await db.scrapeRun.update({ where: { id: cancelRun.id }, data: { status: "CANCELLED", finishedAt: new Date() } });
      await new Promise((r) => setTimeout(r, 3100)); // pass the 3 s cancel-check throttle
      await onBatch([
        { businessName: "Cancel Biz C", websiteUrl: "https://cancel-c.com", phone: "5559990003", address: "C" },
      ]);
    });
    await processJob(cancelRun);

    const cancelledRun = await db.scrapeRun.findUniqueOrThrow({ where: { id: cancelRun.id } });
    expect(cancelledRun.status).toBe("CANCELLED");
    // Partial leads from the first batch survived the cancel.
    const cancelLeads = await db.lead.count({ where: { campaignId: campaign.id, businessName: { startsWith: "Cancel Biz" } } });
    expect(cancelLeads).toBeGreaterThanOrEqual(2);

    // ── Step 12: archive the campaign → drops out of the default list ────
    const campaignRoute = await import("../../apps/web/app/api/campaigns/[id]/route.js");
    await campaignRoute.PUT(
      req(`/api/campaigns/${campaign.id}`, { method: "PUT", body: { status: "ARCHIVED" } }),
      { params: Promise.resolve({ id: campaign.id }) },
    );
    const archived = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(archived.status).toBe("ARCHIVED");
    // Default list view = ACTIVE campaigns only.
    const activeOnly = await db.campaign.findMany({ where: { status: "ACTIVE", name: { startsWith: TEST_FLOW_PREFIX } } });
    expect(activeOnly.find((c) => c.id === campaign.id)).toBeUndefined();
  });
});
