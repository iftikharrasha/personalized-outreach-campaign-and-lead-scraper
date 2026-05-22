"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { STATUS_OPTIONS } from "@/lib/constants";
import type { Lead } from "@prisma/client";
import { Check, Globe, Mail, MapPin, Phone, User, X } from "lucide-react";
import * as React from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EditFields {
  businessName: string;
  phone:        string;
  email:        string;
  websiteUrl:   string;
  address:      string;
  notes:        string;
  status:       string;
}

interface Props {
  open:    boolean;
  lead:    Lead | null;
  onClose: () => void;
  onSave:  (fields: Partial<EditFields>) => void | Promise<void>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider font-semibold text-mute mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export function LeadEditModal({ open, lead, onClose, onSave }: Props) {
  const [fields, setFields] = React.useState<EditFields>({
    businessName: "",
    phone:        "",
    email:        "",
    websiteUrl:   "",
    address:      "",
    notes:        "",
    status:       "NEW",
  });
  const [emailError, setEmailError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open && lead) {
      setFields({
        businessName: lead.businessName ?? "",
        phone:        lead.phone        ?? "",
        email:        lead.email        ?? "",
        websiteUrl:   lead.websiteUrl   ?? "",
        address:      lead.address      ?? "",
        notes:        lead.notes        ?? "",
        status:       lead.status       ?? "NEW",
      });
      setEmailError("");
      setSaving(false);
    }
  }, [open, lead]);

  if (!lead) return null;

  const set = (key: keyof EditFields) => (e: { target: { value: string } }) => {
    setFields((f) => ({ ...f, [key]: e.target.value }));
    if (key === "email") setEmailError("");
  };

  const handleSave = async () => {
    const email = fields.email.trim();
    if (email && !EMAIL_RE.test(email)) {
      setEmailError("That doesn't look like a valid email");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        businessName: fields.businessName.trim() || undefined,
        phone:        fields.phone.trim()        || undefined,
        email:        email                      || undefined,
        websiteUrl:   fields.websiteUrl.trim()   || undefined,
        address:      fields.address.trim()      || undefined,
        notes:        fields.notes.trim()        || undefined,
        status:       fields.status              || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} width={560} labelledBy="lead-edit-modal-title">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 id="lead-edit-modal-title" className="text-[18px] font-semibold text-ink dark:text-d-ink">
            Edit lead
          </h2>
          <p className="text-[12px] text-mute mt-0.5">{lead.businessName}</p>
        </div>
        <button onClick={onClose} className="text-mute hover:text-ink dark:hover:text-d-ink p-1">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4">
        <Field label="Business name">
          <Input
            autoFocus
            value={fields.businessName}
            onChange={set("businessName")}
            placeholder="Business name"
            leftIcon={<User size={15} />}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input
              value={fields.phone}
              onChange={set("phone")}
              placeholder="+1 (555) 000-0000"
              leftIcon={<Phone size={15} />}
            />
          </Field>
          <Field label="Status">
            <Select value={fields.status} onChange={set("status")} className="w-full">
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Email">
          <Input
            type="email"
            value={fields.email}
            onChange={set("email")}
            placeholder="contact@example.com"
            leftIcon={<Mail size={15} />}
          />
          {emailError && <p className="text-[12px] text-negative mt-1.5">{emailError}</p>}
        </Field>

        <Field label="Website">
          <Input
            value={fields.websiteUrl}
            onChange={set("websiteUrl")}
            placeholder="https://example.com"
            leftIcon={<Globe size={15} />}
          />
        </Field>

        <Field label="Address">
          <Input
            value={fields.address}
            onChange={set("address")}
            placeholder="123 Main St, City, State"
            leftIcon={<MapPin size={15} />}
          />
        </Field>

        <Field label="Notes">
          <textarea
            value={fields.notes}
            onChange={set("notes")}
            placeholder="What's worth remembering about this lead?"
            rows={3}
            className="w-full bg-canvas dark:bg-d-canvas text-ink dark:text-d-ink border border-line dark:border-d-line rounded-[14px] px-4 py-3 text-[14px] placeholder:text-mute focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </Field>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={saving}
          leftIcon={<Check size={14} />}
        >
          Save changes
        </Button>
      </div>
    </Modal>
  );
}
