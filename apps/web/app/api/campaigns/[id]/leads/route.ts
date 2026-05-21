import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leads = await db.lead.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(leads);
}
