import { db } from "@/lib/db";
import { LeadStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

// Slice 4.9 — bulk status update with a lead_history audit row per lead.
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { ids, status } = body as { ids?: string[]; status?: string };

  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 422 });
  if (!status || !Object.values(LeadStatus).includes(status as LeadStatus))
    return NextResponse.json({ error: "valid status is required" }, { status: 422 });

  // Read current statuses so we can record accurate previous_status audit rows.
  const existing = await db.lead.findMany({
    where:  { id: { in: ids } },
    select: { id: true, status: true },
  });

  const updated = await db.lead.updateMany({
    where: { id: { in: ids } },
    data:  { status: status as LeadStatus },
  });

  // One audit row per lead whose status actually changed.
  const changed = existing.filter((l) => l.status !== status);
  if (changed.length > 0) {
    await db.leadHistory.createMany({
      data: changed.map((l) => ({
        leadId:         l.id,
        previousStatus: l.status,
        newStatus:      status as LeadStatus,
      })),
    });
  }

  return NextResponse.json({ count: updated.count });
}
