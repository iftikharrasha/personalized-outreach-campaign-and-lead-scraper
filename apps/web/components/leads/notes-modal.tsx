"use client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { Lead } from "@prisma/client";
import { Check, X } from "lucide-react";
import * as React from "react";

interface Props {
  open: boolean;
  lead: Lead | null;
  onClose: () => void;
  onSave: (notes: string) => void | Promise<void>;
}

export function NotesModal({ open, lead, onClose, onSave }: Props) {
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) { setText(lead?.notes ?? ""); setSaving(false); }
  }, [open, lead]);

  if (!lead) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(text);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} width={520} labelledBy="notes-modal-title">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 id="notes-modal-title" className="text-[18px] font-semibold text-ink dark:text-d-ink">
            Note for {lead.businessName}
          </h2>
          <p className="text-[12px] text-mute mt-0.5">Saved changes are tracked in lead history.</p>
        </div>
        <button onClick={onClose} className="text-mute hover:text-ink dark:hover:text-d-ink p-1">
          <X size={18} />
        </button>
      </div>

      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's worth remembering about this lead?"
        rows={6}
        className="w-full bg-canvas dark:bg-d-canvas text-ink dark:text-d-ink border border-line dark:border-d-line rounded-[14px] px-4 py-3 text-[14px] placeholder:text-mute focus:outline-none focus:ring-2 focus:ring-primary"
      />

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} loading={saving} leftIcon={<Check size={14} />}>
          Save note
        </Button>
      </div>
    </Modal>
  );
}
