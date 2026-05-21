"use client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { Campaign } from "@prisma/client";
import { AlertTriangle, Play } from "lucide-react";
import * as React from "react";

interface Props {
  open: boolean;
  campaign: Campaign;
  onClose: () => void;
  onStarted: (runId: string) => void;
}

export function RunCampaignModal({ open, campaign, onClose, onStarted }: Props) {
  const toast = useToast();
  const [mode, setMode] = React.useState<"add" | "replace">("add");
  const [confirmReplace, setConfirmReplace] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) { setMode("add"); setConfirmReplace(false); }
  }, [open]);

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
        body:    JSON.stringify({ campaignId: campaign.id, replaceAll: mode === "replace" }),
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

  return (
    <Modal open={open} onClose={onClose} width={520} labelledBy="run-modal-title">
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
          <label
            onClick={() => { setMode("add"); setConfirmReplace(false); }}
            className={`flex items-start gap-3 rounded-[14px] border-2 px-4 py-3.5 cursor-pointer transition-colors ${
              mode === "add"
                ? "border-primary bg-primary/10 dark:bg-primary/15"
                : "border-line dark:border-d-line hover:border-primary/40"
            }`}
          >
            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              mode === "add" ? "border-primary" : "border-line dark:border-d-line"
            }`}>
              {mode === "add" && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
            <div>
              <div className="text-[14px] font-semibold text-ink dark:text-d-ink">Add new leads only</div>
              <div className="text-[12.5px] text-mute mt-0.5">Skip results that already exist in this campaign.</div>
            </div>
          </label>

          <label
            onClick={() => setMode("replace")}
            className={`flex items-start gap-3 rounded-[14px] border-2 px-4 py-3.5 cursor-pointer transition-colors ${
              mode === "replace"
                ? "border-negative bg-negative/10"
                : "border-line dark:border-d-line hover:border-negative/40"
            }`}
          >
            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              mode === "replace" ? "border-negative" : "border-line dark:border-d-line"
            }`}>
              {mode === "replace" && <div className="w-2 h-2 rounded-full bg-negative" />}
            </div>
            <div>
              <div className="text-[14px] font-semibold text-ink dark:text-d-ink">Replace all leads with fresh data</div>
              <div className="text-[12.5px] text-mute mt-0.5">Deletes all existing leads for this campaign first.</div>
            </div>
          </label>
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
