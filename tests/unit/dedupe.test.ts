import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RawLead } from "../../apps/scraper/src/google-maps.js";

// ---------------------------------------------------------------------------
// Mock the DB and shared normalizers so this stays a pure unit test.
// The real DB-level dedupe is covered in tests/integration/scraper-flow.test.ts
// ---------------------------------------------------------------------------

// Capture the leads that would be inserted
const insertedBatches: unknown[][] = [];
const runUpdates: unknown[] = [];
const campaignUpdates: unknown[] = [];

vi.mock("../../apps/scraper/src/db.js", () => {
  const createMany = vi.fn(async ({ data }: { data: unknown[] }) => {
    insertedBatches.push([...data]);
    return { count: data.length };
  });
  const scrapeRunUpdate = vi.fn(async (args: unknown) => { runUpdates.push(args); return {}; });
  const campaignUpdate  = vi.fn(async (args: unknown) => { campaignUpdates.push(args); return {}; });

  return {
    db: {
      lead: {
        findMany:   vi.fn(async () => []),
        createMany: createMany,
      },
      scrapeRun: {
        update:     scrapeRunUpdate,
        findUnique: vi.fn(async () => ({ status: "RUNNING" })), // never cancelled in unit tests
      },
      campaign:  { update: campaignUpdate  },
      $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    },
  };
});

// Import after mocks are registered
const { runDedupe } = await import("../../apps/scraper/src/dedupe.js");

const fakeJob = {
  id:         "run-1",
  campaignId: "campaign-1",
  keywordUsed: "test",
  status:     "RUNNING",
  newLeadsCount:  0,
  duplicateCount: 0,
  durationSec:    null,
  errorMessage:   null,
  startedAt:      null,
  finishedAt:     null,
  createdAt:      new Date(),
} as const;

function makeRaw(overrides: Partial<RawLead> = {}): RawLead {
  return {
    businessName: "Test Biz",
    websiteUrl:   "https://testbiz.com",
    phone:        "(555) 123-4567",
    address:      "123 Main St",
    ...overrides,
  };
}

describe("runDedupe", () => {
  beforeEach(() => {
    insertedBatches.length = 0;
    runUpdates.length      = 0;
    campaignUpdates.length = 0;
  });

  it("inserts a clean lead with no existing data", async () => {
    const leads = [makeRaw()];
    await runDedupe(leads, fakeJob as never);

    const allInserted = insertedBatches.flat();
    expect(allInserted).toHaveLength(1);
    expect((allInserted[0] as { businessName: string }).businessName).toBe("Test Biz");
  });

  it("skips a lead whose domain matches an existing lead", async () => {
    const { db } = await import("../../apps/scraper/src/db.js");
    vi.mocked(db.lead.findMany).mockResolvedValueOnce([
      { normalizedDomain: "testbiz.com", normalizedPhone: null } as never,
    ]);

    await runDedupe([makeRaw()], fakeJob as never);

    expect(insertedBatches.flat()).toHaveLength(0);
  });

  it("skips a lead whose phone matches an existing lead", async () => {
    const { db } = await import("../../apps/scraper/src/db.js");
    vi.mocked(db.lead.findMany).mockResolvedValueOnce([
      { normalizedDomain: null, normalizedPhone: "5551234567" } as never,
    ]);

    await runDedupe([makeRaw()], fakeJob as never);

    expect(insertedBatches.flat()).toHaveLength(0);
  });

  it("deduplicates within the same batch (intra-batch)", async () => {
    const leads = [
      makeRaw({ businessName: "Biz A", websiteUrl: "https://biza.com" }),
      makeRaw({ businessName: "Biz A duplicate", websiteUrl: "https://biza.com" }),
    ];

    await runDedupe(leads, fakeJob as never);

    const allInserted = insertedBatches.flat();
    expect(allInserted).toHaveLength(1);
    expect((allInserted[0] as { businessName: string }).businessName).toBe("Biz A");
  });

  it("inserts multiple distinct leads", async () => {
    const leads = [
      makeRaw({ businessName: "Biz A", websiteUrl: "https://biza.com", phone: "(555) 111-2222" }),
      makeRaw({ businessName: "Biz B", websiteUrl: "https://bizb.com", phone: "(555) 333-4444" }),
      makeRaw({ businessName: "Biz C", websiteUrl: null,               phone: null              }),
    ];

    await runDedupe(leads, fakeJob as never);

    const allInserted = insertedBatches.flat();
    expect(allInserted).toHaveLength(3);
  });

  it("normalizes domain and phone before insert", async () => {
    const raw = makeRaw({
      websiteUrl: "https://WWW.Example.COM/path?q=1",
      phone:      "+1 (800) 555-0199",
    });

    await runDedupe([raw], fakeJob as never);

    const lead = insertedBatches.flat()[0] as { normalizedDomain: string; normalizedPhone: string };
    expect(lead.normalizedDomain).toBe("example.com");
    expect(lead.normalizedPhone).toBe("18005550199");
  });

  it("updates the campaign totalLeads counter", async () => {
    await runDedupe([makeRaw()], fakeJob as never);

    const update = campaignUpdates.find(
      (u) => (u as { data?: { totalLeads?: unknown } }).data?.totalLeads !== undefined
    );
    expect(update).toBeDefined();
  });
});
