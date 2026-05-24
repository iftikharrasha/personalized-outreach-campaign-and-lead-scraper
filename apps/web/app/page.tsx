"use client";
import { NotesModal } from "@/components/leads/notes-modal";
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RunHistoryCard, type RunEntry } from "@/components/ui/run-history-card";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import type { Campaign, Lead } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  ExternalLink,
  Filter,
  History,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  StickyNote,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DashboardStats {
  funnel: {
    totalLeads:    number;
    contacted:     number;
    replied:       number;
    closed:        number;
    campaignCount: number;
  };
  earnings: {
    totalEarned:  number;
    avgDeal:      number;
    thisMonthEarned: number;
    monthlyTrend: { month: string; earned: number }[];
  };
  health: {
    totalRunCount: number;
    avgDurationSec: number | null;
    avgDupes:       number | null;
    hasBlock:       boolean;
  };
}

type ClosedLead = Lead & { campaignName?: string };

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatMoney(n: number) {
  return "$" + (n || 0).toLocaleString("en-US");
}

function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function TrendBars({ data }: { data: { month: string; earned: number }[] }) {
  const max = Math.max(...data.map((d) => d.earned), 1);
  return (
    <div className="mt-4 flex items-end gap-2 h-12">
      {data.map((d, i) => {
        const isCurrent = i === data.length - 1;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className={`w-full rounded-[6px] transition-all ${isCurrent ? "bg-primary" : "bg-line dark:bg-d-line"}`}
              style={{ height: `${Math.max(8, (d.earned / max) * 100)}%` }}
              title={`${d.month}: ${formatMoney(d.earned)}`}
            />
            <div className={`text-[10px] leading-none ${isCurrent ? "text-positive font-semibold" : "text-mute"}`}>{d.month}</div>
          </div>
        );
      })}
    </div>
  );
}

