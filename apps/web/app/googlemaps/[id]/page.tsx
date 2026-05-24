"use client";
import { EditCampaignModal } from "@/components/campaigns/edit-campaign-modal";
import { RunCampaignModal } from "@/components/campaigns/run-campaign-modal";
import { EmailModal } from "@/components/leads/email-modal";
import { EnrichmentBanner, SearchingPill } from "@/components/leads/enrichment-banner";
import type { EnrichStatus } from "@/components/leads/enrichment-banner";
import { LeadEditModal } from "@/components/leads/lead-edit-modal";
import { NotesModal } from "@/components/leads/notes-modal";
import { Badge } from "@/components/ui/badge";
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { RunHistoryCard } from "@/components/ui/run-history-card";
import type { RunEntry } from "@/components/ui/run-history-card";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { STATUS_OPTIONS } from "@/lib/constants";
import type { Campaign, Lead, ScrapeRun } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowDown, ArrowUp, ArrowUpDown, Check, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, CircleDot, Download, Filter, Loader2, Mail, MapPin, Pencil, Phone, Play, Sparkles, Square, Trash2, User } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { createPortal } from "react-dom";
import { use, Suspense } from "react";

const badgeTone = (status: string) => {
  const opt = STATUS_OPTIONS.find((s) => s.value === status);
  return (opt?.tone ?? "neutral") as "neutral" | "warning" | "positive" | "mute" | "purple";
};

// Slice 4.6 — a clickable, sortable table header cell.
function SortHeader({
  label, sortKey, activeSort, activeDir, onSort, align = "left",
}: {
  label: string;
  sortKey: string;
  activeSort: string;
  activeDir: "asc" | "desc";
  onSort: (key: string) => void;
  align?: "left" | "right";
}) {
  const isActive = activeSort === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 hover:text-ink dark:hover:text-d-ink transition-colors ${
        isActive ? "text-ink dark:text-d-ink" : ""
      } ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      {label}
      {isActive
        ? activeDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        : <ArrowUpDown size={12} className="opacity-40" />}
    </button>
  );
}

interface RunStatus {
  id:             string;
  status:         "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  newLeadsCount:  number;
  duplicateCount: number;
  startedAt:      string | null;
  finishedAt:     string | null;
  errorMessage:   string | null;
}

// Slice 4.11 — GET /api/campaigns/[id] now returns live stats alongside the campaign.
interface LeadStats {
  total:      number;
  new:        number;
  contacted:  number;
  conversion: number;
}
// apiOffset / apiKeywordUsed / apiTotalAvailable added by migration 20260522231355.
// Prisma client type will include them once the DLL lock is released and `prisma generate` runs.
type CampaignWithStats = Campaign & {
  stats:             LeadStats;
  apiOffset:         number;
  apiKeywordUsed:    string | null;
  apiTotalAvailable: number | null;
};

