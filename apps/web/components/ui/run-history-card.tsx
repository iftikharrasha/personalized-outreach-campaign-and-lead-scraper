"use client";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import * as React from "react";
import { Badge } from "./badge";
import { Card } from "./card";

export interface RunEntry {
  id: string;
  campaignId?: string;
  campaign?: string;
  startedAt: string;
  status: "COMPLETED" | "FAILED" | "CANCELLED" | "RUNNING" | "PENDING";
  newLeads: number;
  dupes: number;
  /** Raw seconds from the DB — formatted for display by fmtDuration(). */
  durationSec?: number | null;
  error?: string | null;
}

interface RunHistoryCardProps {
  title?: string;
  subtitle?: string;
  runs: RunEntry[];
  showCampaign?: boolean;
  onOpenCampaign?: (id: string) => void;
  defaultOpen?: boolean;
}

function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const runTone = (status: RunEntry["status"]) => {
  if (status === "COMPLETED") return "positive" as const;
  if (status === "FAILED") return "negative" as const;
  if (status === "CANCELLED") return "mute" as const;
  return "warning" as const;
};

function RunHistoryTable({ runs, showCampaign = false, onOpenCampaign }: Pick<RunHistoryCardProps, "runs" | "showCampaign" | "onOpenCampaign">) {
  const colCount = showCampaign ? 7 : 6;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-mute font-semibold">
            {showCampaign && <th className="py-2.5 pl-5 pr-3">Campaign</th>}
            <th className={cn("py-2.5 px-3", !showCampaign && "pl-5")}>Started</th>
            <th className="py-2.5 px-3 text-right">New</th>
            <th className="py-2.5 px-3 text-right">Dupes</th>
            <th className="py-2.5 px-3">Notes</th>
            <th className="py-2.5 px-3 text-right">Duration</th>
            <th className="py-2.5 px-3 pr-5 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-line/60 dark:border-d-line/60 text-[13px]">
              {showCampaign && (
                <td className="py-3 pl-5 pr-3">
                  <button
                    onClick={() => onOpenCampaign?.(r.campaignId ?? "")}
                    className="text-ink dark:text-d-ink font-medium hover:underline truncate max-w-[220px] inline-block text-left"
                  >
                    {r.campaign}
                  </button>
                </td>
              )}
              <td className={cn("py-3 px-3 text-ink dark:text-d-ink", !showCampaign && "pl-5")}>{r.startedAt}</td>
              <td className="py-3 px-3 text-right tabular-nums text-ink dark:text-d-ink font-medium">{r.newLeads}</td>
              <td className="py-3 px-3 text-right tabular-nums text-mute">{r.dupes}</td>
              <td className="py-3 px-3 text-[12.5px] text-mute max-w-[280px] truncate">{r.error ?? "—"}</td>
              <td className="py-3 px-3 text-right tabular-nums text-mute">{fmtDuration(r.durationSec)}</td>
              <td className="py-3 px-3 pr-5 text-right">
                <Badge size="sm" tone={runTone(r.status)}>{r.status}</Badge>
              </td>
            </tr>
          ))}
          {runs.length === 0 && (
            <tr><td colSpan={colCount} className="py-12 text-center text-mute text-sm">No runs yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function RunHistoryCard({ title = "Run history", subtitle, runs, showCampaign, onOpenCampaign, defaultOpen = true }: RunHistoryCardProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Card>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <span className="text-mute"><History size={18} /></span>
          <div>
            <div className="text-[15px] font-semibold text-ink dark:text-d-ink">{title}</div>
            {subtitle && <div className="text-[12px] text-mute mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-mute" /> : <ChevronDown size={18} className="text-mute" />}
      </button>
      {open && (
        <div className="px-2 pb-2 animate-fadein">
          <RunHistoryTable runs={runs} showCampaign={showCampaign} onOpenCampaign={onOpenCampaign} />
        </div>
      )}
    </Card>
  );
}
