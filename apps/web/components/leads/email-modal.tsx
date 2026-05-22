"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Lead } from "@prisma/client";
import { Check, Mail, RotateCcw, Sparkles, X } from "lucide-react";
import * as React from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  lead: Lead | null;
  onClose: () => void;
  onSave: (email: string) => void | Promise<void>;
  // Called when the user clicks "Find email" / "Re-find" — queues enrichment
  // and closes the modal. Only rendered for Google Maps leads.
  onFindEmail?: () => void;
}

export function EmailModal({ open, lead, onClose, onSave, onFindEmail }: Props) {
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) { setText(lead?.email ?? ""); setError(""); setSaving(false); }
  }, [open, lead]);

  if (!lead) return null;

  const hasExisting  = !!lead.email;
  const canEnrich    = !!onFindEmail;
  const cleanDomain  = (lead.websiteUrl ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");

  const handleSave = async () => {
    const v = text.trim();
    if (v && !EMAIL_RE.test(v)) {
      setError("That doesn't look like a valid email");
      return;
    }
    setSaving(true);
    try {
      await onSave(v);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} width={520} labelledBy="email-modal-title">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 id="email-modal-title" className="text-[18px] font-semibold text-ink dark:text-d-ink">
            Email for {lead.businessName}
          </h2>
          <p className="text-[12px] text-mute mt-0.5">
            {canEnrich
              ? "Auto-find crawls the lead's website (homepage → contact pages) and stops at the first verified address. Or type one in manually."
              : "Manually entered — emails aren't scraped from Google Maps."}
          </p>
        </div>
        <button onClick={onClose} className="text-mute hover:text-ink dark:hover:text-d-ink p-1">
          <X size={18} />
        </button>
      </div>

      {/* Auto-find panel — shown for Google Maps leads that don't yet have an email */}
      {canEnrich && !hasExisting && (
        <div
          className="mb-5 border border-primary/40 bg-primary-pale/50 dark:bg-primary/10 p-4"
          style={{ borderRadius: "14px" }}
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary text-ink flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-ink dark:text-d-ink">Find it automatically</div>
              <div className="text-[12.5px] text-body dark:text-d-body mt-0.5">
                We&apos;ll crawl{" "}
                <span className="font-medium text-ink dark:text-d-ink">{cleanDomain || "the website"}</span>
                {" "}and pull a real contact email. Usually 1–2 seconds.
              </div>
            </div>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Mail size={14} />}
              onClick={onFindEmail}
            >
              Find email
            </Button>
          </div>
          <div className="mt-3 pl-12 text-[11.5px] text-mute leading-relaxed">
            Skips placeholder addresses and image filenames · prefers{" "}
            <span className="font-medium text-body dark:text-d-body">@{cleanDomain || "domain.com"}</span>
            {" "}over third-party addresses
          </div>
        </div>
      )}

      {/* Manual entry */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] uppercase tracking-wider font-semibold text-mute">
          {canEnrich && !hasExisting ? "Or enter manually" : "Email address"}
        </label>
        {/* Re-find link — shown when the lead already has an email and enrichment is available */}
        {hasExisting && canEnrich && (
          <button
            onClick={onFindEmail}
            className="text-[12px] text-mute hover:text-ink dark:hover:text-d-ink inline-flex items-center gap-1"
          >
            <RotateCcw size={11} /> Re-find
          </button>
        )}
      </div>

      <Input
        autoFocus={hasExisting}
        type="email"
        value={text}
        onChange={(e) => { setText(e.target.value); setError(""); }}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        placeholder="client@example.com"
        leftIcon={<Mail size={16} />}
      />
      {error && <div className="text-[12px] text-negative mt-2">{error}</div>}

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={saving}
          leftIcon={<Check size={14} />}
        >
          {text.trim() ? "Save email" : "Clear email"}
        </Button>
      </div>
    </Modal>
  );
}
