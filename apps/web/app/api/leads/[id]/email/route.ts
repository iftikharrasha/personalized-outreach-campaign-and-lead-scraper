import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { email } = body as { email?: string };
  if (email !== undefined && typeof email !== "string")
    return NextResponse.json({ error: "email must be a string" }, { status: 422 });

  const trimmed = email?.trim() ?? "";
  // Empty string clears the email; a non-empty value must be a valid format.
  if (trimmed && !EMAIL_RE.test(trimmed))
    return NextResponse.json({ error: "invalid email format" }, { status: 422 });

  const existing = await db.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.lead.update({
    where: { id },
    data:  { email: trimmed || null },
  });

  return NextResponse.json(updated);
}
