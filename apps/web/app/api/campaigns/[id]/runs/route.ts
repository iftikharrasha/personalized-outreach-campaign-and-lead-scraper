import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const runs = await db.scrapeRun.findMany({
    where:   { campaignId: id },
    orderBy: { createdAt: "desc" },
    take:    50,
  });

  return NextResponse.json(runs);
}
