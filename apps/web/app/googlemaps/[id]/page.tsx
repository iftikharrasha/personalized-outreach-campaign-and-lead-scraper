"use client";
import { EditCampaignModal } from "@/components/campaigns/edit-campaign-modal";
import { RunCampaignModal } from "@/components/campaigns/run-campaign-modal";
import { Badge } from "@/components/ui/badge";
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { RunHistoryCard } from "@/components/ui/run-history-card";
import type { RunEntry } from "@/components/ui/run-history-card";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { STATUS_OPTIONS } from "@/lib/constants";
import type { Campaign, Lead, ScrapeRun } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Check, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Download, Filter, Loader2, Mail, MapPin, Pencil, Phone, Play, Square, User, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createPortal } from "react-dom";
import { use } from "react";

const badgeTone = (status: string) => {
  const opt = STATUS_OPTIONS.find((s) => s.value === status);
  return (opt?.tone ?? "neutral") as "neutral" | "warning" | "positive" | "mute" | "purple";
};

interface RunStatus {
  id:             string;
  status:         "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  newLeadsCount:  number;
  duplicateCount: number;
  startedAt:      string | null;
  finishedAt:     string | null;
  errorMessage:   string | null;
}

function LeadRow({
  lead, selected, onToggle, onStatusChange,
}: {
  lead: Lead; selected: boolean;
  onToggle: (on: boolean) => void;
  onStatusChange: (status: string) => void;
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
          <span className="inline-flex items-center gap-1.5 text-body dark:text-d-body truncate max-w-[180px]">
            <Mail size={12} className="text-mute shrink-0" /><span className="truncate">{lead.email}</span>
          </span>
        ) : (
          <span className="text-mute text-[13px] inline-flex items-center gap-1 opacity-70"><Mail size={12} /> —</span>
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
        <span className="text-[13px] text-body dark:text-d-body line-clamp-1 max-w-[240px]">{lead.notes ?? <span className="text-mute">—</span>}</span>
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

function ScrapingBanner({ run }: { run: RunStatus }) {
  const isActive = run.status === "PENDING" || run.status === "RUNNING";
  const isFailed = run.status === "FAILED";
  const isCancelled = run.status === "CANCELLED";

  if (!isActive && !isFailed && !isCancelled) return null;

  return (
    <div className={`mt-4 flex items-center gap-3 rounded-[16px] px-5 py-3.5 text-[14px] ${
      isFailed     ? "bg-negative/10 border border-negative/30 text-ink dark:text-d-ink" :
      isCancelled  ? "bg-canvas-soft dark:bg-d-canvas-soft border border-line dark:border-d-line text-mute" :
                     "bg-primary/15 border border-primary/40 text-ink dark:text-d-ink"
    }`}>
      {isActive    && <Loader2 size={16} className="text-primary shrink-0 animate-spin" />}
      {isFailed    && <span className="text-negative shrink-0">✕</span>}
      {isCancelled && <Square size={14} className="shrink-0" />}
      <span className="font-medium">
        {run.status === "PENDING"   && "Scrape queued — waiting for worker…"}
        {run.status === "RUNNING"   && `Scraping in progress… ${run.newLeadsCount} lead${run.newLeadsCount === 1 ? "" : "s"} found so far`}
        {isFailed                   && `Scrape failed: ${run.errorMessage ?? "Unknown error"}`}
        {isCancelled                && `Stopped — ${run.newLeadsCount} lead${run.newLeadsCount === 1 ? "" : "s"} saved`}
      </span>
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
    durationMin: r.durationSec != null ? Math.round(r.durationSec / 60) || null : null,
    error:       r.errorMessage,
  }));
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["campaign", id],
    queryFn: () => fetch(`/api/campaigns/${id}`).then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); }),
  });

  // Declared early so the leads query can reference it for refetchInterval
  const [activeRunId, setActiveRunId] = React.useState<string | null>(null);

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["leads", id],
    queryFn: () => fetch(`/api/campaigns/${id}/leads`).then((r) => r.json()),
    enabled: !!campaign,
    // Refetch every 4 s while a scrape is active so the table fills in real-time
    refetchInterval: activeRunId ? 4000 : false,
  });

  const { data: scrapeRuns = [] } = useQuery<ScrapeRun[]>({
    queryKey: ["scrapeRuns", id],
    queryFn: () => fetch(`/api/campaigns/${id}/runs`).then((r) => r.json()),
    enabled: !!campaign,
  });

  // Detect any pre-existing active run on load
  React.useEffect(() => {
    const active = scrapeRuns.find((r) => r.status === "PENDING" || r.status === "RUNNING");
    if (active && !activeRunId) setActiveRunId(active.id);
  }, [scrapeRuns, activeRunId]);

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
      toast.show({
        type: "success",
        title: "Scrape complete",
        message: `Added ${activeRun.newLeadsCount} new lead${activeRun.newLeadsCount === 1 ? "" : "s"}, skipped ${activeRun.duplicateCount} duplicate${activeRun.duplicateCount === 1 ? "" : "s"}.`,
      });
      qc.invalidateQueries({ queryKey: ["leads", id] });
      qc.invalidateQueries({ queryKey: ["campaign", id] });
      qc.invalidateQueries({ queryKey: ["scrapeRuns", id] });
      setActiveRunId(null);
    }

    if (prev !== "FAILED" && activeRun.status === "FAILED") {
      toast.show({ type: "error", title: "Scrape failed", message: activeRun.errorMessage ?? "Unknown error" });
      qc.invalidateQueries({ queryKey: ["scrapeRuns", id] });
      setActiveRunId(null);
    }

    if (prev !== "CANCELLED" && activeRun.status === "CANCELLED") {
      toast.show({ type: "warning", title: "Scrape stopped", message: `Stopped with ${activeRun.newLeadsCount} lead${activeRun.newLeadsCount === 1 ? "" : "s"} saved.` });
      qc.invalidateQueries({ queryKey: ["leads", id] });
      qc.invalidateQueries({ queryKey: ["campaign", id] });
      qc.invalidateQueries({ queryKey: ["scrapeRuns", id] });
      setActiveRunId(null);
    }
  }, [activeRun, id, qc, toast]);

  const handleStop = async () => {
    if (!activeRunId) return;
    await fetch(`/api/scrape/${activeRunId}/cancel`, { method: "POST" });
    // UI will update via the polling effect when it sees CANCELLED status
  };

  const [editOpen, setEditOpen] = React.useState(false);
  const [runOpen, setRunOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [page, setPage] = React.useState(1);
  const pageSize = 25;
  const [selected, setSelected] = React.useState(new Set<string>());

  React.useEffect(() => { setPage(1); }, [statusFilter, search]);

  const isRunning = !!activeRunId && (activeRun?.status === "PENDING" || activeRun?.status === "RUNNING");

  const filtered = React.useMemo(() => leads.filter((l) => {
    const matchStatus = statusFilter === "ALL" || l.status === statusFilter;
    const matchSearch = !search || (l.businessName + (l.phone ?? "") + (l.websiteUrl ?? "") + (l.notes ?? "")).toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  }), [leads, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const stats = React.useMemo(() => {
    const total = leads.length;
    const newCount = leads.filter((l) => l.status === "NEW").length;
    const contacted = leads.filter((l) => ["CONTACTED", "REPLIED", "CLOSED"].includes(l.status ?? "")).length;
    const replied = leads.filter((l) => l.status === "REPLIED" || l.status === "CLOSED").length;
    return { total, new: newCount, contacted, conversion: total ? Math.round(replied / total * 100) : 0 };
  }, [leads]);

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
              Stop
            </Button>
          )}
          <Menu
            trigger={<Button variant="chip" size="md" rightIcon={<ChevronDown size={14} />} leftIcon={<Download size={14} />}>Export</Button>}
            items={[
              { label: "Export all leads (CSV)", icon: <Download size={14} />, onClick: () => toast.show({ type: "success", title: "Export ready", message: "Available in Phase 4." }) },
              { label: "Export filtered (CSV)", icon: <Filter size={14} />, onClick: () => toast.show({ type: "success", title: "Export ready", message: "Available in Phase 4." }) },
            ]}
          />
          <Button variant="chip" size="md" onClick={() => setEditOpen(true)} leftIcon={<Pencil size={14} />}>Edit</Button>
          <Button variant="chip" size="md" onClick={handleArchive} leftIcon={<Archive size={14} />} disabled={isArchived}>Archive</Button>
        </div>
      </div>

      {/* Scraping banner */}
      {activeRun && <ScrapingBanner run={activeRun} />}

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
            placeholder="Search by name, phone, notes…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-[280px]"
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[170px]">
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
                <th className="py-3 px-3">Business</th>
                <th className="py-3 px-3">Phone</th>
                <th className="py-3 px-3">Email</th>
                <th className="py-3 px-3">Website</th>
                <th className="py-3 px-3">Notes</th>
                <th className="py-3 px-3">Added</th>
                <th className="py-3 px-3 pr-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((l) => (
                <LeadRow
                  key={l.id} lead={l}
                  selected={selected.has(l.id)}
                  onToggle={(on) => toggleOne(l.id, on)}
                  onStatusChange={async (s) => {
                    await fetch(`/api/leads/${l.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: s }),
                    });
                    qc.invalidateQueries({ queryKey: ["leads", id] });
                    const label = STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
                    toast.show({ type: "success", title: "Status updated", message: `Lead marked as ${label}.` });
                  }}
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

        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-t border-line dark:border-d-line text-[13px]">
          <div className="text-mute">
            Showing{" "}
            <span className="text-ink dark:text-d-ink font-medium">
              {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(filtered.length, page * pageSize)}
            </span>{" "}
            of {filtered.length}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-[10px] hover:bg-canvas-soft dark:hover:bg-d-canvas-soft text-ink dark:text-d-ink disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-2 text-mute">Page <span className="text-ink dark:text-d-ink font-medium">{page}</span> of {totalPages}</div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
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
            type: "menu", label: "Set status",
            items: STATUS_OPTIONS.map((s) => ({
              label: s.label,
              onClick: async () => {
                await Promise.all(
                  [...selected].map((lid) =>
                    fetch(`/api/leads/${lid}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: s.value }),
                    })
                  )
                );
                qc.invalidateQueries({ queryKey: ["leads", id] });
                setSelected(new Set());
                toast.show({ type: "success", title: "Bulk update done", message: `Marked ${selected.size} leads as ${s.label}.` });
              },
            })),
          },
          { type: "divider" },
          { type: "button", label: "Delete", icon: <X size={14} />, danger: true, onClick: () => setSelected(new Set()) },
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
    </div>
  );
}