function SectionLabel({ title, hint, className = "" }: { title: string; hint?: string; className?: string }) {
  return (
    <div className={`flex items-end justify-between gap-3 ${className}`}>
      <div>
        <h2 className="text-[15px] font-semibold text-ink dark:text-d-ink">{title}</h2>
        {hint && <p className="text-[12px] text-mute mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

// ── Add Earning Modal ─────────────────────────────────────────────────────────

function AddEarningModal({ open, lead, onClose, onSave }: {
  open: boolean;
  lead: ClosedLead | null;
  onClose: () => void;
  onSave: (amount: number) => Promise<void>;
}) {
  const [value, setValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) { setValue(""); setSaving(false); }
  }, [open]);

  if (!lead) return null;

  const parsed  = parseInt(value.replace(/[^0-9]/g, ""), 10);
  const isValid = !isNaN(parsed) && parsed > 0;
  const newTotal = (lead.raised ?? 0) + (isValid ? parsed : 0);

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try { await onSave(parsed); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} width={460} labelledBy="earning-modal-title">
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 pr-3">
          <h2 id="earning-modal-title" className="text-[18px] font-semibold text-ink dark:text-d-ink">
            Add Earning
          </h2>
          <p className="text-[14px] font-medium text-body dark:text-d-body mt-0.5 truncate">{lead.businessName}</p>
          <p className="text-[12px] text-mute mt-1">
            Current total: <span className="font-semibold text-positive">{formatMoney(lead.raised ?? 0)}</span>
            {isValid && (
              <> · After: <span className="font-semibold text-positive">{formatMoney(newTotal)}</span></>
            )}
          </p>
        </div>
        <button onClick={onClose} className="text-mute hover:text-ink dark:hover:text-d-ink p-1 shrink-0">
          <X size={18} />
        </button>
      </div>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-mute text-[15px] font-medium select-none">$</span>
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="0"
          className="w-full bg-canvas dark:bg-d-canvas text-ink dark:text-d-ink border border-line dark:border-d-line rounded-[14px] pl-8 pr-4 py-3 text-[16px] font-semibold placeholder:text-mute focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={!isValid} leftIcon={<Check size={14} />}>
          Add earning
        </Button>
      </div>
    </Modal>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const qc     = useQueryClient();

  // Dashboard aggregate stats
  const { data: stats } = useQuery<DashboardStats>({
    queryKey:      ["dashboard-stats"],
    queryFn:       () => fetch("/api/dashboard").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  // All campaigns (for the Winning Leads filter dropdown)
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn:  () => fetch("/api/campaigns").then((r) => r.json()),
  });

  // Closed leads only — for the Winning Leads table
  const { data: closedLeads = [] } = useQuery<ClosedLead[]>({
    queryKey: ["closed-leads"],
    queryFn:  async () => {
      const leads = await fetch("/api/leads?status=CLOSED").then((r) => r.json()) as Lead[];
      return leads.map((l) => ({
        ...l,
        campaignName: campaigns.find((c) => c.id === l.campaignId)?.name,
      }));
    },
    enabled: campaigns.length > 0,
  });

  // Global run history
  const { data: allRuns = [] } = useQuery<RunEntry[]>({
    queryKey:        ["all-runs"],
    queryFn:         () => fetch("/api/scrape/runs").then((r) => r.json()),
    refetchInterval: 15_000,
  });

  // ── Derived values ─────────────────────────────────────────────────────────

  const f = stats?.funnel;
  const e = stats?.earnings;
  const h = stats?.health;

  const totalLeads    = f?.totalLeads    ?? 0;
  const contacted     = f?.contacted     ?? 0;
  const replied       = f?.replied       ?? 0;
  const closed        = f?.closed        ?? 0;
  const campaignCount = f?.campaignCount ?? campaigns.length;

  const totalEarned      = e?.totalEarned      ?? 0;
  const avgDeal          = e?.avgDeal          ?? 0;
  const thisMonthEarned  = e?.thisMonthEarned  ?? 0;
  const monthlyTrend     = e?.monthlyTrend     ?? [];

  const conversion = totalLeads > 0 ? Math.round((replied / totalLeads) * 100) : 0;

  // ── Winning leads filter state ─────────────────────────────────────────────

  const [search, setCampaignSearch] = React.useState("");
  const [campaignFilter, setCampaignFilter] = React.useState("ALL");
  const [selected, setSelected] = React.useState(new Set<string>());
  const [leadsPage, setLeadsPage] = React.useState(1);
  const [notesLead, setNotesLead] = React.useState<ClosedLead | null>(null);
  const [earningLead, setEarningLead] = React.useState<ClosedLead | null>(null);

  const filteredLeads = React.useMemo(() =>
    closedLeads.filter((l) => {
      const matchCampaign = campaignFilter === "ALL" || l.campaignId === campaignFilter;
      const matchSearch   = !search || (
        (l.businessName ?? "") + (l.phone ?? "") + (l.websiteUrl ?? "") + (l.notes ?? "") + (l.campaignName ?? "")
      ).toLowerCase().includes(search.toLowerCase());
      return matchCampaign && matchSearch;
    }),
    [closedLeads, campaignFilter, search]
  );

  React.useEffect(() => { setLeadsPage(1); }, [campaignFilter, search]);

  const LEADS_PAGE_SIZE  = 10;
  const leadsTotalPages  = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PAGE_SIZE));
  const leadsSafePage    = Math.min(leadsPage, leadsTotalPages);
  const leadsPageRows    = filteredLeads.slice((leadsSafePage - 1) * LEADS_PAGE_SIZE, leadsSafePage * LEADS_PAGE_SIZE);

  const filteredEarnings = filteredLeads.reduce((s, l) => s + (l.raised ?? 0), 0);
  const allSelected      = filteredLeads.length > 0 && filteredLeads.every((r) => selected.has(r.id));
  const someSelected     = filteredLeads.some((r) => selected.has(r.id)) && !allSelected;

  const toggleAll = (on: boolean) => {
    const next = new Set(selected);
    filteredLeads.forEach((r) => on ? next.add(r.id) : next.delete(r.id));
    setSelected(next);
  };
  const toggleOne = (id: string, on: boolean) => {
    const next = new Set(selected);
    on ? next.add(id) : next.delete(id);
    setSelected(next);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-8 py-10 max-w-[1480px] mx-auto pb-32">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[32px] sm:text-[36px] font-bold text-ink dark:text-d-ink leading-tight tracking-tight">Outrich Manager</h1>
          <p className="text-[14px] text-mute mt-1.5">
            {campaignCount} campaign{campaignCount !== 1 ? "s" : ""} · {closed} closed deal{closed !== 1 ? "s" : ""} · {formatMoney(totalEarned)} earned to date
          </p>
        </div>
        <Link href="/googlemaps">
          <Button variant="primary" size="md" leftIcon={<MapPin size={14} />}>Open scraper</Button>
        </Link>
      </div>

      {/* ── Outreach funnel ── */}
      <SectionLabel className="mt-10" title="Outreach funnel" hint="Across all campaigns" />
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total leads"
          value={totalLeads.toLocaleString()}
          icon={<User size={18} />}
          sub={`Across ${campaignCount} campaign${campaignCount !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Contacted"
          value={contacted.toLocaleString()}
          icon={<Phone size={18} />}
          sub={totalLeads ? `${Math.round((contacted / totalLeads) * 100)}% of total` : "No leads yet"}
        />
        <StatCard
          label="Replied"
          value={replied.toLocaleString()}
          icon={<History size={18} />}
          sub={totalLeads ? `${Math.round((replied / totalLeads) * 100)}% of total` : "No leads yet"}
        />
        <StatCard
          label="Closed"
          value={closed.toLocaleString()}
          icon={<CheckCircle size={18} />}
          sub={totalLeads ? `${Math.round((closed / totalLeads) * 100)}% of total` : "No leads yet"}
          tone="ink"
        />
      </div>

      {/* ── Earnings ── */}
      <SectionLabel className="mt-10" title="Earnings" hint="From closed leads" />
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Conversion"
          value={`${conversion}%`}
          icon={<Sparkles size={18} />}
          sub="replied + closed / total"
        />
        <StatCard
          label="Total earned"
          value={formatMoney(totalEarned)}
          icon={<CheckCircle size={18} />}
          sub={closed > 0 ? `Avg deal ${formatMoney(avgDeal)}` : "No closed deals yet"}
        />
        <StatCard
          label="This month"
          value={thisMonthEarned > 0 ? formatMoney(thisMonthEarned) : "—"}
          icon={<TrendingUp size={18} />}
          sub={thisMonthEarned > 0 ? "from closed deals" : "No closed deals this month"}
        />
        <StatCard
          label="Monthly trend"
          value=""
          accent={
            monthlyTrend.some((m) => m.earned > 0)
              ? <TrendBars data={monthlyTrend} />
              : <div className="mt-4 text-[12px] text-mute">No earnings data yet</div>
          }
        />
      </div>

      {/* ── Campaign health ── */}
      <SectionLabel className="mt-10" title="Campaign health" hint="Performance across all scraper runs" />
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total runs"
          value={h?.totalRunCount != null ? h.totalRunCount.toLocaleString() : "—"}
          icon={<History size={18} />}
          sub={h?.totalRunCount ? `${h.totalRunCount} run${h.totalRunCount !== 1 ? "s" : ""} recorded` : "No runs yet"}
        />
        <StatCard
          label="Avg. run time"
          value={h?.avgDurationSec != null ? fmtDuration(h.avgDurationSec) : "—"}
          icon={<RotateCcw size={18} />}
          sub="per completed run"
        />
        <StatCard
          label="Avg. dupes"
          value={h?.avgDupes != null ? h.avgDupes.toLocaleString() : "—"}
          icon={<Filter size={18} />}
          sub="per run (deduped)"
        />
        <StatCard
          label={h?.hasBlock ? "Block detected" : "No active block"}
          value={h?.hasBlock ? "Check runs" : "Clear to run"}
          valueClassName={`text-[22px] !font-bold ${h?.hasBlock ? "text-negative" : "text-positive"}`}
          icon={<CheckCircle size={16} className={h?.hasBlock ? "text-negative" : "text-positive"} />}
          sub={h?.hasBlock ? "A recent run was blocked" : "No active rate limit"}
        />
      </div>

      {/* ── Winning Leads ── */}
      <div className="mt-12 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[20px] font-semibold text-ink dark:text-d-ink">Winning Leads</h2>
          <p className="text-[12px] text-mute mt-0.5">
            {filteredLeads.length} of {closedLeads.length} shown ·{" "}
            <span className="text-positive font-semibold">{formatMoney(filteredEarnings)}</span> raised
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Search by name, phone, notes…"
            value={search}
            onChange={(e) => setCampaignSearch(e.target.value)}
            className="w-[280px]"
          />
          <Select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="w-[200px]">
            <option value="ALL">All campaigns</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-canvas-soft/60 dark:bg-d-canvas-soft/60">
              <tr className="text-[11px] uppercase tracking-wider text-mute font-semibold">
                <th className="py-3 pl-5 pr-3 w-10">
                  <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                </th>
                <th className="py-3 px-3">Business</th>
                <th className="py-3 px-3">Phone</th>
                <th className="py-3 px-3">Email</th>
                <th className="py-3 px-3">Website</th>
                <th className="py-3 px-3">Notes</th>
                <th className="py-3 px-3 text-right">Raised</th>
                <th className="py-3 px-3 pr-5 text-right">Added</th>
              </tr>
            </thead>
            <tbody>
              {leadsPageRows.map((l) => (
                <tr
                  key={l.id}
                  className={`group border-t border-line/60 dark:border-d-line/60 text-[14px] hover:bg-canvas-soft/60 dark:hover:bg-d-canvas-soft/60 transition-colors${selected.has(l.id) ? " bg-primary-pale/40 dark:bg-primary/10" : ""}`}
                >
                  <td className="py-3.5 pl-5 pr-3"><Checkbox checked={selected.has(l.id)} onChange={(on) => toggleOne(l.id, on)} /></td>
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-ink dark:text-d-ink truncate max-w-[220px]">{l.businessName}</div>
                    {l.campaignName && (
                      <Link
                        href={`/googlemaps/${l.campaignId}`}
                        className="text-[12px] text-mute hover:text-ink dark:hover:text-d-ink mt-0.5 inline-flex items-center gap-1"
                      >
                        <MapPin size={10} /> {l.campaignName}
                      </Link>
                    )}
                  </td>
                  <td className="py-3.5 px-3">
                    {l.phone
                      ? <a href={`tel:${l.phone}`} className="text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink tabular-nums inline-flex items-center gap-1.5"><Phone size={12} className="text-mute" />{l.phone}</a>
                      : <span className="text-mute">—</span>}
                  </td>
                  <td className="py-3.5 px-3">
                    {l.email
                      ? <a href={`mailto:${l.email}`} className="text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink inline-flex items-center gap-1.5 max-w-[200px] truncate"><Mail size={12} className="text-mute shrink-0" />{l.email}</a>
                      : <span className="text-mute">—</span>}
                  </td>
                  <td className="py-3.5 px-3">
                    {l.websiteUrl
                      ? <a href={l.websiteUrl} target="_blank" rel="noreferrer" className="text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink inline-flex items-center gap-1 max-w-[180px] truncate">{l.normalizedDomain ?? l.websiteUrl}<ExternalLink size={11} className="text-mute shrink-0" /></a>
                      : <span className="text-mute">—</span>}
                  </td>
                  <td className="py-3.5 px-3 max-w-[260px]">
                    {l.notes ? (
                      <button
                        onClick={() => setNotesLead(l)}
                        className="text-[13px] text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink line-clamp-1 max-w-[240px] text-left"
                      >
                        {l.notes}
                      </button>
                    ) : (
                      <button
                        onClick={() => setNotesLead(l)}
                        className="text-[13px] text-mute inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:text-ink dark:hover:text-d-ink transition-opacity"
                      >
                        <StickyNote size={11} /> Add note
                      </button>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <button
                      onClick={() => setEarningLead(l)}
                      className="group/earn inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                    >
                      <DollarSign size={12} className="text-positive opacity-0 group-hover/earn:opacity-100 transition-opacity" />
                      <span className="text-[15px] font-bold tabular-nums text-positive">{formatMoney(l.raised ?? 0)}</span>
                    </button>
                  </td>
                  <td className="py-3.5 px-3 pr-5 text-right text-[12px] text-mute">
                    {l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-mute text-sm">
                    {closedLeads.length === 0 ? "No winning leads yet — close some deals to see them here." : "No leads match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
            {filteredLeads.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-line dark:border-d-line text-[13px] font-semibold bg-canvas-soft/40 dark:bg-d-canvas-soft/40">
                  <td className="py-3 pl-5 pr-3" />
                  <td className="py-3 px-3 text-ink dark:text-d-ink" colSpan={5}>
                    {filteredLeads.length === closedLeads.length ? "Total raised" : "Filtered total"}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-positive text-[16px]">{formatMoney(filteredEarnings)}</td>
                  <td className="py-3 px-3 pr-5" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {filteredLeads.length > LEADS_PAGE_SIZE && (
          <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-t border-line dark:border-d-line text-[13px]">
            <div className="text-mute">
              Showing{" "}
              <span className="text-ink dark:text-d-ink font-medium">
                {(leadsSafePage - 1) * LEADS_PAGE_SIZE + 1}–{Math.min(filteredLeads.length, leadsSafePage * LEADS_PAGE_SIZE)}
              </span>{" "}
              of {filteredLeads.length}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLeadsPage((p) => Math.max(1, p - 1))}
                disabled={leadsSafePage === 1}
                className="p-1.5 rounded-[10px] hover:bg-canvas-soft dark:hover:bg-d-canvas-soft text-ink dark:text-d-ink disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="px-2 text-mute">Page <span className="text-ink dark:text-d-ink font-medium">{leadsSafePage}</span> of {leadsTotalPages}</div>
              <button
                onClick={() => setLeadsPage((p) => Math.min(leadsTotalPages, p + 1))}
                disabled={leadsSafePage === leadsTotalPages}
                className="p-1.5 rounded-[10px] hover:bg-canvas-soft dark:hover:bg-d-canvas-soft text-ink dark:text-d-ink disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </Card>

      <BulkActionsBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            type: "menu", label: "Export",
            icon: <Download size={14} />,
            items: [
              { label: "Export selected as CSV", onClick: () => setSelected(new Set()) },
            ],
          },
          { type: "divider" },
          {
            type: "button", label: "Remove", icon: <Trash2 size={14} />, danger: true,
            onClick: async () => {
              await Promise.all(
                Array.from(selected).map((id) =>
                  fetch(`/api/leads/${id}`, { method: "DELETE" })
                )
              );
              setSelected(new Set());
              qc.invalidateQueries({ queryKey: ["closed-leads"] });
              qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
            },
          },
        ]}
      />

      {notesLead && (
        <NotesModal
          open={!!notesLead}
          lead={notesLead}
          onClose={() => setNotesLead(null)}
          onSave={async (notes) => {
            await fetch(`/api/leads/${notesLead.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notes }),
            });
            qc.invalidateQueries({ queryKey: ["closed-leads"] });
            setNotesLead(null);
          }}
        />
      )}

      {earningLead && (
        <AddEarningModal
          open={!!earningLead}
          lead={earningLead}
          onClose={() => setEarningLead(null)}
          onSave={async (amount) => {
            const newRaised = (earningLead.raised ?? 0) + amount;
            await fetch(`/api/leads/${earningLead.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ raised: newRaised }),
            });
            qc.invalidateQueries({ queryKey: ["closed-leads"] });
            qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
            setEarningLead(null);
          }}
        />
      )}

      {/* ── Global Run History ── */}
      <SectionLabel className="mt-12" title="Run history" hint="Every scrape run, across every campaign" />
      <div className="mt-3">
        <RunHistoryCard
          title="All runs"
          subtitle={allRuns.length === 0 ? "No runs yet — start a campaign to see runs here" : undefined}
          runs={allRuns}
          showCampaign
          onOpenCampaign={(id) => router.push(`/googlemaps/${id}`)}
        />
      </div>
    </div>
  );
}
