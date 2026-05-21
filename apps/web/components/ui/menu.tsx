"use client";
import { cn } from "@/lib/utils";
import * as React from "react";

interface MenuItem {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface MenuProps {
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: "right" | "left";
  position?: "down" | "up";
}

export function Menu({ trigger, items, align = "right", position = "down" }: MenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      {open && (
        <div className={cn(
          "absolute min-w-[180px] bg-canvas dark:bg-d-canvas border border-line dark:border-d-line rounded-[14px] p-1.5 z-30 animate-fadein",
          "shadow-[0_18px_40px_-16px_rgba(0,0,0,0.25)]",
          align === "right" ? "right-0" : "left-0",
          position === "up" ? "bottom-full mb-2" : "top-full mt-2",
        )}>
          {items.map((it, i) =>
            it.divider ? (
              <div key={i} className="my-1 h-px bg-line dark:bg-d-line" />
            ) : (
              <button
                key={i}
                onClick={() => { setOpen(false); it.onClick?.(); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-[10px] flex items-center gap-2 whitespace-nowrap",
                  it.danger
                    ? "text-negative hover:bg-red-50 dark:hover:bg-red-900/20"
                    : "text-ink dark:text-d-ink hover:bg-canvas-soft dark:hover:bg-d-canvas-soft",
                )}
              >
                {it.icon}
                {it.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
