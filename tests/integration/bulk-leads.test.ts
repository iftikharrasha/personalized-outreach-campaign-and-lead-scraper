import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Slice 4.9 — bulk status update and bulk delete.
// These exercise the same DB operations the /api/leads/bulk-status and
// /api/leads/bulk route handlers perform, including lead_history audit rows.

const db = new PrismaClient();
const TEST_PREFIX = "TEST__BULK__";

let campaignId: string;

beforeAll(async () => {
  await db.$connect();
  const campaign = await db.campaign.create({
    data: {
      name:     `${TEST_PREFIX}Bulk Ops`,
      keyword:  "bulk test",
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

// Monotonic counter guarantees globally-unique normalized domain/phone values
// so seeded leads never collide on the campaign-scoped unique constraints.
let seedCounter = 0;

async function seedLeads(count: number, prefix: string): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const n = ++seedCounter;
    const lead = await db.lead.create({
      data: {
        campaignId,
        businessName:     `${prefix} ${i + 1}`,
        normalizedDomain: `${prefix.toLowerCase()}-${n}.com`,
        normalizedPhone:  String(900000000 + n),
        status:           "NEW",
      },
    });
    ids.push(lead.id);
  }
  return ids;
}

describe("bulk status update (Slice 4.9)", () => {
  it("updates many leads and writes one audit row per changed lead", async () => {
    const ids = await seedLeads(4, "BulkStatus");

    // Mirror the route handler: read existing → updateMany → createMany history
    const existing = await db.lead.findMany({
      where:  { id: { in: ids } },
      select: { id: true, status: true },
    });

    const result = await db.lead.updateMany({
      where: { id: { in: ids } },
      data:  { status: "CONTACTED" },
    });
    expect(result.count).toBe(4);

    const changed = existing.filter((l) => l.status !== "CONTACTED");
    await db.leadHistory.createMany({
      data: changed.map((l) => ({
        leadId:         l.id,
        previousStatus: l.status,
        newStatus:      "CONTACTED" as const,
      })),
    });

    // All four leads are now CONTACTED
    const updated = await db.lead.findMany({ where: { id: { in: ids } } });
    expect(updated.every((l) => l.status === "CONTACTED")).toBe(true);

    // One audit row per lead, with the correct previous/new status
    const history = await db.leadHistory.findMany({ where: { leadId: { in: ids } } });
    expect(history).toHaveLength(4);
    expect(history.every((h) => h.previousStatus === "NEW" && h.newStatus === "CONTACTED")).toBe(true);
  });
});

describe("bulk delete (Slice 4.9)", () => {
  it("deletes selected leads and cascades their history", async () => {
    const ids = await seedLeads(3, "BulkDelete");

    // Give one lead a history row to prove the cascade works
    await db.leadHistory.create({ data: { leadId: ids[0]!, note: "seed note" } });

    const deleted = await db.lead.deleteMany({ where: { id: { in: ids } } });
    expect(deleted.count).toBe(3);

    const remaining = await db.lead.findMany({ where: { id: { in: ids } } });
    expect(remaining).toHaveLength(0);

    // lead_history rows for the deleted leads cascaded away
    const orphanHistory = await db.leadHistory.findMany({ where: { leadId: { in: ids } } });
    expect(orphanHistory).toHaveLength(0);
  });

  it("keeps the campaign totalLeads counter accurate after delete", async () => {
    // Reset counter to a known value, seed leads, then delete and decrement
    await db.campaign.update({ where: { id: campaignId }, data: { totalLeads: 10 } });

    const ids = await seedLeads(3, "BulkCount");
    await db.lead.deleteMany({ where: { id: { in: ids } } });
    await db.campaign.update({
      where: { id: campaignId },
      data:  { totalLeads: { decrement: 3 } },
    });

    const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(campaign.totalLeads).toBe(7);
  });
});
