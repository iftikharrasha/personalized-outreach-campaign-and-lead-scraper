"use client";
import { cn } from "@/lib/utils";
import { Mail, Sparkles, Square } from "lucide-react";
import * as React from "react";

// ── EnrichmentRunStatus shape (mirrors the API response) ────────────────────

export interface EnrichStatus {
  id:             string;
  status:         "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  totalLeads:     number;
  processedCount: number;
  foundCount:     number;
  failedCount:    number;
  skippedCount:   number;
  startedAt:      string | null;
  finishedAt:     string | null;
  errorMessage:   string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── CounterPip ───────────────────────────────────────────────────────────────

function CounterPip({
  label, value, tone = "ink", sub,
}: {
  label: string;
  value: string | number;
  tone?: "ink" | "positive" | "mute";
  sub?: string;
}) {
  const dot =
    tone === "positive" ? "bg-positive" :
    tone === "mute"     ? "bg-mute"     :
                          "bg-ink dark:bg-d-ink";
  const val =
    tone === "positive" ? "text-positive" :
                          "text-ink dark:text-d-ink";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} />
      <span className="text-mute">{label}</span>
      <span className={cn("font-semibold tabular-nums", val)}>{value}</span>
      {sub && <span className="text-mute text-[11.5px]">· {sub}</span>}
    </span>
  );
}

// ── EnrichmentBanner ─────────────────────────────────────────────────────────
// Shown while an enrichment run is active (PENDING or RUNNING).
// Uses the brand-primary palette so it reads as "discovery", not a warning.

export function EnrichmentBanner({
  run,
  elapsedSec,
  currentLeadName,
  onStop,
}: {
  run: EnrichStatus;
  elapsedSec: number;
  currentLeadName?: string;
  onStop: () => void;
}) {
  const isActive = run.status === "PENDING" || run.status === "RUNNING";
  if (!isActive) return null;

  const isSingle  = run.totalLeads - run.skippedCount <= 1;
  const processed = run.processedCount + run.skippedCount;
  const pct       = run.totalLeads > 0
    ? Math.min(100, Math.round((processed / run.totalLeads) * 100))
    : 0;

  return (
    <div
      className="mt-6 rounded-card bg-primary-pale/70 dark:bg-primary/10 border border-primary/40 px-5 py-4 animate-fadein"
    >
      <div className="flex items-start gap-4">
        {/* Icon badge */}
        <div className="w-11 h-11 rounded-full bg-primary text-ink flex items-center justify-center shrink-0 relative">
          <Mail size={20} />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-ink text-primary flex items-center justify-center">
            <Sparkles size={9} />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Headline row + Stop button */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink dark:text-d-ink">
                {isSingle
                  ? <>Searching for {currentLeadName || "lead"}&apos;s email…</>
                  : <>Email searching across <span className="tabular-nums">{run.totalLeads}</span> leads…</>}
              </div>
              <div className="text-[12.5px] text-body dark:text-d-body mt-0.5">
                {currentLeadName && !isSingle
                  ? <>Now fetching <span className="text-ink dark:text-d-ink font-medium">{currentLeadName}</span></>
                  : <>Walking homepage → contact pages · stopping at first verified address</>}
              </div>
            </div>

            {/* Stop button — timer lives inside */}
            <button
              onClick={onStop}
              className="shrink-0 inline-flex items-center gap-2 bg-ink hover:bg-ink/90 text-canvas rounded-full pl-3 pr-1 py-1 text-[13px] font-semibold transition-colors"
              title="Cancel enrichment. Already-found emails are kept."
            >
              <Square size={13} />
              Stop
              <span className="ml-1 inline-flex items-center gap-1 bg-canvas/15 px-2 py-0.5 rounded-full text-[12px] tabular-nums font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {formatDuration(elapsedSec)}
              </span>
            </button>
          </div>

          {/* Counter strip */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px]">
            <CounterPip label="Processed" value={`${run.processedCount}/${run.totalLeads - run.skippedCount}`} />
            <CounterPip label="Found"     value={run.foundCount}   tone="positive" />
            <CounterPip label="No email"  value={run.failedCount}  tone="mute" />
            <CounterPip label="Skipped"   value={run.skippedCount} tone="mute" sub="already had email" />
          </div>

          {/* Determinate progress bar */}
          <div className="mt-3 relative h-1.5 rounded-full bg-primary/15 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-ink dark:bg-d-ink rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SearchingPill ─────────────────────────────────────────────────────────────
// Shown in the email cell of the lead row while that specific lead is being
// fetched. Replaces the "Add email" ghost link — no layout shift.

export function SearchingPill() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink dark:text-d-ink bg-primary-pale dark:bg-primary/15 rounded-full px-2.5 py-1">
      <span className="relative flex w-2 h-2 shrink-0">
        <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
        <span className="relative rounded-full w-2 h-2 bg-primary" />
      </span>
      Searching…
    </span>
  );
}
