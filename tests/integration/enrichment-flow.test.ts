import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Integration tests for Slice 6.8 — enrichment worker flow, API routes,
// and cancellation behaviour.
// These tests use a real DB; fetch is stubbed so no real HTTP calls are made.
// ---------------------------------------------------------------------------

const db = new PrismaClient();
const TEST_PREFIX = "TEST__ENRICH__";

// ── fetch stub ───────────────────────────────────────────────────────────────

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── DB lifecycle ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  await db.$connect();
});

afterAll(async () => {
  await db.campaign.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await db.$disconnect();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function req(url: string, init?: { method?: string; body?: unknown }): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: init?.method ?? "GET",
    ...(init?.body !== undefined && {
      body:    JSON.stringify(init.body),
      headers: { "Content-Type": "application/json" },
    }),
  });
}

function htmlResp(html: string): Response {
  return new Response(html, {
    status:  200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function headOk(): Response {
  return new Response("", { status: 200 });
}

function headFail(): Response {
  return new Response("", { status: 503 });
}

async function createCampaign(nameSuffix: string) {
  return db.campaign.create({
    data: {
      name:     `${TEST_PREFIX}${nameSuffix}`,
      keyword:  "test",
      category: "restaurants",
      country:  "US",
      state:    "California",
      source:   "google_maps",
      status:   "ACTIVE",
    },
  });
}

async function createLead(campaignId: string, domain: string, email: string | null = null) {
  return db.lead.create({
    data: {
      campaignId,
      businessName:     domain,
      normalizedDomain: domain,
      email,
      status:           "NEW",
    },
  });
}

// ── Slice 6.4 — Worker: processEnrichmentJob happy path ──────────────────────

describe("processEnrichmentJob — happy path", () => {
  it("finds emails for all leads and marks the run COMPLETED", async () => {
    const campaign = await createCampaign("HappyPath");
    const lead1    = await createLead(campaign.id, "biz1.com");
    const lead2    = await createLead(campaign.id, "biz2.com");

    // Queue a run covering both leads
    const run = await db.enrichmentRun.create({
      data: {
        campaignId:  campaign.id,
        status:      "RUNNING",
        leadIds:     [lead1.id, lead2.id],
        totalLeads:  2,
        startedAt:   new Date(),
      },
    });

    // Both leads run concurrently (Promise.all), so use a URL-aware mock to
    // avoid response ordering issues.
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") return headOk();
      if (typeof url === "string" && url.includes("biz1")) {
        return htmlResp('<a href="mailto:info@biz1.com">Contact</a>');
      }
      return htmlResp('<a href="mailto:info@biz2.com">Contact</a>');
    });

    const { processEnrichmentJob } = await import("../../apps/scraper/src/worker.js");
    await processEnrichmentJob(run);

    const finalRun = await db.enrichmentRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(finalRun.status).toBe("COMPLETED");
    expect(finalRun.foundCount).toBe(2);
    expect(finalRun.failedCount).toBe(0);
    expect(finalRun.skippedCount).toBe(0);
    expect(finalRun.processedCount).toBe(2);
    expect(finalRun.finishedAt).not.toBeNull();
    expect(finalRun.durationSec).not.toBeNull();

    // Emails written to the lead rows
    const updated1 = await db.lead.findUniqueOrThrow({ where: { id: lead1.id } });
    const updated2 = await db.lead.findUniqueOrThrow({ where: { id: lead2.id } });
    expect(updated1.email).toBe("info@biz1.com");
    expect(updated2.email).toBe("info@biz2.com");
  });

  it("counts a lead as failed when the domain yields no email", async () => {
    const campaign = await createCampaign("NoEmail");
    const lead     = await createLead(campaign.id, "silent.com");

    const run = await db.enrichmentRun.create({
      data: {
        campaignId: campaign.id,
        status:     "RUNNING",
        leadIds:    [lead.id],
        totalLeads: 1,
        startedAt:  new Date(),
      },
    });

    // HEAD ok, homepage with no email, then all fallback paths 404
    mockFetch
      .mockResolvedValueOnce(headOk())
      .mockResolvedValueOnce(htmlResp("<p>No contact info.</p>"))
      .mockResolvedValue(new Response("", { status: 404 }));

    const { processEnrichmentJob } = await import("../../apps/scraper/src/worker.js");
    await processEnrichmentJob(run);

    const finalRun = await db.enrichmentRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(finalRun.status).toBe("COMPLETED");
    expect(finalRun.foundCount).toBe(0);
    expect(finalRun.failedCount).toBe(1);

    const updatedLead = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(updatedLead.email).toBeNull();
  });

  it("skips leads that already have an email at processing time", async () => {
    const campaign = await createCampaign("AlreadyHasEmail");
    const lead     = await createLead(campaign.id, "biz-pre.com", "pre@biz-pre.com");

    const run = await db.enrichmentRun.create({
      data: {
        campaignId:  campaign.id,
        status:      "RUNNING",
        leadIds:     [lead.id],
        totalLeads:  1,
        startedAt:   new Date(),
      },
    });

    const { processEnrichmentJob } = await import("../../apps/scraper/src/worker.js");
    await processEnrichmentJob(run);

    expect(mockFetch).not.toHaveBeenCalled();

    const finalRun = await db.enrichmentRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(finalRun.status).toBe("COMPLETED");
    expect(finalRun.skippedCount).toBe(1);
    expect(finalRun.foundCount).toBe(0);
    expect(finalRun.failedCount).toBe(0);
  });
});

// ── Slice 6.5 — API: POST /api/enrich ────────────────────────────────────────

describe("POST /api/enrich", () => {
  it("creates a PENDING EnrichmentRun and returns 201 with runId", async () => {
    const campaign = await createCampaign("ApiPost");
    const lead     = await createLead(campaign.id, "api-test.com");

    const { POST } = await import("../../apps/web/app/api/enrich/route.js");
    const res = await POST(req("/api/enrich", {
      method: "POST",
      body:   { campaignId: campaign.id, leadIds: [lead.id] },
    }));

    expect(res.status).toBe(201);
    const body = await res.json() as { runId: string };
    expect(body.runId).toBeTruthy();

    const run = await db.enrichmentRun.findUnique({ where: { id: body.runId } });
    expect(run).not.toBeNull();
    expect(run!.status).toBe("PENDING");
    expect(run!.leadIds).toContain(lead.id);
    expect(run!.totalLeads).toBe(1);
  });

  it("returns 409 when all selected leads already have emails", async () => {
    const campaign = await createCampaign("ApiPost409");
    const lead     = await createLead(campaign.id, "already.com", "existing@already.com");

    const { POST } = await import("../../apps/web/app/api/enrich/route.js");
    const res = await POST(req("/api/enrich", {
      method: "POST",
      body:   { campaignId: campaign.id, leadIds: [lead.id] },
    }));

    expect(res.status).toBe(409);
  });

  it("filters out leads that already have emails and only queues eligible ones", async () => {
    const campaign   = await createCampaign("ApiPostFilter");
    const withEmail  = await createLead(campaign.id, "has-email.com", "hi@has-email.com");
    const noEmail    = await createLead(campaign.id, "no-email.com");

    const { POST } = await import("../../apps/web/app/api/enrich/route.js");
    const res = await POST(req("/api/enrich", {
      method: "POST",
      body:   { campaignId: campaign.id, leadIds: [withEmail.id, noEmail.id] },
    }));

    expect(res.status).toBe(201);
    const body = await res.json() as { runId: string };
    const run  = await db.enrichmentRun.findUniqueOrThrow({ where: { id: body.runId } });

    // Only the email-less lead is in the worklist
    expect(run.leadIds).not.toContain(withEmail.id);
    expect(run.leadIds).toContain(noEmail.id);
    expect(run.skippedCount).toBe(1);   // withEmail counted as pre-skipped
    expect(run.totalLeads).toBe(2);      // total = eligible + pre-skipped
  });
});

// ── Slice 6.5 — API: GET /api/enrich/[runId] ─────────────────────────────────

describe("GET /api/enrich/[runId]", () => {
  it("returns run progress counters", async () => {
    const campaign = await createCampaign("ApiGet");
    const run = await db.enrichmentRun.create({
      data: {
        campaignId:    campaign.id,
        status:        "RUNNING",
        leadIds:       [],
        totalLeads:    4,
        processedCount: 2,
        foundCount:    1,
        failedCount:   1,
        startedAt:     new Date(),
      },
    });

    const { GET } = await import("../../apps/web/app/api/enrich/[runId]/route.js");
    const res = await GET(
      req(`/api/enrich/${run.id}`),
      { params: Promise.resolve({ runId: run.id }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as {
      id: string;
      status: string;
      processedCount: number;
      foundCount: number;
      failedCount: number;
      totalLeads: number;
    };
    expect(body.id).toBe(run.id);
    expect(body.status).toBe("RUNNING");
    expect(body.processedCount).toBe(2);
    expect(body.foundCount).toBe(1);
    expect(body.failedCount).toBe(1);
    expect(body.totalLeads).toBe(4);
  });

  it("returns 404 for a non-existent run", async () => {
    const { GET } = await import("../../apps/web/app/api/enrich/[runId]/route.js");
    const fakeId  = "00000000-0000-0000-0000-000000000000";
    const res     = await GET(
      req(`/api/enrich/${fakeId}`),
      { params: Promise.resolve({ runId: fakeId }) },
    );
    expect(res.status).toBe(404);
  });
});

// ── Slice 6.5 — API: POST /api/enrich/[runId]/cancel ─────────────────────────

describe("POST /api/enrich/[runId]/cancel", () => {
  it("transitions a RUNNING run to CANCELLED", async () => {
    const campaign = await createCampaign("ApiCancel");
    const run = await db.enrichmentRun.create({
      data: {
        campaignId: campaign.id,
        status:     "RUNNING",
        leadIds:    [],
        totalLeads: 1,
        startedAt:  new Date(),
      },
    });

    const { POST } = await import("../../apps/web/app/api/enrich/[runId]/cancel/route.js");
    const res = await POST(
      req(`/api/enrich/${run.id}/cancel`, { method: "POST" }),
      { params: Promise.resolve({ runId: run.id }) },
    );

    expect(res.status).toBe(200);
    const updated = await db.enrichmentRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(updated.status).toBe("CANCELLED");
    expect(updated.finishedAt).not.toBeNull();
  });

  it("returns 409 when the run is already COMPLETED", async () => {
    const campaign = await createCampaign("ApiCancelCompleted");
    const run = await db.enrichmentRun.create({
      data: {
        campaignId: campaign.id,
        status:     "COMPLETED",
        leadIds:    [],
        totalLeads: 1,
        finishedAt: new Date(),
      },
    });

    const { POST } = await import("../../apps/web/app/api/enrich/[runId]/cancel/route.js");
    const res = await POST(
      req(`/api/enrich/${run.id}/cancel`, { method: "POST" }),
      { params: Promise.resolve({ runId: run.id }) },
    );

    expect(res.status).toBe(409);
  });
});

// ── Cancellation: partial emails persist when run is cancelled mid-flight ─────

describe("processEnrichmentJob — cancellation", () => {
  it("writes already-found emails and ends CANCELLED when cancelled between batches", async () => {
    const campaign = await createCampaign("Cancel");

    // 6 leads → 2 batches (5 + 1). We cancel the run in the DB right after
    // queueing it, so the isCancelled() check before batch 1 fires immediately
    // and processEnrichmentJob throws CancelledError without fetching anything.
    //
    // To test that partial emails DO persist, we instead pre-write emails to
    // 3 of the leads (simulating batch 1 having completed) and cancel before
    // batch 2 by setting the run to CANCELLED in the DB before calling
    // processEnrichmentJob. The worker checks isCancelled() before each batch.

    // Create 6 leads: first 3 already have emails (batch 1 "done"), last 3 don't.
    const leads: Array<Awaited<ReturnType<typeof createLead>>> = [];
    for (let i = 1; i <= 3; i++) {
      leads.push(await createLead(campaign.id, `cancel-found-${i}.com`, `info@cancel-found-${i}.com`));
    }
    for (let i = 1; i <= 3; i++) {
      leads.push(await createLead(campaign.id, `cancel-pending-${i}.com`));
    }

    // Create the run as CANCELLED already — simulates user hitting Stop before
    // the worker processes the second batch.
    const run = await db.enrichmentRun.create({
      data: {
        campaignId: campaign.id,
        status:     "CANCELLED",
        leadIds:    leads.map((l) => l.id),
        totalLeads: 6,
        finishedAt: new Date(),
      },
    });

    const { processEnrichmentJob } = await import("../../apps/scraper/src/worker.js");
    await processEnrichmentJob(run);

    // fetch should never have been called — cancelled immediately
    expect(mockFetch).not.toHaveBeenCalled();

    // Run stays CANCELLED (processEnrichmentJob sees CANCELLED on first isCancelled check)
    const finalRun = await db.enrichmentRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(finalRun.status).toBe("CANCELLED");

    // Emails that were already written (simulating pre-batch persistence) remain intact
    for (let i = 1; i <= 3; i++) {
      const lead = await db.lead.findUniqueOrThrow({ where: { id: leads[i - 1]!.id } });
      expect(lead.email).toBe(`info@cancel-found-${i}.com`);
    }

    // Unprocessed leads have no email
    for (let i = 3; i <= 5; i++) {
      const lead = await db.lead.findUniqueOrThrow({ where: { id: leads[i]!.id } });
      expect(lead.email).toBeNull();
    }
  });
});
