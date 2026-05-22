import { db } from "@/lib/db";
import { LeadStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { status, notes, email, businessName, phone, websiteUrl, address } = body;

  if (status && !Object.values(LeadStatus).includes(status))
    return NextResponse.json({ error: "invalid status" }, { status: 422 });

  const existing = await db.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.lead.update({
    where: { id },
    data: {
      ...(status       !== undefined && { status }),
      ...(notes        !== undefined && { notes }),
      ...(email        !== undefined && { email }),
      ...(businessName !== undefined && { businessName }),
      ...(phone        !== undefined && { phone }),
      ...(websiteUrl   !== undefined && { websiteUrl }),
      ...(address      !== undefined && { address }),
    },
  });

  if (status !== undefined && status !== existing.status) {
    await db.leadHistory.create({
      data: {
        leadId: id,
        previousStatus: existing.status,
        newStatus: status,
      },
    });
  }
  if (notes !== undefined && notes !== existing.notes) {
    await db.leadHistory.create({
      data: { leadId: id, note: notes },
    });
  }

  return NextResponse.json(updated);
}
