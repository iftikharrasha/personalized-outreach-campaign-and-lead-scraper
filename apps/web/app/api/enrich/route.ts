import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// POST /api/enrich
// Body: { campaignId: string, leadIds: string[] }
// Queues an EnrichmentRun for the given leads.
// Filters out leads that already have an email — those count as skippedCount.
// Returns 409 if all selected leads already have emails.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.campaignId || !Array.isArray(body?.leadIds) || body.leadIds.length === 0) {
    return NextResponse.json({ error: "campaignId and non-empty leadIds required" }, { status: 400 });
  }

  // force=true skips the "already has email" filter — used by Re-find in the modal
  const { campaignId, leadIds, force } = body as { campaignId: string; leadIds: string[]; force?: boolean };

  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status === "ARCHIVED") {
    return NextResponse.json({ error: "Cannot enrich leads on an archived campaign" }, { status: 422 });
  }

  // Load the requested leads and filter to those without an email (skipped when force=true)
  const leads = await db.lead.findMany({
    where:  { id: { in: leadIds }, campaignId },
    select: { id: true, email: true },
  });

  const eligible = force ? leads.map((l) => l.id) : leads.filter((l) => !l.email).map((l) => l.id);
  const skipped  = force ? 0 : leads.length - eligible.length;

  if (eligible.length === 0) {
    return NextResponse.json(
      { error: "All selected leads already have an email", skippedCount: skipped },
      { status: 409 },
    );
  }

  const run = await db.enrichmentRun.create({
    data: {
      campaignId,
      status:       "PENDING",
      leadIds:      eligible,
      totalLeads:   eligible.length + skipped,
      skippedCount: skipped,
    },
  });

  return NextResponse.json({ runId: run.id }, { status: 201 });
}
