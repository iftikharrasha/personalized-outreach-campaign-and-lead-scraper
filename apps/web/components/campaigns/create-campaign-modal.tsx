"use client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { CATEGORIES, COUNTRIES, STATES_BY_COUNTRY } from "@/lib/constants";
import { ArrowRight, Search, X } from "lucide-react";
import * as React from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateCampaignModal({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("restaurants");
  const [customKeyword, setCustomKeyword] = React.useState("");
  const [country, setCountry] = React.useState("US");
  const [state, setState] = React.useState("California");
  const [city, setCity] = React.useState("");
  const [entireState, setEntireState] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(""); setCategory("restaurants"); setCustomKeyword("");
      setCountry("US"); setState("California"); setCity(""); setEntireState(false); setErrors({});
    }
  }, [open]);

  const derivedKeyword = () => {
    const base = category === "custom"
      ? customKeyword.trim()
      : CATEGORIES.find((c) => c.value === category)?.label.toLowerCase() ?? "";
    const loc = entireState ? state : city ? city : state;
    return base && loc ? `${base} in ${loc}` : base;
  };

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Campaign name is required";
    if (category === "custom" && !customKeyword.trim()) errs.keyword = "Enter a custom keyword";
    if (!entireState && !city.trim()) errs.city = "City is required (or pick Entire State)";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          keyword: derivedKeyword(),
          category,
          country, state,
          city: entireState ? "" : city.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.show({ type: "error", title: "Failed to create", message: data.error });
        return;
      }
      toast.show({ type: "success", title: "Campaign created", message: `"${name.trim()}" is ready. Hit Run to scrape leads.` });
      onCreated();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} width={560}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-[22px] font-semibold text-ink dark:text-d-ink">New Campaign</h2>
          <p className="text-[13px] text-mute mt-1">One campaign = one search keyword + one location.</p>
        </div>
        <button onClick={onClose} className="text-mute hover:text-ink dark:hover:text-d-ink p-1"><X size={18} /></button>
      </div>

      <div className="space-y-4">
        <Field label="Campaign name" hint='e.g. "San Diego Restaurants"' error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Give it a memorable name" />
        </Field>

        <Field label="What to scrape">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>

        {category === "custom" && (
          <Field label="Custom keyword" hint="The exact query that will be searched on Google Maps" error={errors.keyword}>
            <Input value={customKeyword} onChange={(e) => setCustomKeyword(e.target.value)} placeholder="vegan bakeries" />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Country">
            <Select value={country} onChange={(e) => { setCountry(e.target.value); setState(STATES_BY_COUNTRY[e.target.value]?.[0] ?? ""); }}>
              {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="State / Region">
            <Select value={state} onChange={(e) => setState(e.target.value)}>
              {(STATES_BY_COUNTRY[country] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>

        {!entireState && (
          <Field label="City" error={errors.city}>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Diego" />
          </Field>
        )}
        <Checkbox checked={entireState} onChange={setEntireState} label={`Scrape entire ${state}`} />

        <div className="rounded-[14px] bg-canvas-soft dark:bg-d-canvas-soft p-3 flex items-start gap-3 mt-2">
          <div className="mt-0.5 text-mute"><Search size={16} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-mute font-semibold">Google Maps query</div>
            <div className="text-[14px] font-medium text-ink dark:text-d-ink mt-0.5 truncate">
              {derivedKeyword() || <span className="text-mute italic">Fill in the fields above…</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 -mx-6 px-6 pt-5 border-t border-line dark:border-d-line flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} loading={loading} rightIcon={<ArrowRight size={14} />}>
          Create campaign
        </Button>
      </div>
    </Modal>
  );
}
