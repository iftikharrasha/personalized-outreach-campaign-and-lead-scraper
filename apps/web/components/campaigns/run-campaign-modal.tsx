"use client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { Campaign } from "@prisma/client";
import { AlertTriangle, Globe, Phone, Play, ShieldCheck } from "lucide-react";
import * as React from "react";

interface LeadFilter {
  phone:       "required" | "optional";
  website:     "required" | "optional";
  contactMode: "either"   | "both";
}

interface Props {
  open: boolean;
  campaign: Campaign;
  onClose: () => void;
  onStarted: (runId: string) => void;
}

// ── Small radio-card used for filter options ──────────────────────────────────

function OptionCard({
  selected,
  onClick,
  tone = "primary",
  children,
}: {
  selected: boolean;
  onClick: () => void;
  tone?: "primary" | "negative";
  children: React.ReactNode;
}) {
  const ring = tone === "negative"
    ? selected ? "border-negative bg-negative/10" : "border-line dark:border-d-line hover:border-negative/40"
    : selected ? "border-primary bg-primary/10 dark:bg-primary/15" : "border-line dark:border-d-line hover:border-primary/40";

  const dot = tone === "negative" ? "border-negative" : "border-primary";
  const fill = tone === "negative" ? "bg-negative" : "bg-primary";

  return (
    <label
      onClick={onClick}
      className={`flex items-start gap-3 rounded-[14px] border-2 px-4 py-3.5 cursor-pointer transition-colors ${ring}`}
    >
      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? dot : "border-line dark:border-d-line"}`}>
        {selected && <div className={`w-2 h-2 rounded-full ${fill}`} />}
      </div>
      <div className="min-w-0">{children}</div>
    </label>
  );
}

// ── Filter summary pill shown in collapsed state ──────────────────────────────

function filterSummary(f: LeadFilter): string {
  const parts: string[] = [];
  if (f.phone   === "required") parts.push("phone");
  if (f.website === "required") parts.push("website");

  if (parts.length === 0) {
    if (f.contactMode === "either") return "Phone or website required";
    if (f.contactMode === "both")   return "Phone and website required";
    return "No contact filter";
  }
  if (parts.length === 2) return "Phone + website required";
  return `${parts[0]!.charAt(0).toUpperCase() + parts[0]!.slice(1)} required`;
}

// ── Inline toggle for required / optional ─────────────────────────────────────

function RequirementToggle({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: "required" | "optional";
  onChange: (v: "required" | "optional") => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-[13.5px] text-ink dark:text-d-ink font-medium">
        <span className="text-mute">{icon}</span>
        {label}
      </div>
      <div className="flex rounded-[10px] overflow-hidden border border-line dark:border-d-line text-[12px] font-medium shrink-0">
        <button
          onClick={() => onChange("required")}
          className={`px-3 py-1.5 transition-colors ${
            value === "required"
              ? "bg-primary text-white"
              : "bg-canvas dark:bg-d-canvas text-mute hover:text-ink dark:hover:text-d-ink"
          }`}
        >
          Required
        </button>
        <button
          onClick={() => onChange("optional")}
          className={`px-3 py-1.5 border-l border-line dark:border-d-line transition-colors ${
            value === "optional"
              ? "bg-canvas-soft dark:bg-d-canvas-soft text-ink dark:text-d-ink"
              : "bg-canvas dark:bg-d-canvas text-mute hover:text-ink dark:hover:text-d-ink"
          }`}
        >
          Optional
        </button>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

const DEFAULT_FILTER: LeadFilter = {
  phone:       "optional",
  website:     "optional",
  contactMode: "either",
};

export function RunCampaignModal({ open, campaign, onClose, onStarted }: Props) {
  const toast = useToast();
  const [mode, setMode]               = React.useState<"add" | "replace">("add");
  const [confirmReplace, setConfirmReplace] = React.useState(false);
  const [filter, setFilter]           = React.useState<LeadFilter>(DEFAULT_FILTER);
  const [filterOpen, setFilterOpen]   = React.useState(false);
  const [loading, setLoading]         = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMode("add");
      setConfirmReplace(false);
      setFilter(DEFAULT_FILTER);
      setFilterOpen(false);
    }
  }, [open]);

  const patchFilter = (patch: Partial<LeadFilter>) =>
    setFilter((f) => ({ ...f, ...patch }));

  // Derive whether any filter is active (non-default)
  const filterActive =
    filter.phone !== "optional" ||
    filter.website !== "optional" ||
    filter.contactMode !== "either";

  const handleStart = async () => {
    if (mode === "replace" && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/scrape/run", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          campaignId: campaign.id,
          replaceAll: mode === "replace",
          leadFilter: filter,
        }),
      });

      if (res.status === 409) {
        const data = await res.json() as { runId?: string };
        toast.show({ type: "warning", title: "Already running", message: "This campaign has an active run." });
        if (data.runId) onStarted(data.runId);
        onClose();
        return;
      }

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        toast.show({ type: "error", title: "Failed to start", message: data.error ?? "Unknown error" });
        return;
      }

      const data = await res.json() as { runId: string };
      toast.show({ type: "success", title: "Scraping started", message: `Searching for "${campaign.keyword}"…` });
      onStarted(data.runId);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // Determine if "both" contact mode should be highlighted as the constraint description
  const bothActive = filter.phone === "required" && filter.website === "required";

  return (
    <Modal open={open} onClose={onClose} width={540} labelledBy="run-modal-title">
      <div className="flex flex-col gap-5">
        <h2 id="run-modal-title" className="text-[20px] font-semibold text-ink dark:text-d-ink leading-snug">
          Run Campaign: <span className="truncate">{campaign.name}</span>
        </h2>

        {/* Keyword preview */}
        <div className="rounded-[14px] bg-canvas-soft dark:bg-d-canvas-soft px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-mute font-semibold mb-1">Search keyword</div>
          <div className="text-[15px] font-medium text-ink dark:text-d-ink">"{campaign.keyword}"</div>
        </div>

        {/* Mode selection */}
        <div className="flex flex-col gap-2">
          <OptionCard selected={mode === "add"} onClick={() => { setMode("add"); setConfirmReplace(false); }}>
            <div className="text-[14px] font-semibold text-ink dark:text-d-ink">Add new leads only</div>
            <div className="text-[12.5px] text-mute mt-0.5">Skip results that already exist in this campaign.</div>
          </OptionCard>
          <OptionCard selected={mode === "replace"} onClick={() => setMode("replace")} tone="negative">
            <div className="text-[14px] font-semibold text-ink dark:text-d-ink">Replace all leads with fresh data</div>
            <div className="text-[12.5px] text-mute mt-0.5">Deletes all existing leads for this campaign first.</div>
          </OptionCard>
        </div>

        {/* Replace confirmation warning */}
        {confirmReplace && mode === "replace" && (
          <div className="flex items-start gap-3 rounded-[14px] bg-negative/10 border border-negative/30 px-4 py-3">
            <AlertTriangle size={16} className="text-negative shrink-0 mt-0.5" />
            <div>
              <div className="text-[13.5px] font-semibold text-ink dark:text-d-ink">Confirm: delete all existing leads?</div>
              <div className="text-[12.5px] text-mute mt-0.5">
                All {campaign.totalLeads} lead{campaign.totalLeads === 1 ? "" : "s"} in "{campaign.name}" will be permanently deleted. This cannot be undone.
              </div>
            </div>
          </div>
        )}

        {/* ── Lead Quality Filter ─────────────────────────────────────────── */}
        <div className="rounded-[14px] border border-line dark:border-d-line overflow-hidden">
          {/* Header — always visible, acts as toggle */}
          <button
            onClick={() => setFilterOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-canvas-soft dark:hover:bg-d-canvas-soft transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={15} className={filterActive ? "text-primary" : "text-mute"} />
              <div>
                <span className="text-[13.5px] font-semibold text-ink dark:text-d-ink">Lead quality filter</span>
                {!filterOpen && (
                  <span className="ml-2 text-[12px] text-mute">
                    {filterActive
                      ? <span className="text-primary font-medium">{filterSummary(filter)}</span>
                      : "No filter — accept all leads"}
                  </span>
                )}
              </div>
            </div>
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              className={`text-mute transition-transform ${filterOpen ? "rotate-180" : ""}`}
            >
              <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Expanded filter controls */}
          {filterOpen && (
            <div className="border-t border-line dark:border-d-line px-4 py-4 flex flex-col gap-4 animate-fadein">
              <p className="text-[12px] text-mute leading-relaxed">
                Leads that don't meet your criteria are silently skipped during the scrape — they won't appear in your table.
              </p>

              {/* Phone & website requirements */}
              <div className="flex flex-col gap-3">
                <RequirementToggle
                  icon={<Phone size={13} />}
                  label="Phone number"
                  value={filter.phone}
                  onChange={(v) => patchFilter({ phone: v })}
                />
                <RequirementToggle
                  icon={<Globe size={13} />}
                  label="Website / URL"
                  value={filter.website}
                  onChange={(v) => patchFilter({ website: v })}
                />
              </div>

              {/* Contact mode — only relevant when both are optional */}
              {filter.phone === "optional" && filter.website === "optional" && (
                <div className="flex flex-col gap-2 pt-1 border-t border-line/60 dark:border-d-line/60">
                  <div className="text-[11px] uppercase tracking-wider text-mute font-semibold">Minimum contact info</div>
                  <div className="flex flex-col gap-1.5">
                    <OptionCard
                      selected={filter.contactMode === "either"}
                      onClick={() => patchFilter({ contactMode: "either" })}
                    >
                      <div className="text-[13.5px] font-semibold text-ink dark:text-d-ink">Phone <span className="font-normal text-mute">or</span> website</div>
                      <div className="text-[12px] text-mute mt-0.5">Accept leads that have at least one contact method.</div>
                    </OptionCard>
                    <OptionCard
                      selected={filter.contactMode === "both"}
                      onClick={() => patchFilter({ contactMode: "both" })}
                    >
                      <div className="text-[13.5px] font-semibold text-ink dark:text-d-ink">Phone <span className="font-normal text-mute">and</span> website</div>
                      <div className="text-[12px] text-mute mt-0.5">Only accept leads that have both phone and website.</div>
                    </OptionCard>
                  </div>
                </div>
              )}

              {/* Summary chip */}
              <div className={`rounded-[10px] px-3.5 py-2.5 text-[12.5px] flex items-center gap-2 ${
                filterActive || bothActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-canvas-soft dark:bg-d-canvas-soft text-mute"
              }`}>
                <ShieldCheck size={13} className="shrink-0" />
                <span>
                  {!filterActive && !bothActive && "All leads will be saved regardless of contact info."}
                  {(filterActive || bothActive) && filterSummary(filter) + " — leads missing this will be skipped."}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 text-sm font-medium px-4 py-2.5 rounded-[14px] bg-canvas-soft dark:bg-d-canvas hover:bg-line dark:hover:bg-d-line text-ink dark:text-d-ink transition-colors"
          >
            Cancel
          </button>
          <Button
            variant={confirmReplace ? "destructive" : "primary"}
            size="md"
            className="flex-1"
            leftIcon={<Play size={14} />}
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? "Starting…" : confirmReplace ? "Delete & Start Scraping" : "Start Scraping"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
