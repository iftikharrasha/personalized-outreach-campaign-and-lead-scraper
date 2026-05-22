import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Slice 5.2 — concurrency / race tests against the real DB.
//  1. Two workers race to claim the same PENDING job — exactly one wins.
//  2. Two overlapping createMany inserts run concurrently — no constraint
//     violation bubbles up; the unique index absorbs the collision.

const db = new PrismaClient();
const TEST_PREFIX = "TEST__RACE__";

let campaignId: string;

beforeAll(async () => {
  await db.$connect();
  const campaign = await db.campaign.create({
    data: {
      name:     `${TEST_PREFIX}Race`,
      keyword:  "race test",
      category: "restaurants",
      country:  "US",
      state:    "California",
      source:   "google_maps",
      status:   "ACTIVE",
    },
  });
  campaignId = campaign.id;
});

afterAll(async () => {
  await db.campaign.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await db.$disconnect();
});

// The exact claim SQL the worker uses (FOR UPDATE SKIP LOCKED).
async function claimNextJob(): Promise<string | null> {
  const rows = await db.$queryRaw<{ id: string }[]>`
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
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

describe("job claim race (Slice 5.2)", () => {
  it("two simultaneous claims of one PENDING job — exactly one wins", async () => {
    // Make sure no stray PENDING runs exist so the test is deterministic.
    await db.scrapeRun.deleteMany({ where: { status: "PENDING" } });

    const run = await db.scrapeRun.create({
      data: { campaignId, keywordUsed: "race test", status: "PENDING" },
    });

    // Fire two claim attempts concurrently — simulates two worker processes.
    const [a, b] = await Promise.all([claimNextJob(), claimNextJob()]);

    const winners = [a, b].filter((id) => id === run.id);
    const empties = [a, b].filter((id) => id === null);

    // Exactly one claim returned the run; the other got nothing (SKIP LOCKED).
    expect(winners).toHaveLength(1);
    expect(empties).toHaveLength(1);

    const claimed = await db.scrapeRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(claimed.status).toBe("RUNNING");
  });
});

describe("concurrent insert race (Slice 5.2)", () => {
  it("overlapping createMany inserts do not throw — unique index absorbs dupes", async () => {
    const run = await db.scrapeRun.create({
      data: { campaignId, keywordUsed: "race test", status: "RUNNING", startedAt: new Date() },
    });

    // Two batches that overlap on 5 domains/phones. With skipDuplicates the
    // DB-level unique constraint must absorb the collisions silently.
    const makeBatch = (offset: number, count: number) =>
      Array.from({ length: count }, (_, i) => {
        const n = offset + i;
        return {
          campaignId,
          scrapeRunId:      run.id,
          businessName:     `Race Biz ${n}`,
          normalizedDomain: `race-biz-${n}.com`,
          normalizedPhone:  `777${String(n).padStart(7, "0")}`,
        };
      });

    const batchA = makeBatch(0, 10);   // rows 0–9
    const batchB = makeBatch(5, 10);   // rows 5–14 — overlaps 5–9

    // Run both inserts concurrently. Neither call should reject.
    const results = await Promise.all([
      db.lead.createMany({ data: batchA, skipDuplicates: true }),
      db.lead.createMany({ data: batchB, skipDuplicates: true }),
    ]);

    // Combined the two batches list rows 0–14 = 15 unique leads.
    const total = await db.lead.count({ where: { scrapeRunId: run.id } });
    expect(total).toBe(15);

    // The two createMany counts sum to 15 (the overlap was skipped on one side).
    const insertedSum = results[0]!.count + results[1]!.count;
    expect(insertedSum).toBe(15);
  });

  it("a duplicate insert against an existing lead is skipped, not thrown", async () => {
    const run = await db.scrapeRun.create({
      data: { campaignId, keywordUsed: "race test", status: "RUNNING", startedAt: new Date() },
    });

    // Seed one lead.
    await db.lead.create({
      data: {
        campaignId,
        scrapeRunId:      run.id,
        businessName:     "Race Dupe",
        normalizedDomain: "race-dupe.com",
        normalizedPhone:  "7770000999",
      },
    });

    // Insert a batch containing that exact domain again — must not throw.
    const result = await db.lead.createMany({
      data: [
        { campaignId, scrapeRunId: run.id, businessName: "Race Dupe Again", normalizedDomain: "race-dupe.com", normalizedPhone: "7770000998" },
        { campaignId, scrapeRunId: run.id, businessName: "Race Fresh",      normalizedDomain: "race-fresh.com", normalizedPhone: "7770000997" },
      ],
      skipDuplicates: true,
    });

    // Only the fresh row landed; the colliding domain was skipped.
    expect(result.count).toBe(1);
  });
});