function LeadRow({
  lead, selected, onToggle, onStatusChange, onEditNotes, onEditEmail,
  searching, justFound,
}: {
  lead: Lead; selected: boolean;
  onToggle: (on: boolean) => void;
  onStatusChange: (status: string) => void;
  onEditNotes: () => void;
  onEditEmail: () => void;
  searching?: boolean;
  justFound?: boolean;
}) {
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const statusMeta = STATUS_OPTIONS.find((s) => s.value === lead.status) ?? STATUS_OPTIONS[0]!;

  React.useEffect(() => {
    if (!statusOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setStatusOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [statusOpen]);

  React.useEffect(() => {
    if (!statusOpen) return;
    const measure = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setCoords({ top: r.bottom + 6, left: r.left });
    };
    measure();
    const onScroll = () => setStatusOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", measure); };
  }, [statusOpen]);

  const addedAt = lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—";

  return (
    <tr className={`group border-t border-line/60 dark:border-d-line/60 text-[14px] hover:bg-canvas-soft/60 dark:hover:bg-d-canvas-soft/60 transition-colors${selected ? " bg-primary-pale/40 dark:bg-primary/10" : ""}`}>
      <td className="py-3.5 pl-5 pr-3"><Checkbox checked={selected} onChange={onToggle} /></td>
      <td className="py-3.5 px-3">
        <div className="font-semibold text-ink dark:text-d-ink truncate max-w-[220px]">{lead.businessName}</div>
      </td>
      <td className="py-3.5 px-3">
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} className="text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink tabular-nums inline-flex items-center gap-1.5">
            <Phone size={12} className="text-mute" />{lead.phone}
          </a>
        ) : <span className="text-mute">—</span>}
      </td>
      <td className="py-3.5 px-3 max-w-[200px]">
        {lead.email ? (
          <button
            onClick={onEditEmail}
            className={`inline-flex items-center gap-1.5 truncate max-w-[180px] ${
              justFound
                ? "text-ink dark:text-d-ink font-medium"
                : "text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink"
            }`}
          >
            <Mail size={12} className={justFound ? "text-primary shrink-0" : "text-mute shrink-0"} />
            <span className="truncate">{lead.email}</span>
            {justFound && <Sparkles size={11} className="text-positive shrink-0" />}
          </button>
        ) : searching ? (
          <SearchingPill />
        ) : (
          <button
            onClick={onEditEmail}
            className="text-mute text-[13px] inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:text-ink dark:hover:text-d-ink transition-opacity"
          >
            <Mail size={12} /> Add email
          </button>
        )}
      </td>
      <td className="py-3.5 px-3">
        {lead.websiteUrl ? (
          <a href={lead.websiteUrl} target="_blank" rel="noreferrer" className="text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink inline-flex items-center gap-1 max-w-[180px] truncate">
            {lead.normalizedDomain ?? lead.websiteUrl}
          </a>
        ) : <span className="text-mute">—</span>}
      </td>
      <td className="py-3.5 px-3 max-w-[260px]">
        {lead.notes ? (
          <button
            onClick={onEditNotes}
            className="text-[13px] text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink line-clamp-1 max-w-[240px] text-left"
          >
            {lead.notes}
          </button>
        ) : (
          <button
            onClick={onEditNotes}
            className="text-[13px] text-mute inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:text-ink dark:hover:text-d-ink transition-opacity"
          >
            <Pencil size={11} /> Add note
          </button>
        )}
      </td>
      <td className="py-3.5 px-3 text-[12px] text-mute">{addedAt}</td>
      <td className="py-3.5 px-3 pr-5 text-right">
        <button ref={triggerRef} onClick={() => setStatusOpen((o) => !o)} className="inline-flex items-center gap-1">
          <Badge tone={badgeTone(lead.status ?? "NEW")}>{statusMeta.label}</Badge>
          <ChevronDown size={12} className={`text-mute transition-transform${statusOpen ? " rotate-180" : ""}`} />
        </button>
        {statusOpen && coords && createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 100 }}
            className="bg-canvas dark:bg-d-canvas border border-line dark:border-d-line rounded-[14px] p-1.5 min-w-[170px] animate-fadein shadow-[0_18px_40px_-16px_rgba(0,0,0,0.25)]"
          >
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => { onStatusChange(s.value); setStatusOpen(false); }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm rounded-[10px] hover:bg-canvas-soft dark:hover:bg-d-canvas-soft${s.value === lead.status ? " bg-canvas-soft dark:bg-d-canvas-soft" : ""}`}
              >
                <Badge tone={s.tone}>{s.label}</Badge>
                {s.value === lead.status && <Check size={14} className="text-positive" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
      </td>
    </tr>
  );
}

// A plain stopwatch. Returns elapsed seconds. Starts when `running` flips
// true, resets when it flips false. The start time is in a ref so it survives
// re-renders (polling, lead inserts) untouched.
function useStopwatch(running: boolean): number {
  const startRef = React.useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = React.useState(0);

  React.useEffect(() => {
    if (!running) {
      startRef.current = null;
      setElapsedSec(0);
      return;
    }
    startRef.current = Date.now();
    setElapsedSec(0);
    const t = setInterval(() => {
      if (startRef.current != null) {
        setElapsedSec(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  return elapsedSec;
}

function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ScrapingBanner({ run, onDismiss }: { run: RunStatus; onDismiss: () => void }) {
  const isActive    = run.status === "PENDING" || run.status === "RUNNING";
  const isCompleted = run.status === "COMPLETED";
  const isFailed    = run.status === "FAILED";
  const isCancelled = run.status === "CANCELLED";

  if (!isActive && !isCompleted && !isFailed && !isCancelled) return null;

  const DismissBtn = () => (
    <button
      onClick={onDismiss}
      className="shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-current opacity-60 hover:opacity-100"
      aria-label="Dismiss"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
    </button>
  );

  // ── Active scrape — amber card matching the prototype design ─────────────
  if (isActive) {
    return (
      <div className="mt-6 rounded-[10px] bg-[#fff7d6] dark:bg-[#3a3206] border border-warning/40 px-5 py-4 flex items-center gap-4 animate-fadein">
        <div className="w-10 h-10 rounded-full bg-warning/30 flex items-center justify-center text-[#7a4500] dark:text-warning shrink-0">
          <Sparkles size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-[15px] font-semibold text-ink dark:text-d-ink">
              {run.status === "PENDING" ? "Scrape queued…" : "Scraping in progress…"}
            </div>
            <span className="text-[13px] text-body dark:text-d-body">
              <span className="font-semibold text-ink dark:text-d-ink tabular-nums">{run.newLeadsCount}</span>
              {" "}lead{run.newLeadsCount === 1 ? "" : "s"} found
              <span className="text-mute"> · ~3s polling</span>
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-[#7a4500] dark:text-warning">
              <Loader2 size={13} className="animate-spin" />
              Working…
            </span>
          </div>
          <div className="mt-2 relative h-1 rounded-full bg-warning/20 overflow-hidden">
            <div className="absolute inset-y-0 w-1/3 bg-warning rounded-full animate-indeterm" />
          </div>
        </div>
      </div>
    );
  }

  // ── Completed — green success row ────────────────────────────────────────
  if (isCompleted) {
    return (
      <div className="mt-6 flex items-center gap-3 rounded-[10px] px-5 py-3.5 text-[14px] bg-positive/10 border border-positive/30 text-ink dark:text-d-ink">
        <span className="text-positive shrink-0">✓</span>
        <span className="font-medium flex-1">
          Scrape complete — {run.newLeadsCount} new lead{run.newLeadsCount === 1 ? "" : "s"} added, {run.duplicateCount} duplicate{run.duplicateCount === 1 ? "" : "s"} skipped
        </span>
        <DismissBtn />
      </div>
    );
  }

  // ── Failed / cancelled — compact status row ──────────────────────────────
  return (
    <div className={`mt-6 flex items-center gap-3 rounded-[10px] px-5 py-3.5 text-[14px] ${
      isFailed
        ? "bg-negative/10 border border-negative/30 text-ink dark:text-d-ink"
        : "bg-canvas-soft dark:bg-d-canvas-soft border border-line dark:border-d-line text-mute"
    }`}>
      {isFailed    && <span className="text-negative shrink-0">✕</span>}
      {isCancelled && <Square size={14} className="shrink-0" />}
      <span className="font-medium flex-1">
        {isFailed && (() => {
          const msg = run.errorMessage ?? "Unknown error";
          if (msg.includes("CAPTCHA"))    return "Blocked by Google: CAPTCHA detected. Try again in a few hours or use a different network.";
          if (msg.includes("IP_BAN"))     return "Blocked by Google: IP banned. Please wait several hours before retrying.";
          if (msg.includes("RATE_LIMIT")) return "Blocked by Google: rate limited. Wait ~1 hour, then retry.";
          return `Scrape failed: ${msg}`;
        })()}
        {isCancelled && `Stopped — ${run.newLeadsCount} lead${run.newLeadsCount === 1 ? "" : "s"} saved`}
      </span>
      <DismissBtn />
    </div>
  );
}

function toRunEntries(runs: ScrapeRun[]): RunEntry[] {
  return runs.map((r) => ({
    id:          r.id,
    campaignId:  r.campaignId,
    startedAt:   r.startedAt ? new Date(r.startedAt).toLocaleString() : "—",
    status:      r.status as RunEntry["status"],
    newLeads:    r.newLeadsCount,
    dupes:       r.duplicateCount,
    durationSec: r.durationSec ?? null,
    error:       r.errorMessage,
  }));
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // useSearchParams (used inside the content component) needs a Suspense boundary.
  return (
    <Suspense fallback={<div className="px-8 py-24 text-center text-mute text-sm">Loading…</div>}>
      <CampaignDetailContent params={params} />
    </Suspense>
  );
}

function CampaignDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();

  // ── URL-backed table state (Slices 4.5–4.7) ─────────────────────────────
  // Reads come straight from the URL; writes patch the query string in place.
  const statusFilter = searchParams.get("status") ?? "ALL";
  const sort         = searchParams.get("sort")   ?? "created";
  const dir          = (searchParams.get("dir") === "asc" ? "asc" : "desc") as "asc" | "desc";
  const page         = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize     = [10, 25, 50, 100].includes(Number(searchParams.get("pageSize")))
    ? Number(searchParams.get("pageSize"))
    : 25;

  const setParams = React.useCallback((updates: Record<string, string | null>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    router.replace(`?${sp.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Declared early so the campaign query can reference it for refetchInterval
  const [activeRunId, setActiveRunId] = React.useState<string | null>(null);

  // Enrichment run state — mirrors the scrape run state machine
  const [activeEnrichId, setActiveEnrichId] = React.useState<string | null>(null);
  // Set of lead IDs whose email just landed (cleared after 2.2 s for the flash)
  const [justFoundIds, setJustFoundIds]     = React.useState<Set<string>>(new Set());
  const justFoundTimers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const markJustFound = React.useCallback((leadId: string) => {
    setJustFoundIds((prev) => { const n = new Set(prev); n.add(leadId); return n; });
    const prev = justFoundTimers.current.get(leadId);
    if (prev) clearTimeout(prev);
    const h = setTimeout(() => {
      setJustFoundIds((p) => { const n = new Set(p); n.delete(leadId); return n; });
      justFoundTimers.current.delete(leadId);
    }, 2200);
    justFoundTimers.current.set(leadId, h);
  }, []);

  const { data: campaign, isLoading: campaignLoading } = useQuery<CampaignWithStats>({
    queryKey: ["campaign", id],
    queryFn: () => fetch(`/api/campaigns/${id}`).then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); }),
    // Poll while a scrape is active so the stat cards count up in real-time.
    refetchInterval: activeRunId ? 3000 : false,
  });
  const [search, setSearch] = React.useState("");

  // Slice 4.4 — debounce the search input 300 ms before it hits the server.
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["leads", id, debouncedSearch, statusFilter, sort, dir],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (debouncedSearch) sp.set("q", debouncedSearch);
      if (statusFilter !== "ALL") sp.set("status", statusFilter);
      sp.set("sort", sort);
      sp.set("dir", dir);
      return fetch(`/api/campaigns/${id}/leads?${sp.toString()}`).then((r) => r.json());
    },
    enabled: !!campaign,
    // Poll while a scrape OR enrichment is active so the table fills in real-time
    refetchInterval: (activeRunId || activeEnrichId) ? 3000 : false,
  });

  const { data: scrapeRuns = [] } = useQuery<ScrapeRun[]>({
    queryKey: ["scrapeRuns", id],
    queryFn: () => fetch(`/api/campaigns/${id}/runs`).then((r) => r.json()),
    enabled: !!campaign,
    // Poll while a run is active so a pre-existing scrape is detected even
    // if the page was loaded before the run row appeared.
    refetchInterval: activeRunId ? 5000 : false,
  });

  // Detect any pre-existing active run on load
  React.useEffect(() => {
    const active = scrapeRuns.find((r) => r.status === "PENDING" || r.status === "RUNNING");
    if (active && !activeRunId) setActiveRunId(active.id);
  }, [scrapeRuns, activeRunId]);

  // Poll the active enrichment run at 3 s intervals
  const { data: activeEnrich } = useQuery<EnrichStatus>({
    queryKey: ["activeEnrich", activeEnrichId],
    queryFn:  () => fetch(`/api/enrich/${activeEnrichId}`).then((r) => r.json()),
    enabled:  !!activeEnrichId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDING" || status === "RUNNING" ? 3000 : false;
    },
  });

  // Track previous lead emails to detect newly-landed ones and flash them
  const prevEmailsRef = React.useRef<Map<string, string | null>>(new Map());
  React.useEffect(() => {
    if (!activeEnrichId) return;
    leads.forEach((l) => {
      const prev = prevEmailsRef.current.get(l.id);
      if (l.email && prev !== l.email) {
        // Email arrived (or changed) while enrichment is active — flash it
        if (prev !== undefined) markJustFound(l.id);
      }
      prevEmailsRef.current.set(l.id, l.email);
    });
  }, [leads, activeEnrichId, markJustFound]);

  // React to enrichment run completion
  const prevEnrichStatusRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!activeEnrich) return;
    const prev = prevEnrichStatusRef.current;
    prevEnrichStatusRef.current = activeEnrich.status;

    if (prev !== "COMPLETED" && activeEnrich.status === "COMPLETED") {
      const { foundCount, failedCount, totalLeads } = activeEnrich;
      if (foundCount === 0 && failedCount === 0) {
        toast.show({ type: "warning", title: "Nothing to enrich", message: "All selected leads already had an email." });
      } else if (foundCount === 0) {
        toast.show({ type: "warning", title: "Enrichment complete", message: `Couldn't find emails for ${failedCount} lead${failedCount === 1 ? "" : "s"}. Try again or add manually.` });
      } else {
        toast.show({
          type: "success",
          title: `Found ${foundCount} email${foundCount === 1 ? "" : "s"}`,
          message: `${foundCount} of ${totalLeads} leads enriched. ${failedCount} missed.`,
        });
      }
      qc.invalidateQueries({ queryKey: ["leads", id] });
      prevEmailsRef.current.clear();
      setActiveEnrichId(null);
    }

    if (prev !== "FAILED" && activeEnrich.status === "FAILED") {
      toast.show({ type: "error", title: "Enrichment failed", message: activeEnrich.errorMessage ?? "Unknown error" });
      setActiveEnrichId(null);
    }

    if (prev !== "CANCELLED" && activeEnrich.status === "CANCELLED") {
      const { foundCount } = activeEnrich;
      toast.show({
        type: "warning",
        title: "Enrichment stopped",
        message: `Cancelled. Kept ${foundCount} email${foundCount === 1 ? "" : "s"} found so far.`,
      });
      qc.invalidateQueries({ queryKey: ["leads", id] });
      prevEmailsRef.current.clear();
      setActiveEnrichId(null);
    }
  }, [activeEnrich, id, qc, toast]);

  // Poll the active run at 3 s intervals while it's in progress
  const { data: activeRun } = useQuery<RunStatus>({
    queryKey: ["activeRun", activeRunId],
    queryFn: () => fetch(`/api/scrape/${activeRunId}`).then((r) => r.json()),
    enabled: !!activeRunId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDING" || status === "RUNNING" ? 3000 : false;
    },
  });

  // React to run completion
  const prevStatusRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!activeRun) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = activeRun.status;

    if (prev !== "COMPLETED" && activeRun.status === "COMPLETED") {
      qc.invalidateQueries({ queryKey: ["leads", id] });
      qc.invalidateQueries({ queryKey: ["campaign", id] });
      qc.invalidateQueries({ queryKey: ["scrapeRuns", id] });
      // Banner stays visible — user dismisses it manually
    }

    if (prev !== "FAILED" && activeRun.status === "FAILED") {
      qc.invalidateQueries({ queryKey: ["scrapeRuns", id] });
      // Banner stays visible — user dismisses it manually
    }

    if (prev !== "CANCELLED" && activeRun.status === "CANCELLED") {
      qc.invalidateQueries({ queryKey: ["leads", id] });
      qc.invalidateQueries({ queryKey: ["campaign", id] });
      qc.invalidateQueries({ queryKey: ["scrapeRuns", id] });
      // Banner stays visible — user dismisses it manually
    }
  }, [activeRun, id, qc, toast]);

  const handleStop = async () => {
    if (!activeRunId) return;
    await fetch(`/api/scrape/${activeRunId}/cancel`, { method: "POST" });
    // UI will update via the polling effect when it sees CANCELLED status
  };

  const isEnriching = !!activeEnrichId && (activeEnrich?.status === "PENDING" || activeEnrich?.status === "RUNNING");
  const enrichElapsedSec = useStopwatch(isEnriching);

  const handleFindEmails = async (leadIds: string[], force = false) => {
    if (!campaign) return;
    if (isEnriching) {
      toast.show({ type: "warning", title: "Enrichment already running", message: "Wait for the current run to finish or stop it first." });
      return;
    }
    const res = await fetch("/api/enrich", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ campaignId: id, leadIds, force }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.show({ type: "warning", title: "Nothing to enrich", message: data.error ?? "All selected leads already have an email." });
      } else {
        toast.show({ type: "error", title: "Could not start enrichment", message: data.error ?? "Unknown error" });
      }
      return;
    }
    const { runId } = await res.json();
    prevEmailsRef.current.clear();
    leads.forEach((l) => prevEmailsRef.current.set(l.id, l.email));
    setActiveEnrichId(runId);
  };

  const handleStopEnrich = async () => {
    if (!activeEnrichId) return;
    await fetch(`/api/enrich/${activeEnrichId}/cancel`, { method: "POST" });
  };

  const [editOpen, setEditOpen] = React.useState(false);
  const [runOpen, setRunOpen] = React.useState(false);
  const [selected, setSelected] = React.useState(new Set<string>());

  // Slice 4.2 / 4.3 — which lead's notes / email modal is open
  const [notesLead, setNotesLead] = React.useState<Lead | null>(null);
  const [emailLead, setEmailLead] = React.useState<Lead | null>(null);
  const [editLead,  setEditLead]  = React.useState<Lead | null>(null);

  // Slice 4.9 — bulk delete confirmation modal
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

  // Reset to page 1 whenever a filter/search/sort narrows the result set.
  React.useEffect(() => {
    if (page !== 1) setParams({ page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, debouncedSearch, sort, dir]);

  const isRunning = !!activeRunId && (activeRun?.status === "PENDING" || activeRun?.status === "RUNNING");

  const elapsedSec   = useStopwatch(isRunning);

  // A search term or a non-ALL status filter means the list is narrowed.
  const isFiltered = debouncedSearch !== "" || statusFilter !== "ALL";

  // Search, status filter and sort are all server-side (Slices 4.4–4.6).
  // The leads list arrives already filtered + sorted; just paginate it here.
  const filtered = leads;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Slice 4.11 — stats come from the server (whole-campaign counts, so they
  // stay correct even when a status filter or search narrows the table).
  const stats: LeadStats = campaign?.stats ?? { total: 0, new: 0, contacted: 0, conversion: 0 };

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const someOnPageSelected = pageRows.some((r) => selected.has(r.id)) && !allOnPageSelected;
  const togglePage = (on: boolean) => {
    const next = new Set(selected);
    pageRows.forEach((r) => on ? next.add(r.id) : next.delete(r.id));
    setSelected(next);
  };
  const toggleOne = (leadId: string, on: boolean) => {
    const next = new Set(selected);
    on ? next.add(leadId) : next.delete(leadId);
    setSelected(next);
  };

  const patchCampaignStatus = async (status: string) => {
    await fetch(`/api/campaigns/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    qc.invalidateQueries({ queryKey: ["campaign", id] });
    qc.invalidateQueries({ queryKey: ["campaigns"] });
  };

  const handleArchive = async () => {
    await patchCampaignStatus("ARCHIVED");
    toast.show({ type: "success", title: "Campaign archived", message: campaign?.name });
    router.push("/googlemaps");
  };

  // ── Slice 4.6 — toggle sort: same column flips direction, new column resets to asc
  const handleSort = (key: string) => {
    if (sort === key) {
      setParams({ dir: dir === "asc" ? "desc" : "asc" });
    } else {
      setParams({ sort: key, dir: "asc" });
    }
  };

  // ── Slice 4.1 — inline status change with optimistic update + revert ─────
  const leadsKey = ["leads", id, debouncedSearch, statusFilter, sort, dir];
  const handleStatusChange = async (lead: Lead, status: string) => {
    const label = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
    const prev = qc.getQueryData<Lead[]>(leadsKey);
    // Optimistic: patch the cached lead immediately
    qc.setQueryData<Lead[]>(leadsKey, (old) =>
      old?.map((l) => (l.id === lead.id ? { ...l, status: status as Lead["status"] } : l)),
    );
    try {
      const res = await fetch(`/api/leads/${lead.id}/status`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("request failed");
      toast.show({ type: "success", title: "Status updated", message: `Lead marked as ${label}.` });
      qc.invalidateQueries({ queryKey: ["leads", id] });
    } catch {
      if (prev) qc.setQueryData(leadsKey, prev); // revert
      toast.show({ type: "error", title: "Update failed", message: "Could not change the status." });
    }
  };

  // ── Slice 4.2 — save notes ───────────────────────────────────────────────
  const handleSaveNotes = async (lead: Lead, notes: string) => {
    const res = await fetch(`/api/leads/${lead.id}/notes`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ notes }),
    });
    if (!res.ok) {
      toast.show({ type: "error", title: "Save failed", message: "Could not save the note." });
      return;
    }
    qc.invalidateQueries({ queryKey: ["leads", id] });
    toast.show({ type: "success", title: "Note saved", message: `Updated note for ${lead.businessName}.` });
    setNotesLead(null);
  };

  // ── Slice 4.3 — save / clear email ───────────────────────────────────────
  const handleSaveEmail = async (lead: Lead, email: string) => {
    const res = await fetch(`/api/leads/${lead.id}/email`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.show({ type: "error", title: "Save failed", message: data.error ?? "Could not save the email." });
      return;
    }
    qc.invalidateQueries({ queryKey: ["leads", id] });
    toast.show({
      type: "success",
      title: email ? "Email saved" : "Email cleared",
      message: email ? `Set email for ${lead.businessName}.` : `Removed email from ${lead.businessName}.`,
    });
    setEmailLead(null);
  };

  // ── Edit full lead row ────────────────────────────────────────────────────
  const handleSaveLead = async (lead: Lead, fields: Record<string, string | undefined>) => {
    const res = await fetch(`/api/leads/${lead.id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(fields),
    });
    if (!res.ok) {
      toast.show({ type: "error", title: "Save failed", message: "Could not update the lead." });
      return;
    }
    qc.invalidateQueries({ queryKey: ["leads", id] });
    toast.show({ type: "success", title: "Lead updated", message: `Saved changes for ${lead.businessName}.` });
    setEditLead(null);
  };

  // ── Slice 4.10 — CSV export. Builds the URL for the chosen scope and
  // triggers a browser download via a temporary anchor.
  const handleExport = (scope: "all" | "filtered" | "selected") => {
    const sp = new URLSearchParams({ scope });
    if (scope === "filtered") {
      if (debouncedSearch) sp.set("q", debouncedSearch);
      if (statusFilter !== "ALL") sp.set("status", statusFilter);
    }
    if (scope === "selected") {
      if (selected.size === 0) {
        toast.show({ type: "warning", title: "Nothing selected", message: "Select leads to export them." });
        return;
      }
      sp.set("ids", [...selected].join(","));
    }
    const a = document.createElement("a");
    a.href = `/api/campaigns/${id}/export?${sp.toString()}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.show({ type: "success", title: "Export started", message: "Your CSV download should begin shortly." });
  };

  // ── Slice 4.9 — bulk status update ───────────────────────────────────────
  const handleBulkStatus = async (status: string) => {
    const ids = [...selected];
    const label = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
    const res = await fetch("/api/leads/bulk-status", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ids, status }),
    });
    if (!res.ok) {
      toast.show({ type: "error", title: "Bulk update failed", message: "Could not update the selected leads." });
      return;
    }
    qc.invalidateQueries({ queryKey: ["leads", id] });
    setSelected(new Set());
    toast.show({ type: "success", title: "Bulk update done", message: `Marked ${ids.length} lead${ids.length === 1 ? "" : "s"} as ${label}.` });
  };

  // ── Slice 4.9 — bulk delete ──────────────────────────────────────────────
  const handleBulkDelete = async () => {
    const ids = [...selected];
    const res = await fetch("/api/leads/bulk", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ids }),
    });
    if (!res.ok) {
      toast.show({ type: "error", title: "Delete failed", message: "Could not delete the selected leads." });
      return;
    }
    qc.invalidateQueries({ queryKey: ["leads", id] });
    qc.invalidateQueries({ queryKey: ["campaign", id] });
    setSelected(new Set());
    setBulkDeleteOpen(false);
    toast.show({ type: "success", title: "Leads deleted", message: `Removed ${ids.length} lead${ids.length === 1 ? "" : "s"}.` });
  };

  if (campaignLoading) {
    return <div className="px-8 py-24 text-center text-mute text-sm">Loading…</div>;
  }
  if (!campaign) {
    return (
      <div className="px-8 py-24 text-center text-mute">
        Campaign not found.{" "}
        <Link href="/googlemaps" className="text-ink dark:text-d-ink underline">Back to campaigns</Link>
      </div>
    );
  }

  const isArchived = campaign.status === "ARCHIVED";
  const statusBadgeTone = campaign.status === "ACTIVE" ? "positive" : campaign.status === "PAUSED" ? "warning" : "mute";

  return (
    <div className="px-8 py-8 max-w-[1480px] mx-auto pb-32">
      <Link href="/googlemaps" className="inline-flex items-center gap-1.5 text-[13px] text-mute hover:text-ink dark:hover:text-d-ink mb-5 transition-colors">
        <ChevronLeft size={14} /> All campaigns
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[32px] sm:text-[36px] font-bold text-ink dark:text-d-ink leading-tight tracking-tight">{campaign.name}</h1>
            <Badge tone={statusBadgeTone} dot={`bg-${statusBadgeTone === "positive" ? "positive" : statusBadgeTone === "warning" ? "warning" : "mute"}`}>
              {campaign.status}
            </Badge>
          </div>
          <div className="text-[15px] text-body dark:text-d-body mt-1">"{campaign.keyword}"</div>
          <div className="text-[12px] text-mute mt-1.5 flex items-center gap-1.5">
            <MapPin size={11} /> USA <span className="text-line dark:text-d-line">›</span> {campaign.state} <span className="text-line dark:text-d-line">›</span> {campaign.city ?? "Entire State"}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="primary"
            size="md"
            leftIcon={isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            disabled={isArchived || isRunning || campaign.status === "PAUSED"}
            onClick={() => setRunOpen(true)}
          >
            {isRunning ? "Scraping…" : "Run campaign"}
          </Button>
          {isRunning && (
            <Button
              variant="destructive"
              size="md"
              leftIcon={<Square size={14} />}
              onClick={handleStop}
            >
              Stop <span className="tabular-nums font-normal opacity-90">{fmtElapsed(elapsedSec)}</span>
            </Button>
          )}
          <Menu
            trigger={<Button variant="chip" size="md" rightIcon={<ChevronDown size={14} />} leftIcon={<Download size={14} />}>Export</Button>}
            items={[
              { label: `Export all leads (${stats.total})`, icon: <Download size={14} />, onClick: () => handleExport("all") },
              // "Filtered" only shows when a filter is active AND it matched rows.
              ...(isFiltered && leads.length > 0
                ? [{ label: `Export filtered (${leads.length})`, icon: <Filter size={14} />, onClick: () => handleExport("filtered") }]
                : []),
              ...(selected.size > 0
                ? [{ label: `Export selected (${selected.size})`, icon: <Check size={14} />, onClick: () => handleExport("selected") }]
                : []),
            ]}
          />
          <Button variant="chip" size="md" onClick={() => setEditOpen(true)} leftIcon={<Pencil size={14} />}>Edit</Button>
          <Button variant="chip" size="md" onClick={handleArchive} leftIcon={<Archive size={14} />} disabled={isArchived}>Archive</Button>
        </div>
      </div>

      {/* Scraping banner */}
      {activeRun && <ScrapingBanner run={activeRun} onDismiss={() => setActiveRunId(null)} />}

      {/* Enrichment banner — shown while an enrichment run is active */}
      {activeEnrich && (activeEnrich.status === "PENDING" || activeEnrich.status === "RUNNING") && (
        <EnrichmentBanner
          run={activeEnrich}
          elapsedSec={enrichElapsedSec}
          currentLeadName={undefined}
          onStop={handleStopEnrich}
        />
      )}

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total leads" value={stats.total} icon={<User size={18} />} />
        <StatCard label="New" value={stats.new} sub={stats.new > 0 ? `${Math.round(stats.new / Math.max(1, stats.total) * 100)}% of total` : "—"} />
        <StatCard label="Contacted" value={stats.contacted} icon={<Phone size={18} />} />
        <StatCard label="Conversion" value={`${stats.conversion}%`} sub="replied + closed / total" icon={<CheckCircle size={18} />} />
      </div>

      {/* Leads toolbar */}
      <div className="mt-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[20px] font-semibold text-ink dark:text-d-ink">Leads</h2>
          <p className="text-[12px] text-mute mt-0.5">{filtered.length} of {leads.length} shown</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Search by name, phone, email, notes…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-[280px]"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setParams({ status: e.target.value === "ALL" ? null : e.target.value, page: null })}
            className="w-[170px]"
          >
            <option value="ALL">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
      </div>

      {/* Leads table */}
      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-canvas-soft/60 dark:bg-d-canvas-soft/60">
              <tr className="text-[11px] uppercase tracking-wider text-mute font-semibold">
                <th className="py-3 pl-5 pr-3 w-10">
                  <Checkbox checked={allOnPageSelected} indeterminate={someOnPageSelected} onChange={togglePage} />
                </th>
                <th className="py-3 px-3">
                  <SortHeader label="Business" sortKey="name" activeSort={sort} activeDir={dir} onSort={handleSort} />
                </th>
                <th className="py-3 px-3">Phone</th>
                <th className="py-3 px-3">Email</th>
                <th className="py-3 px-3">Website</th>
                <th className="py-3 px-3">Notes</th>
                <th className="py-3 px-3">
                  <SortHeader label="Added" sortKey="created" activeSort={sort} activeDir={dir} onSort={handleSort} />
                </th>
                <th className="py-3 px-3 pr-5 text-right">
                  <SortHeader label="Status" sortKey="status" activeSort={sort} activeDir={dir} onSort={handleSort} align="right" />
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((l) => (
                <LeadRow
                  key={l.id} lead={l}
                  selected={selected.has(l.id)}
                  onToggle={(on) => toggleOne(l.id, on)}
                  onStatusChange={(s) => handleStatusChange(l, s)}
                  onEditNotes={() => setNotesLead(l)}
                  onEditEmail={() => setEmailLead(l)}
                  justFound={justFoundIds.has(l.id)}
                />
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-mute text-sm">
                    {leads.length === 0
                      ? isRunning
                        ? "Scraping in progress — leads will appear here as they are found."
                        : "No leads yet. Click \"Run campaign\" to start scraping."
                      : "No leads match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-t border-line dark:border-d-line text-[13px] flex-wrap">
          <div className="flex items-center gap-3">
            <div className="text-mute">
              Showing{" "}
              <span className="text-ink dark:text-d-ink font-medium">
                {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(filtered.length, safePage * pageSize)}
              </span>{" "}
              of {filtered.length}
            </div>
            <Select
              value={String(pageSize)}
              onChange={(e) => setParams({ pageSize: e.target.value, page: null })}
              className="w-[120px]"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setParams({ page: String(Math.max(1, safePage - 1)) })}
              disabled={safePage === 1}
              className="p-1.5 rounded-[10px] hover:bg-canvas-soft dark:hover:bg-d-canvas-soft text-ink dark:text-d-ink disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-2 text-mute">Page <span className="text-ink dark:text-d-ink font-medium">{safePage}</span> of {totalPages}</div>
            <button
              onClick={() => setParams({ page: String(Math.min(totalPages, safePage + 1)) })}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-[10px] hover:bg-canvas-soft dark:hover:bg-d-canvas-soft text-ink dark:text-d-ink disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </Card>

      {/* Run history */}
      <div className="mt-6">
        <RunHistoryCard
          runs={toRunEntries(scrapeRuns)}
          subtitle={scrapeRuns.length === 0 ? "No runs for this campaign yet" : undefined}
        />
      </div>

      {/* Bulk action bar */}
      <BulkActionsBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            type: "menu", label: "Set status", icon: <CircleDot size={14} />,
            items: STATUS_OPTIONS.map((s) => ({
              label: s.label,
              onClick: () => handleBulkStatus(s.value),
            })),
          },
          { type: "divider" },
          { type: "button", label: "Find Email", icon: <Mail size={14} />, onClick: () => { handleFindEmails([...selected]); setSelected(new Set()); } },
          { type: "divider" },
          { type: "button", label: "Export", icon: <Download size={14} />, onClick: () => handleExport("selected") },
          { type: "divider" },
          // Edit is only meaningful for a single lead
          {
            type: "button", label: "Edit", icon: <Pencil size={14} />, showOnCount: 1,
            onClick: () => {
              const lead = leads.find((l) => l.id === [...selected][0]);
              if (lead) setEditLead(lead);
            },
          },
          { type: "divider", showOnCount: 1 },
          { type: "button", label: "Delete", icon: <Trash2 size={14} />, danger: true, onClick: () => setBulkDeleteOpen(true) },
        ]}
      />

      <EditCampaignModal
        open={editOpen}
        campaign={campaign}
        onClose={() => setEditOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["campaign", id] })}
        onArchived={() => { router.push("/googlemaps"); }}
      />

      <RunCampaignModal
        open={runOpen}
        campaign={campaign}
        onClose={() => setRunOpen(false)}
        onStarted={(runId) => setActiveRunId(runId)}
      />

      <NotesModal
        open={!!notesLead}
        lead={notesLead}
        onClose={() => setNotesLead(null)}
        onSave={(notes) => { if (notesLead) return handleSaveNotes(notesLead, notes); }}
      />

      <EmailModal
        open={!!emailLead}
        lead={emailLead}
        onClose={() => setEmailLead(null)}
        onSave={(email) => { if (emailLead) return handleSaveEmail(emailLead, email); }}
        onFindEmail={emailLead ? () => { handleFindEmails([emailLead.id], !!emailLead.email); setEmailLead(null); } : undefined}
      />

      <LeadEditModal
        open={!!editLead}
        lead={editLead}
        onClose={() => setEditLead(null)}
        onSave={(fields) => { if (editLead) return handleSaveLead(editLead, fields as Record<string, string | undefined>); }}
      />

      {/* Slice 4.9 — bulk delete confirmation */}
      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} width={440} labelledBy="bulk-delete-title">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-negative/10 flex items-center justify-center text-negative shrink-0">
            <Trash2 size={18} />
          </div>
          <div>
            <h2 id="bulk-delete-title" className="text-[18px] font-semibold text-ink dark:text-d-ink">
              Delete {selected.size} lead{selected.size === 1 ? "" : "s"}?
            </h2>
            <p className="text-[13px] text-mute mt-1">
              This permanently removes the selected lead{selected.size === 1 ? "" : "s"} and their history. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleBulkDelete} leftIcon={<Trash2 size={14} />}>
            Delete {selected.size} lead{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
