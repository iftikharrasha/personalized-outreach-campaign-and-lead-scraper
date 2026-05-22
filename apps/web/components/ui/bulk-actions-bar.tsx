"use client";
import { cn } from "@/lib/utils";
import { ChevronDown, X } from "lucide-react";
import * as React from "react";
import { Menu } from "./menu";

interface BulkAction {
  type: "button" | "menu" | "divider";
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  items?: { label: string; onClick: () => void }[];
}

interface BulkActionsBarProps {
  count: number;
  onClear: () => void;
  actions?: BulkAction[];
}

export function BulkActionsBar({ count, onClear, actions = [] }: BulkActionsBarProps) {
  if (!count) return null;
  return (
    <div
      className="fixed bottom-6 z-30"
      style={{ left: "calc(50% + (var(--sidebar-w, 240px) / 2))", transform: "translateX(-50%)" }}
    >
      {/* Fully inverted surface: dark pill in light mode, light pill in dark mode.
          Light: bg-ink (near-black) + white text + white-alpha dividers.
          Dark:  bg-d-ink (near-white) + near-black text + black-alpha dividers. */}
      <div className="animate-fadein bg-ink dark:bg-d-ink text-canvas dark:text-d-canvas-soft rounded-full pl-5 pr-2 py-2 flex items-center gap-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.4)] border border-ink dark:border-d-ink">
        <span className="text-sm font-semibold tabular-nums">{count} selected</span>
        <span className="w-px h-5 bg-white/20 dark:bg-black/15" />
        {actions.map((a, i) => {
          if (a.type === "divider") return <span key={i} className="w-px h-5 bg-white/20 dark:bg-black/15" />;
          if (a.type === "menu") {
            return (
              <Menu
                key={i}
                align="left"
                position="up"
                trigger={
                  <button className="text-sm px-3 py-1.5 rounded-full hover:bg-white/15 dark:hover:bg-black/10 inline-flex items-center gap-1.5">
                    {a.icon}{a.label} <ChevronDown size={14} className="rotate-180" />
                  </button>
                }
                items={a.items ?? []}
              />
            );
          }
          return (
            <button
              key={i}
              onClick={a.onClick}
              className={cn(
                "text-sm px-3 py-1.5 rounded-full hover:bg-white/15 dark:hover:bg-black/10 inline-flex items-center gap-1.5",
                a.danger && "text-red-400 dark:text-negative",
              )}
            >
              {a.icon}{a.label}
            </button>
          );
        })}
        <button onClick={onClear} aria-label="Clear selection" className="ml-1 p-1.5 rounded-full hover:bg-white/15 dark:hover:bg-black/10">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
