import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  }

  const { campaignId, replaceAll } = body as { campaignId: string; replaceAll?: boolean };

  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status === "ARCHIVED") {
    return NextResponse.json({ error: "Cannot run an archived campaign" }, { status: 422 });
  }

  // Check for an already-active run
  const activeRun = await db.scrapeRun.findFirst({
    where: { campaignId, status: { in: ["PENDING", "RUNNING"] } },
  });
  if (activeRun) {
    return NextResponse.json({ error: "A run is already in progress", runId: activeRun.id }, { status: 409 });
  }

  if (replaceAll) {
    await db.lead.deleteMany({ where: { campaignId } });
    await db.campaign.update({ where: { id: campaignId }, data: { totalLeads: 0 } });
  }

  const run = await db.scrapeRun.create({
    data: {
      campaignId,
      keywordUsed: campaign.keyword,
      status:      "PENDING",
    },
  });

  return NextResponse.json({ runId: run.id }, { status: 201 });
}
