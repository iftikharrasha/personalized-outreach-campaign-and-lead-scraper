import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/enrich/[runId]
// Returns run status for polling. Shape mirrors the scrape status endpoint.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  const run = await db.enrichmentRun.findUnique({ where: { id: runId } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id:             run.id,
    status:         run.status,
    totalLeads:     run.totalLeads,
    processedCount: run.processedCount,
    foundCount:     run.foundCount,
    failedCount:    run.failedCount,
    skippedCount:   run.skippedCount,
    startedAt:      run.startedAt,
    finishedAt:     run.finishedAt,
    errorMessage:   run.errorMessage,
  });
}
