import { db } from "@/lib/db";
import { LeadStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { status } = body;
  if (!status || !Object.values(LeadStatus).includes(status))
    return NextResponse.json({ error: "valid status is required" }, { status: 422 });

  const existing = await db.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.lead.update({
    where: { id },
    data:  { status },
  });

  // Audit trail — only when the status actually changed
  if (status !== existing.status) {
    await db.leadHistory.create({
      data: {
        leadId:         id,
        previousStatus: existing.status,
        newStatus:      status,
      },
    });
  }

  return NextResponse.json(updated);
}
