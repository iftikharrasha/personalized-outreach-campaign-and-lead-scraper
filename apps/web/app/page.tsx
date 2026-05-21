"use client";
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RunHistoryCard } from "@/components/ui/run-history-card";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import type { Campaign, Lead } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  Download,
  ExternalLink,
  Filter,
  History,
  MapPin,
  Phone,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

function formatMoney(n: number) {
  return "$" + (n || 0).toLocaleString("en-US");
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

type ClosedLead = Lead & { campaignName?: string };

export default function DashboardPage() {
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: () => fetch("/api/campaigns").then((r) => r.json()),
  });
  const { data: allLeads = [] } = useQuery<Lead[]>({
    queryKey: ["all-leads"],
    queryFn: () => fetch("/api/leads").then((r) => r.json()),
  });

  const [search, setSearch] = React.useState("");
  const [campaignFilter, setCampaignFilter] = React.useState("ALL");
  const [selected, setSelected] = React.useState(new Set<string>());

  const totalLeads = allLeads.length;
  const contacted = allLeads.filter((l) => ["CONTACTED", "REPLIED", "CLOSED"].includes(l.status ?? "")).length;
  const replied = allLeads.filter((l) => l.status === "REPLIED" || l.status === "CLOSED").length;
  const closed = allLeads.filter((l) => l.status === "CLOSED").length;
  const conversion = totalLeads ? Math.round((replied + closed) / totalLeads * 100) : 0;

  const closedLeads: ClosedLead[] = React.useMemo(() =>
    allLeads
      .filter((l) => l.status === "CLOSED")
      .map((l) => ({
        ...l,
        campaignName: campaigns.find((c) => c.id === l.campaignId)?.name,
      })),
    [allLeads, campaigns]
  );

  const totalEarned = closedLeads.reduce((s, l) => s + (l.raised ?? 0), 0);
  const avgDeal = closed ? Math.round(totalEarned / closed) : 0;

  const filtered = React.useMemo(() =>
    closedLeads.filter((l) => {
      const matchCampaign = campaignFilter === "ALL" || l.campaignId === campaignFilter;
      const matchSearch = !search || (l.businessName + (l.phone ?? "") + (l.websiteUrl ?? "") + (l.notes ?? "") + (l.campaignName ?? "")).toLowerCase().includes(search.toLowerCase());
      return matchCampaign && matchSearch;
    }),
    [closedLeads, campaignFilter, search]
  );

  const filteredEarnings = filtered.reduce((s, l) => s + (l.raised ?? 0), 0);
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someSelected = filtered.some((r) => selected.has(r.id)) && !allSelected;

  const toggleAll = (on: boolean) => {
    const next = new Set(selected);
    filtered.forEach((r) => on ? next.add(r.id) : next.delete(r.id));
    setSelected(next);
  };
  const toggleOne = (id: string, on: boolean) => {
    const next = new Set(selected);
    on ? next.add(id) : next.delete(id);
    setSelected(next);
  };

  return (
    <div className="px-8 py-10 max-w-[1480px] mx-auto pb-32">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[32px] sm:text-[36px] font-bold text-ink dark:text-d-ink leading-tight tracking-tight">Outrich Manager</h1>
          <p className="text-[14px] text-mute mt-1.5">
            {campaigns.length} campaigns · {closed} closed deals · {formatMoney(totalEarned)} earned to date
          </p>
        </div>
        <Link href="/googlemaps">
          <Button variant="primary" size="md" leftIcon={<MapPin size={14} />}>Open scraper</Button>
        </Link>
      </div>

      {/* Row 1 — Outreach funnel */}
      <SectionLabel className="mt-10" title="Outreach funnel" hint="Across all campaigns" />
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total leads" value={totalLeads.toLocaleString()} icon={<User size={18} />} sub={`Across ${campaigns.length} campaigns`} />
        <StatCard label="Contacted" value={contacted.toLocaleString()} icon={<Phone size={18} />} sub={totalLeads ? `${Math.round(contacted / totalLeads * 100)}% of total` : "—"} />
        <StatCard label="Replied" value={replied.toLocaleString()} icon={<History size={18} />} sub={totalLeads ? `${Math.round(replied / totalLeads * 100)}% of total` : "—"} />
        <StatCard label="Closed" value={closed.toLocaleString()} icon={<CheckCircle size={18} />} sub={totalLeads ? `${Math.round(closed / totalLeads * 100)}% of total` : "—"} tone="ink" />
      </div>

      {/* Row 2 — Earnings */}
      <SectionLabel className="mt-10" title="Earnings" hint="From closed leads" />
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Conversion" value={`${conversion}%`} icon={<Sparkles size={18} />} sub="replied + closed / total" />
        <StatCard label="Total earned" value={formatMoney(totalEarned)} icon={<CheckCircle size={18} />} sub={`Avg deal ${formatMoney(avgDeal)}`} />
        <StatCard label="This month" value="—" icon={<TrendingUp size={18} />} sub="No data yet" />
        <StatCard label="Monthly avg." value="—" accent={<TrendBars data={[]} />} />
      </div>

      {/* Row 3 — Scraper health */}
      <SectionLabel className="mt-10" title="Campaign health" hint="Performance of the scraper itself" />
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total run time" value="—" icon={<History size={18} />} sub="No runs yet" />
        <StatCard label="Avg. completion" value="—" icon={<RotateCcw size={18} />} sub="per campaign run" />
        <StatCard label="Avg. dupes" value="—" icon={<Filter size={18} />} sub="per single run" />
        <StatCard label="No active block" value="Clear to run" valueClassName="text-[28px] !font-bold text-positive" icon={<CheckCircle size={16} className="text-positive" />} sub="No active rate limit." />
      </div>

      {/* Global Run History */}
      <SectionLabel className="mt-12" title="Run history" hint="Every scrape run, across every campaign" />
      <div className="mt-3">
        <RunHistoryCard
          title="All runs"
          subtitle="No runs yet — runs appear after Phase 2"
          runs={[]}
          showCampaign
        />
      </div>

      {/* Winning Leads */}
      <div className="mt-12 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[20px] font-semibold text-ink dark:text-d-ink">Winning Leads</h2>
          <p className="text-[12px] text-mute mt-0.5">
            {filtered.length} of {closedLeads.length} shown ·{" "}
            <span className="text-positive font-semibold">{formatMoney(filteredEarnings)}</span> raised
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Search by name, phone, notes…"
            value={search} onChange={(e) => setSearch(e.target.value)}
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
                <th className="py-3 px-3">Website</th>
                <th className="py-3 px-3">Notes</th>
                <th className="py-3 px-3 text-right">Raised</th>
                <th className="py-3 px-3 pr-5 text-right">Added</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className={`group border-t border-line/60 dark:border-d-line/60 text-[14px] hover:bg-canvas-soft/60 dark:hover:bg-d-canvas-soft/60 transition-colors${selected.has(l.id) ? " bg-primary-pale/40 dark:bg-primary/10" : ""}`}>
                  <td className="py-3.5 pl-5 pr-3"><Checkbox checked={selected.has(l.id)} onChange={(on) => toggleOne(l.id, on)} /></td>
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-ink dark:text-d-ink truncate max-w-[220px]">{l.businessName}</div>
                    {l.campaignName && (
                      <Link href={`/googlemaps/${l.campaignId}`} className="text-[12px] text-mute hover:text-ink dark:hover:text-d-ink mt-0.5 inline-flex items-center gap-1">
                        <MapPin size={10} /> {l.campaignName}
                      </Link>
                    )}
                  </td>
                  <td className="py-3.5 px-3">
                    {l.phone ? (
                      <a href={`tel:${l.phone}`} className="text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink tabular-nums inline-flex items-center gap-1.5">
                        <Phone size={12} className="text-mute" />{l.phone}
                      </a>
                    ) : <span className="text-mute">—</span>}
                  </td>
                  <td className="py-3.5 px-3">
                    {l.websiteUrl ? (
                      <a href={l.websiteUrl} target="_blank" rel="noreferrer" className="text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink inline-flex items-center gap-1 max-w-[180px] truncate">
                        {l.normalizedDomain ?? l.websiteUrl}<ExternalLink size={11} className="text-mute shrink-0" />
                      </a>
                    ) : <span className="text-mute">—</span>}
                  </td>
                  <td className="py-3.5 px-3 max-w-[260px]">
                    <div className="text-[13px] text-body dark:text-d-body line-clamp-1 max-w-[240px]">{l.notes ?? <span className="text-mute italic">—</span>}</div>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <span className="text-[15px] font-bold tabular-nums text-positive">{formatMoney(l.raised ?? 0)}</span>
                  </td>
                  <td className="py-3.5 px-3 pr-5 text-right text-[12px] text-mute">
                    {l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-16 text-center text-mute text-sm">No winning leads yet. Close some deals first.</td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-line dark:border-d-line text-[13px] font-semibold bg-canvas-soft/40 dark:bg-d-canvas-soft/40">
                  <td className="py-3 pl-5 pr-3" />
                  <td className="py-3 px-3 text-ink dark:text-d-ink" colSpan={4}>
                    {filtered.length === closedLeads.length ? "Total raised" : "Filtered total"}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-positive text-[16px]">{formatMoney(filteredEarnings)}</td>
                  <td className="py-3 px-3 pr-5" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
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
          { type: "button", label: "Remove", icon: <Trash2 size={14} />, danger: true, onClick: () => setSelected(new Set()) },
        ]}
      />
    </div>
  );
}
