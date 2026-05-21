import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const leads = await db.lead.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(leads);
}
