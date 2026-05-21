import { db } from "@/lib/db";
import { CampaignStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const campaigns = await db.campaign.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { name, keyword, category, country, state, city, notifyEmail } = body;

  if (!name?.trim() || name.trim().length > 255)
    return NextResponse.json({ error: "name is required (max 255 chars)" }, { status: 422 });
  if (!keyword?.trim() || keyword.trim().length > 500)
    return NextResponse.json({ error: "keyword is required (max 500 chars)" }, { status: 422 });
  if (!country?.trim() || !state?.trim())
    return NextResponse.json({ error: "country and state are required" }, { status: 422 });
  if (notifyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail.trim()))
    return NextResponse.json({ error: "notifyEmail must be a valid email" }, { status: 422 });

  const campaign = await db.campaign.create({
    data: {
      name: name.trim(),
      keyword: keyword.trim(),
      category: category?.trim() ?? "custom",
      country: country.trim(),
      state: state.trim(),
      city: city?.trim() ?? null,
      source: "google_maps",
      status: CampaignStatus.ACTIVE,
      notifyEmail: notifyEmail?.trim() ?? null,
    },
  });

  return NextResponse.json(campaign, { status: 201 });
}
