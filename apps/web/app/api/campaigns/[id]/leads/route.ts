import { db } from "@/lib/db";
import { LeadStatus, type Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

// Slice 4.6 — whitelist of sortable columns mapped to Prisma fields.
const SORT_FIELDS: Record<string, keyof Prisma.LeadOrderByWithRelationInput> = {
  name:    "businessName",
  status:  "status",
  updated: "updatedAt",
  created: "createdAt",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const status = sp.get("status")?.trim();
  const sort = sp.get("sort")?.trim() ?? "created";
  const dir = sp.get("dir")?.trim() === "asc" ? "asc" : "desc";

  const where: Prisma.LeadWhereInput = { campaignId: id };

  // Slice 4.4 — server-side search across name / phone / email / notes.
  if (q) {
    where.OR = [
      { businessName: { contains: q, mode: "insensitive" } },
      { phone:        { contains: q, mode: "insensitive" } },
      { email:        { contains: q, mode: "insensitive" } },
      { notes:        { contains: q, mode: "insensitive" } },
    ];
  }

  // Slice 4.5 — status filter.
  if (status && status !== "ALL" && status in LeadStatus) {
    where.status = status as LeadStatus;
  }

  // Slice 4.6 — sortable columns (whitelisted; falls back to createdAt).
  const sortField = SORT_FIELDS[sort] ?? "createdAt";
  const orderBy: Prisma.LeadOrderByWithRelationInput = { [sortField]: dir };

  const leads = await db.lead.findMany({ where, orderBy });
  return NextResponse.json(leads);
}
