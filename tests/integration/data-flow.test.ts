import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PrismaClient();

const TEST_PREFIX = "TEST__";

beforeAll(async () => {
  await db.$connect();
});

afterAll(async () => {
  await db.campaign.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await db.$disconnect();
});

describe("Campaign CRUD data flow", () => {
  let campaignId: string;

  it("creates a campaign (POST shape)", async () => {
    const campaign = await db.campaign.create({
      data: {
        name: `${TEST_PREFIX}Integration Test Campaign`,
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
    expect(campaign.name).toBe(`${TEST_PREFIX}Integration Test Campaign`);
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
