import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth(); // 0-based

  // ── Funnel counts ─────────────────────────────────────────────────────────
  const leadGroups = await db.lead.groupBy({
    by:     ["status"],
    _count: { _all: true },
  });
  const byStatus: Record<string, number> = {};
  for (const g of leadGroups) byStatus[g.status] = g._count._all;

  const totalLeads = Object.values(byStatus).reduce((s, n) => s + n, 0);
  const contacted  = (byStatus["CONTACTED"] ?? 0) + (byStatus["REPLIED"] ?? 0) + (byStatus["CLOSED"] ?? 0);
  const replied    = (byStatus["REPLIED"] ?? 0) + (byStatus["CLOSED"] ?? 0);
  const closed     = byStatus["CLOSED"] ?? 0;

  // ── Earnings ─────────────────────────────────────────────────────────────
  const closedLeads = await db.lead.findMany({
    where:  { status: "CLOSED" },
    select: { raised: true, createdAt: true },
  });
  const totalEarned = closedLeads.reduce((s, l) => s + (l.raised ?? 0), 0);
  const avgDeal     = closed > 0 ? Math.round(totalEarned / closed) : 0;

  // This-month earnings
  const thisMonthStart = new Date(year, month, 1);
  const thisMonthEarned = closedLeads
    .filter((l) => new Date(l.createdAt) >= thisMonthStart)
    .reduce((s, l) => s + (l.raised ?? 0), 0);

  // 6-month trend (label = "Jan", "Feb" … current month)
  const monthlyTrend: { month: string; earned: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(year, month - i, 1);
    const end = new Date(year, month - i + 1, 1);
    const label = d.toLocaleString("default", { month: "short" });
    const earned = closedLeads
      .filter((l) => {
        const t = new Date(l.createdAt);
        return t >= d && t < end;
      })
      .reduce((s, l) => s + (l.raised ?? 0), 0);
    monthlyTrend.push({ month: label, earned });
  }

  // ── Campaign health ───────────────────────────────────────────────────────
  const runs = await db.scrapeRun.findMany({
    select: { durationSec: true, duplicateCount: true, status: true, errorMessage: true },
  });
  const completedRuns  = runs.filter((r) => r.status === "COMPLETED");
  const totalRunSec    = completedRuns.reduce((s, r) => s + (r.durationSec ?? 0), 0);
  const avgDurationSec = completedRuns.length > 0 ? Math.round(totalRunSec / completedRuns.length) : null;
  const avgDupes       = completedRuns.length > 0
    ? Math.round(completedRuns.reduce((s, r) => s + r.duplicateCount, 0) / completedRuns.length)
    : null;
  const hasBlock       = runs.some((r) => r.status === "FAILED" && r.errorMessage?.toLowerCase().includes("blocked"));
  const totalRunCount  = runs.length;

  // ── Campaign count ────────────────────────────────────────────────────────
  const campaignCount = await db.campaign.count();

  return NextResponse.json({
    funnel: { totalLeads, contacted, replied, closed, campaignCount },
    earnings: { totalEarned, avgDeal, thisMonthEarned, monthlyTrend },
    health: { totalRunCount, avgDurationSec, avgDupes, hasBlock },
  });
}
