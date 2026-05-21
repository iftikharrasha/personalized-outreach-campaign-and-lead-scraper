import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  const run = await db.scrapeRun.findUnique({ where: { id: runId } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id:             run.id,
    status:         run.status,
    newLeadsCount:  run.newLeadsCount,
    duplicateCount: run.duplicateCount,
    startedAt:      run.startedAt,
    finishedAt:     run.finishedAt,
    errorMessage:   run.errorMessage,
  });
}
