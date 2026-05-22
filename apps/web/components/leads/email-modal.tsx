"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Lead } from "@prisma/client";
import { Check, Mail, X } from "lucide-react";
import * as React from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  lead: Lead | null;
  onClose: () => void;
  onSave: (email: string) => void | Promise<void>;
}

export function EmailModal({ open, lead, onClose, onSave }: Props) {
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) { setText(lead?.email ?? ""); setError(""); setSaving(false); }
  }, [open, lead]);

  if (!lead) return null;

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
    <Modal open={open} onClose={onClose} width={480} labelledBy="email-modal-title">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 id="email-modal-title" className="text-[18px] font-semibold text-ink dark:text-d-ink">
            Email for {lead.businessName}
          </h2>
          <p className="text-[12px] text-mute mt-0.5">Manually entered — emails aren&apos;t scraped from Google Maps.</p>
        </div>
        <button onClick={onClose} className="text-mute hover:text-ink dark:hover:text-d-ink p-1">
          <X size={18} />
        </button>
      </div>

      <Input
        autoFocus
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
        <Button variant="primary" onClick={handleSave} loading={saving} leftIcon={<Check size={14} />}>
          {text.trim() ? "Save email" : "Clear email"}
        </Button>
      </div>
    </Modal>
  );
}
