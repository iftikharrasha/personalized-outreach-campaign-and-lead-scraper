import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { notes, auditNote } = body as { notes?: string; auditNote?: string };
  if (notes !== undefined && typeof notes !== "string")
    return NextResponse.json({ error: "notes must be a string" }, { status: 422 });

  const existing = await db.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextNotes = notes?.trim() ? notes.trim() : null;

  const updated = await db.lead.update({
    where: { id },
    data:  { notes: nextNotes },
  });

  // Audit trail — only when the note text actually changed
  if (nextNotes !== existing.notes) {
    await db.leadHistory.create({
      data: {
        leadId: id,
        note:   auditNote?.trim() || "Notes updated",
      },
    });
  }

  return NextResponse.json(updated);
}
