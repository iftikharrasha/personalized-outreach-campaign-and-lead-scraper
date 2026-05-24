import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// Returns the most recent 100 scrape runs across all campaigns,
// joined with the campaign name so the dashboard run history table can show it.
export async function GET() {
  const runs = await db.scrapeRun.findMany({
    orderBy: { createdAt: "desc" },
    take:    100,
    include: { campaign: { select: { id: true, name: true } } },
  });

  return NextResponse.json(
    runs.map((r) => ({
      id:           r.id,
      campaignId:   r.campaignId,
      campaign:     r.campaign.name,
      startedAt:    r.startedAt?.toISOString() ?? r.createdAt.toISOString(),
      status:       r.status,
      newLeads:     r.newLeadsCount,
      dupes:        r.duplicateCount,
      durationSec:  r.durationSec,
      error:        r.errorMessage,
    }))
  );
}
