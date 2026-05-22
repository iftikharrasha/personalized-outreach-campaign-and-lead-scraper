import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// POST /api/enrich/[runId]/cancel
// Marks a PENDING or RUNNING enrichment run as CANCELLED.
// The worker checks for CANCELLED between batches and stops gracefully.
// Already-found emails are kept.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  const run = await db.enrichmentRun.findUnique({ where: { id: runId } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (run.status !== "PENDING" && run.status !== "RUNNING") {
    return NextResponse.json({ error: "Run is not active" }, { status: 409 });
  }

  const updated = await db.enrichmentRun.update({
    where: { id: runId },
    data:  { status: "CANCELLED", finishedAt: new Date() },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
