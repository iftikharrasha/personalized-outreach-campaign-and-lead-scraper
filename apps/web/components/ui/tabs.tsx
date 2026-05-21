"use client";
import { cn } from "@/lib/utils";

interface TabItem {
  value: string;
  label: string;
  count?: number;
}

interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  items: TabItem[];
}

export function Tabs({ value, onChange, items }: TabsProps) {
  return (
    <div role="tablist" className="inline-flex items-center gap-1 p-1 rounded-full bg-canvas-soft dark:bg-d-canvas-soft">
      {items.map((it) => {
        const active = value === it.value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-full transition-colors",
              active
                ? "bg-canvas text-ink dark:bg-d-canvas dark:text-d-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                : "text-body hover:text-ink dark:text-d-body dark:hover:text-d-ink",
            )}
          >
            {it.label}
            {it.count !== undefined && <span className="ml-1.5 text-mute text-xs">{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
