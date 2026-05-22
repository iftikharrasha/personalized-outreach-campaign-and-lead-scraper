import { db } from "@/lib/db";
import { CampaignStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Slice 4.11 — live stat counts computed in the DB so they always match.
  const grouped = await db.lead.groupBy({
    by:    ["status"],
    where: { campaignId: id },
    _count: { _all: true },
  });
  const byStatus: Record<string, number> = {};
  for (const g of grouped) byStatus[g.status] = g._count._all;

  const total     = Object.values(byStatus).reduce((s, n) => s + n, 0);
  const newCount  = byStatus["NEW"] ?? 0;
  const contacted = (byStatus["CONTACTED"] ?? 0) + (byStatus["REPLIED"] ?? 0) + (byStatus["CLOSED"] ?? 0);
  const replied   = (byStatus["REPLIED"] ?? 0) + (byStatus["CLOSED"] ?? 0);
  const conversion = total > 0 ? Math.round((replied / total) * 100) : 0;

  return NextResponse.json({
    ...campaign,
    stats: { total, new: newCount, contacted, conversion },
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const existing = await db.campaign.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, keyword, category, country, state, city, notifyEmail, status } = body;

  if (name !== undefined && (!name?.trim() || name.trim().length > 255))
    return NextResponse.json({ error: "name must be 1–255 chars" }, { status: 422 });
  if (keyword !== undefined && (!keyword?.trim() || keyword.trim().length > 500))
    return NextResponse.json({ error: "keyword must be 1–500 chars" }, { status: 422 });
  if (notifyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail.trim()))
    return NextResponse.json({ error: "notifyEmail must be a valid email" }, { status: 422 });
  if (status && !Object.values(CampaignStatus).includes(status))
    return NextResponse.json({ error: "invalid status" }, { status: 422 });

  const updated = await db.campaign.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(keyword !== undefined && { keyword: keyword.trim() }),
      ...(category !== undefined && { category: category.trim() }),
      ...(country !== undefined && { country: country.trim() }),
      ...(state !== undefined && { state: state.trim() }),
      ...(city !== undefined && { city: city?.trim() ?? null }),
      ...(notifyEmail !== undefined && { notifyEmail: notifyEmail?.trim() ?? null }),
      ...(status !== undefined && { status }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await db.campaign.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.campaign.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
