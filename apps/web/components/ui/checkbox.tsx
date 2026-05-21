"use client";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import * as React from "react";

interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  indeterminate?: boolean;
  label?: string;
  className?: string;
}

export function Checkbox({ checked, onChange, indeterminate, label, className }: CheckboxProps) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  return (
    <label className={cn("inline-flex items-center gap-2 cursor-pointer select-none", className)}>
      <span className="relative inline-flex">
        <input
          ref={ref}
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer sr-only"
        />
        <span className={cn(
          "w-4 h-4 rounded-[5px] border transition-colors",
          "border-line dark:border-d-line bg-canvas dark:bg-d-canvas-soft",
          "peer-checked:bg-primary peer-checked:border-primary",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-1",
        )} />
        {checked && (
          <Check size={12} strokeWidth={3} className="absolute inset-0 m-auto text-ink pointer-events-none" />
        )}
        {indeterminate && !checked && (
          <span className="absolute inset-0 m-auto w-2 h-0.5 bg-ink rounded pointer-events-none" />
        )}
      </span>
      {label && <span className="text-sm text-ink dark:text-d-ink">{label}</span>}
    </label>
  );
}
