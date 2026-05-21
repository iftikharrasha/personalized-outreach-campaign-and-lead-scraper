import * as React from "react";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-ink dark:text-d-ink mb-1.5">{label}</div>
      {children}
      {error ? (
        <div className="text-[12px] text-negative mt-1.5">{error}</div>
      ) : hint ? (
        <div className="text-[12px] text-mute mt-1.5">{hint}</div>
      ) : null}
    </div>
  );
}
