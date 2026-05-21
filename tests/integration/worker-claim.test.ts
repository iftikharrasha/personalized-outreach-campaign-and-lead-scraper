import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Integration test for the atomic job-claim SQL.
// Requires the real DB — FOR UPDATE SKIP LOCKED cannot be verified with mocks.

const db = new PrismaClient();
const TEST_PREFIX = "TEST__CLAIM__";

let campaignId: string;

beforeAll(async () => {
  await db.$connect();
  const campaign = await db.campaign.create({
    data: {
      name:     `${TEST_PREFIX}Campaign`,
      keyword:  "test keyword",
      category: "test",
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

beforeEach(async () => {
  // Clean up any runs from previous test iterations
  await db.scrapeRun.deleteMany({ where: { campaignId } });
});

async function claimNextJob() {
  const rows = await db.$queryRaw<{ id: string; status: string }[]>`
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
    RETURNING id, status
  `;
  return rows[0] ?? null;
}

describe("worker claim SQL", () => {
  it("returns null when no PENDING runs exist", async () => {
    const job = await claimNextJob();
    expect(job).toBeNull();
  });

  it("claims a PENDING run and transitions it to RUNNING", async () => {
    const run = await db.scrapeRun.create({
      data: {
        campaignId,
        keywordUsed: "test keyword",
        status:      "PENDING",
      },
    });

    const claimed = await claimNextJob();
    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe(run.id);
    expect(claimed!.status).toBe("RUNNING");

    // Confirm the DB row is actually RUNNING
    const updated = await db.scrapeRun.findUnique({ where: { id: run.id } });
    expect(updated!.status).toBe("RUNNING");
    expect(updated!.startedAt).not.toBeNull();
  });

  it("does not claim the same job twice (SKIP LOCKED semantics — sequential)", async () => {
    await db.scrapeRun.create({
      data: { campaignId, keywordUsed: "test keyword", status: "PENDING" },
    });

    const first  = await claimNextJob();
    const second = await claimNextJob(); // row is now RUNNING, not PENDING
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("claims jobs in creation order (FIFO)", async () => {
    const run1 = await db.scrapeRun.create({
      data: { campaignId, keywordUsed: "keyword 1", status: "PENDING" },
    });
    // Small delay so created_at differs
    await new Promise((r) => setTimeout(r, 10));
    await db.scrapeRun.create({
      data: { campaignId, keywordUsed: "keyword 2", status: "PENDING" },
    });

    const claimed = await claimNextJob();
    expect(claimed!.id).toBe(run1.id);
  });
});
