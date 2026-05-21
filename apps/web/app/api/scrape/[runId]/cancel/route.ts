import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Marks a PENDING or RUNNING run as CANCELLED.
// The worker checks for CANCELLED status after each batch and stops gracefully.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  const run = await db.scrapeRun.findUnique({ where: { id: runId } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (run.status !== "PENDING" && run.status !== "RUNNING") {
    return NextResponse.json({ error: "Run is not active" }, { status: 409 });
  }

  const updated = await db.scrapeRun.update({
    where: { id: runId },
    data:  { status: "CANCELLED", finishedAt: new Date() },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
