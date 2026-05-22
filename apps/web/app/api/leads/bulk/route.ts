import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Slice 4.9 — bulk delete. lead_history rows cascade via the FK onDelete rule.
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { ids } = body as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 422 });

  // Decrement the owning campaign's totalLeads counter to keep it accurate.
  const leads = await db.lead.findMany({
    where:  { id: { in: ids } },
    select: { campaignId: true },
  });
  const perCampaign = new Map<string, number>();
  for (const l of leads) perCampaign.set(l.campaignId, (perCampaign.get(l.campaignId) ?? 0) + 1);

  const deleted = await db.lead.deleteMany({ where: { id: { in: ids } } });

  await Promise.all(
    [...perCampaign.entries()].map(([campaignId, n]) =>
      db.campaign.update({
        where: { id: campaignId },
        data:  { totalLeads: { decrement: n } },
      })
    )
  );

  return NextResponse.json({ count: deleted.count });
}
