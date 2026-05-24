"use client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { Campaign } from "@prisma/client";
import { AlertTriangle, Play } from "lucide-react";

// Augment until Prisma client regenerates after DLL lock is released
type YelpCampaign = Campaign & {
  apiOffset:         number;
  apiTotalAvailable: number | null;
};
import * as React from "react";

interface Props {
  open:      boolean;
  campaign:  YelpCampaign;
  onClose:   () => void;
  onStarted: (runId: string) => void;
}

export function YelpRunModal({ open, campaign, onClose, onStarted }: Props) {
  const toast   = useToast();
  const [count, setCount]     = React.useState("");
  const [error, setError]     = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const offset        = campaign.apiOffset ?? 0;
  const totalAvail    = campaign.apiTotalAvailable ?? null;
  const fullyFetched  = totalAvail !== null && offset >= totalAvail;
  const isFirstRun    = offset === 0;

  // Max the user can fetch this run
  const maxFetch = totalAvail !== null ? Math.max(0, totalAvail - offset) : 1000;

  React.useEffect(() => {
    if (open) {
      setCount(String(Math.min(100, maxFetch) || ""));
      setError("");
    }
  }, [open, maxFetch]);

  const handleStart = async () => {
    const n = parseInt(count, 10);
    if (!n || n < 1) { setError("Enter a number between 1 and " + maxFetch); return; }
    if (n > maxFetch) { setError(`Maximum is ${maxFetch.toLocaleString()} for this run`); return; }
    setError("");

    setLoading(true);
    try {
      const res = await fetch("/api/scrape/run", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ campaignId: campaign.id, yelpFetchCount: n }),
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
      toast.show({ type: "success", title: "Yelp fetch started", message: `Fetching up to ${n.toLocaleString()} businesses…` });
      onStarted(data.runId);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} width={500} labelledBy="yelp-run-modal-title">
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center rounded-full bg-[#FF1A1A]/10 text-[#FF1A1A] text-[10.5px] font-bold px-2 py-0.5 tracking-wide">
              YELP
            </span>
          </div>
          <h2 id="yelp-run-modal-title" className="text-[20px] font-semibold text-ink dark:text-d-ink leading-snug">
            {campaign.name}
          </h2>
        </div>

        {/* Keyword + location preview */}
        <div className="rounded-[14px] bg-canvas-soft dark:bg-d-canvas-soft px-4 py-3 space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-mute font-semibold">Search</div>
          <div className="text-[15px] font-medium text-ink dark:text-d-ink">"{campaign.keyword}"</div>
          <div className="text-[12.5px] text-mute">
            {campaign.city ? `${campaign.city}, ${campaign.state}` : campaign.state}
          </div>
        </div>

        {/* Cursor progress — shown after first run */}
        {!isFirstRun && totalAvail !== null && (
          <div className="rounded-[14px] bg-canvas-soft dark:bg-d-canvas-soft px-4 py-3">
            <div className="flex items-center justify-between text-[12.5px] mb-2">
              <span className="text-mute">Fetched so far</span>
              <span className="font-semibold text-ink dark:text-d-ink tabular-nums">
                {offset.toLocaleString()} / {totalAvail.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-line dark:bg-d-line overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.round((offset / totalAvail) * 100))}%` }}
              />
            </div>
          </div>
        )}

        {/* Fully fetched state */}
        {fullyFetched ? (
          <div className="flex items-start gap-2.5 rounded-[14px] bg-positive/10 border border-positive/30 px-3.5 py-3">
            <span className="text-positive text-[15px] font-bold shrink-0">✓</span>
            <div className="text-[13px] text-body dark:text-d-body leading-relaxed">
              <span className="font-semibold text-ink dark:text-d-ink">All {totalAvail?.toLocaleString()} businesses fetched.</span>{" "}
              This search has no more results. Create a new campaign to search a different keyword.
            </div>
          </div>
        ) : (
          <>
            {/* Fetch count input */}
            <Field
              label={isFirstRun
                ? "How many businesses to fetch from Yelp?"
                : `How many more to fetch? (${maxFetch.toLocaleString()} remaining)`}
              hint={isFirstRun
                ? "Yelp returns up to 1,000 businesses per search"
                : undefined}
              error={error}
            >
              <Input
                type="number"
                min={1}
                max={maxFetch}
                value={count}
                onChange={(e) => { setCount(e.target.value); setError(""); }}
                placeholder={`1 – ${maxFetch.toLocaleString()}`}
              />
            </Field>

            <p className="text-[12px] text-mute -mt-2">
              Yelp may have fewer unique leads than businesses fetched — duplicates are automatically filtered.
            </p>
          </>
        )}

        {/* No API key warning (rendered when key is absent but run is somehow attempted) */}
        {!fullyFetched && (
          <div className="hidden" id="yelp-no-key-warning">
            <div className="flex items-start gap-2.5 rounded-[14px] bg-warning/10 border border-warning/30 px-3.5 py-3">
              <AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-body dark:text-d-body">
                <span className="font-semibold text-ink dark:text-d-ink">No Yelp API key configured.</span>{" "}
                Add <code className="font-mono text-[11px] bg-canvas-soft dark:bg-d-canvas-soft px-1 rounded">YELP_API_KEY</code> to your .env file.
              </p>
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
            variant="primary"
            size="md"
            className="flex-1"
            leftIcon={<Play size={14} />}
            onClick={handleStart}
            disabled={loading || fullyFetched}
          >
            {loading ? "Starting…" : "Start Fetch"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
