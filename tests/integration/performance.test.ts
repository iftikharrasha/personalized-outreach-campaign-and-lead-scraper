import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

// Slice 5.4 — performance pass. Seeds 1000 leads in one campaign and asserts
// the server-side endpoints that back the leads table stay within budget:
//   - leads list (the detail page's main query)   < 1000 ms
//   - search query                                <  300 ms
//   - CSV export of all 1000 rows                 < 5000 ms
// Index coverage: leads(campaignId), leads(status), leads(normalizedDomain),
// leads(normalizedPhone) already exist in schema.prisma — sufficient here.

const db = new PrismaClient();
const TEST_PREFIX = "TEST__PERF__";

let campaignId: string;

function req(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`);
}

beforeAll(async () => {
  await db.$connect();
  const campaign = await db.campaign.create({
    data: {
      name:     `${TEST_PREFIX}Perf`,
      keyword:  "perf leads",
      category: "restaurants",
      country:  "US",
      state:    "California",
      source:   "google_maps",
      status:   "ACTIVE",
    },
  });
  campaignId = campaign.id;

  // Seed 1000 leads in one createMany call.
  await db.lead.createMany({
    data: Array.from({ length: 1000 }, (_, i) => ({
      campaignId,
      businessName:     `Perf Biz ${i + 1}`,
      normalizedDomain: `perf-biz-${i + 1}.com`,
      normalizedPhone:  `444${String(i + 1).padStart(7, "0")}`,
      websiteUrl:       `https://perf-biz-${i + 1}.com`,
      phone:            `444${String(i + 1).padStart(7, "0")}`,
      status:           i % 3 === 0 ? "CONTACTED" : "NEW",
    })),
  });
}, 30000);

afterAll(async () => {
  await db.campaign.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await db.$disconnect();
});

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const start = performance.now();
  const value = await fn();
  return { ms: performance.now() - start, value };
}

describe("performance with 1000 leads (Slice 5.4)", () => {
  it("leads list query returns all 1000 rows in under 1 s", async () => {
    const leadsRoute = await import("../../apps/web/app/api/campaigns/[id]/leads/route.js");
    const { ms, value } = await timed(() =>
      leadsRoute.GET(req(`/api/campaigns/${campaignId}/leads`), {
        params: Promise.resolve({ id: campaignId }),
      }).then((r) => r.json() as Promise<unknown[]>),
    );
    expect(value).toHaveLength(1000);
    expect(ms).toBeLessThan(1000);
  });

  it("search query responds in under 300 ms", async () => {
    const leadsRoute = await import("../../apps/web/app/api/campaigns/[id]/leads/route.js");
    const { ms, value } = await timed(() =>
      leadsRoute.GET(req(`/api/campaigns/${campaignId}/leads?q=Perf%20Biz%20500`), {
        params: Promise.resolve({ id: campaignId }),
      }).then((r) => r.json() as Promise<unknown[]>),
    );
    // "Perf Biz 500" substring-matches exactly one lead.
    expect(value.length).toBeGreaterThanOrEqual(1);
    expect(ms).toBeLessThan(300);
  });

  it("status filter query responds quickly", async () => {
    const leadsRoute = await import("../../apps/web/app/api/campaigns/[id]/leads/route.js");
    const { ms, value } = await timed(() =>
      leadsRoute.GET(req(`/api/campaigns/${campaignId}/leads?status=CONTACTED`), {
        params: Promise.resolve({ id: campaignId }),
      }).then((r) => r.json() as Promise<unknown[]>),
    );
    // Every 3rd lead is CONTACTED → ~334 of 1000.
    expect(value.length).toBeGreaterThan(300);
    expect(ms).toBeLessThan(500);
  });

  it("CSV export of all 1000 rows finishes in under 5 s", async () => {
    const exportRoute = await import("../../apps/web/app/api/campaigns/[id]/export/route.js");
    const { ms, value } = await timed(async () => {
      const res = await exportRoute.GET(req(`/api/campaigns/${campaignId}/export?scope=all`), {
        params: Promise.resolve({ id: campaignId }),
      });
      return res.text();
    });
    const lines = value.trim().split("\r\n");
    expect(lines).toHaveLength(1001); // header + 1000 leads
    expect(ms).toBeLessThan(5000);
  });
});
