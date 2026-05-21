"use client";
import { CreateCampaignModal } from "@/components/campaigns/create-campaign-modal";
import { EditCampaignModal } from "@/components/campaigns/edit-campaign-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { Progress } from "@/components/ui/progress";
import { StatusDot } from "@/components/ui/status-dot";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import type { Campaign } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, History, MapPin, MoreHorizontal, Pause, Pencil, Play, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import * as React from "react";

function abbrevState(name: string) {
  const map: Record<string, string> = {
    California: "CA", "New York": "NY", Illinois: "IL", Texas: "TX",
    Florida: "FL", Washington: "WA", Massachusetts: "MA", Colorado: "CO",
    Georgia: "GA", Oregon: "OR",
  };
  return map[name] ?? (name ?? "").slice(0, 2).toUpperCase();
}

function CampaignCard({ c, onEdit, onRefetch }: { c: Campaign; onEdit: (c: Campaign) => void; onRefetch: () => void }) {
  const toast = useToast();
  const isArchived = c.status === "ARCHIVED";
  const isPaused = c.status === "PAUSED";

  const patchStatus = async (status: string) => {
    await fetch(`/api/campaigns/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onRefetch();
  };

  const handlePause = async () => {
    await patchStatus("PAUSED");
    toast.show({ type: "success", title: "Campaign paused", message: `${c.name} won't run until resumed.` });
  };
  const handleRestore = async () => {
    await patchStatus("ACTIVE");
    toast.show({ type: "success", title: isArchived ? "Campaign restored" : "Campaign resumed", message: c.name });
  };
  const handleArchive = async () => {
    await patchStatus("ARCHIVED");
    toast.show({ type: "success", title: "Campaign archived", message: `${c.name} moved to Archived.` });
  };

  return (
    <Card className="p-6 group hover:-translate-y-[2px] transition-transform duration-200 cursor-default flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold text-ink dark:text-d-ink leading-snug truncate">{c.name}</h3>
          <div className="text-[13px] text-mute mt-0.5 truncate">{c.keyword}</div>
        </div>
        <Menu
          trigger={
            <button className="p-1.5 -mr-1.5 rounded-[10px] text-mute hover:text-ink dark:hover:text-d-ink hover:bg-canvas-soft dark:hover:bg-d-canvas-soft opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal size={18} />
            </button>
          }
          items={[
            { label: "Edit", icon: <Pencil size={14} />, onClick: () => onEdit(c) },
            { divider: true },
            {
              label: isArchived ? "Restore" : "Archive",
              icon: isArchived ? <RotateCcw size={14} /> : <Archive size={14} />,
              onClick: isArchived ? handleRestore : handleArchive,
            },
          ]}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-body dark:text-d-body bg-canvas-soft dark:bg-d-canvas-soft rounded-full px-2.5 py-1">
          <MapPin size={11} />
          USA · {abbrevState(c.state)}{c.city ? ` · ${c.city}` : ""}
        </span>
        <StatusDot status={c.status} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[26px] font-bold leading-none text-ink dark:text-d-ink tabular-nums">{c.totalLeads}</div>
          <div className="text-[11px] text-mute mt-1 uppercase tracking-wide">Leads</div>
        </div>
        <div>
          <div className="text-[26px] font-bold leading-none text-ink dark:text-d-ink tabular-nums">0</div>
          <div className="text-[11px] text-mute mt-1 uppercase tracking-wide">Contacted</div>
        </div>
      </div>

      <div>
        <Progress value={0} />
        <div className="mt-2 flex items-center justify-between text-[12px]">
          <span className="text-mute">Outreach progress</span>
          <span className="font-semibold text-ink dark:text-d-ink">0%</span>
        </div>
      </div>

      <div className="text-[12px] text-mute flex items-center gap-1.5">
        <History size={12} />
        No runs yet
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Link href={`/googlemaps/${c.id}`} className="flex-1">
          <Button size="sm" variant="secondary" className="w-full">Open</Button>
        </Link>
        {!isArchived && (
          <Button size="sm" variant="primary" leftIcon={<Play size={13} />} disabled={isPaused} className="flex-1">
            Run
          </Button>
        )}
        {!isArchived && (
          <Button
            size="sm" variant="ghost"
            onClick={isPaused ? handleRestore : handlePause}
            leftIcon={isPaused ? <Play size={13} /> : <Pause size={13} />}
            className="!px-3"
            aria-label={isPaused ? "Resume" : "Pause"}
          />
        )}
        {isArchived && (
          <Button size="sm" variant="secondary" onClick={handleRestore} className="flex-1">Restore</Button>
        )}
      </div>
    </Card>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-24 flex flex-col items-center text-center max-w-[440px] mx-auto">
      <div className="w-20 h-20 rounded-full bg-canvas dark:bg-d-canvas flex items-center justify-center text-mute mb-6">
        <MapPin size={36} />
      </div>
      <h2 className="text-[24px] font-semibold text-ink dark:text-d-ink">No campaigns yet</h2>
      <p className="text-[14px] text-mute mt-2 leading-relaxed">
        Create your first campaign to start scraping leads from Google Maps. Each campaign is a single keyword tied to a location.
      </p>
      <Button variant="primary" size="lg" leftIcon={<Plus size={16} />} onClick={onCreate} className="mt-7">
        Create your first campaign
      </Button>
    </div>
  );
}

export default function CampaignListPage() {
  const qc = useQueryClient();
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: () => fetch("/api/campaigns").then((r) => r.json()),
  });

  const [search, setSearch] = React.useState("");
  const [tab, setTab] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingCampaign, setEditingCampaign] = React.useState<Campaign | null>(null);

  const refetch = () => qc.invalidateQueries({ queryKey: ["campaigns"] });

  const filtered = React.useMemo(() => {
    return campaigns.filter((c) => {
      const matchSearch = !search || (c.name + c.keyword).toLowerCase().includes(search.toLowerCase());
      const matchTab = tab === "all" || c.status.toLowerCase() === tab;
      return matchSearch && matchTab;
    });
  }, [campaigns, search, tab]);

  const counts = React.useMemo(() => ({
    all: campaigns.length,
    active: campaigns.filter((c) => c.status === "ACTIVE").length,
    paused: campaigns.filter((c) => c.status === "PAUSED").length,
    archived: campaigns.filter((c) => c.status === "ARCHIVED").length,
  }), [campaigns]);

  const totalLeads = campaigns.reduce((s, c) => s + c.totalLeads, 0);

  return (
    <div className="px-8 py-10 max-w-[1480px] mx-auto">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[32px] sm:text-[36px] font-bold text-ink dark:text-d-ink leading-tight tracking-tight">Campaigns</h1>
          <p className="text-[14px] text-mute mt-1.5">{counts.active} active · {totalLeads} leads scraped</p>
        </div>
        <Button variant="primary" size="lg" leftIcon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
          New Campaign
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-24 text-center text-mute text-sm">Loading…</div>
      ) : campaigns.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-3 justify-between">
            <Input
              placeholder="Search campaigns…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[280px] max-w-[420px]"
            />
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { value: "all", label: "All", count: counts.all },
                { value: "active", label: "Active", count: counts.active },
                { value: "paused", label: "Paused", count: counts.paused },
                { value: "archived", label: "Archived", count: counts.archived },
              ]}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {filtered.map((c) => (
              <CampaignCard key={c.id} c={c} onEdit={setEditingCampaign} onRefetch={refetch} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-20 text-center text-mute text-sm">No campaigns match your filters.</div>
            )}
          </div>
        </>
      )}

      <CreateCampaignModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refetch} />
      <EditCampaignModal
        open={!!editingCampaign}
        campaign={editingCampaign}
        onClose={() => setEditingCampaign(null)}
        onSaved={refetch}
        onArchived={() => { refetch(); setEditingCampaign(null); }}
      />
    </div>
  );
}
