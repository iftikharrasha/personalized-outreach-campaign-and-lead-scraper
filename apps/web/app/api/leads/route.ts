import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? undefined;

  const leads = await db.lead.findMany({
    where:   status ? { status: status as "NEW" | "CONTACTED" | "REPLIED" | "IGNORED" | "CLOSED" } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(leads);
}
