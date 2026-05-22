"use client";
import { cn } from "@/lib/utils";
import { ChevronDown, X } from "lucide-react";
import * as React from "react";
import { Menu } from "./menu";

interface BulkAction {
  type:      "button" | "menu" | "divider";
  label?:    string;
  icon?:     React.ReactNode;
  onClick?:  () => void;
  danger?:   boolean;
  // Only show this action when exactly `showOnCount` leads are selected.
  // Undefined = always show.
  showOnCount?: number;
  items?:    { label: string; onClick: () => void }[];
}

interface BulkActionsBarProps {
  count:    number;
  onClear:  () => void;
  actions?: BulkAction[];
}

export function BulkActionsBar({ count, onClear, actions = [] }: BulkActionsBarProps) {
  if (!count) return null;

  const visible = actions.filter(
    (a) => a.showOnCount === undefined || a.showOnCount === count,
  );

  // Collapse consecutive dividers after filtering
  const collapsed: BulkAction[] = [];
  for (const a of visible) {
    if (a.type === "divider" && (collapsed.length === 0 || collapsed[collapsed.length - 1]?.type === "divider")) continue;
    collapsed.push(a);
  }
  // Strip trailing divider
  if (collapsed[collapsed.length - 1]?.type === "divider") collapsed.pop();

  return (
    <div
      className="fixed bottom-6 z-30 px-4"
      style={{ left: "calc(50% + (var(--sidebar-w, 240px) / 2))", transform: "translateX(-50%)", maxWidth: "calc(100vw - var(--sidebar-w, 240px) - 2rem)" }}
    >
      {/* Fully inverted surface: dark pill in light mode, light pill in dark mode. */}
      <div className="animate-fadein bg-ink dark:bg-d-ink text-canvas dark:text-d-canvas-soft rounded-full pl-4 sm:pl-5 pr-2 py-2 flex items-center gap-1.5 sm:gap-2 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.4)] border border-ink dark:border-d-ink overflow-hidden">
        <span className="text-sm font-semibold tabular-nums shrink-0 whitespace-nowrap">
          {count} <span className="hidden sm:inline">selected</span>
        </span>
        <span className="w-px h-5 bg-white/20 dark:bg-black/15 shrink-0" />
        {collapsed.map((a, i) => {
          if (a.type === "divider") return (
            <span key={i} className="w-px h-5 bg-white/20 dark:bg-black/15 shrink-0" />
          );
          if (a.type === "menu") {
            return (
              <Menu
                key={i}
                align="left"
                position="up"
                trigger={
                  <button className="text-sm px-2.5 sm:px-3 py-1.5 rounded-full hover:bg-white/15 dark:hover:bg-black/10 inline-flex items-center gap-1.5 whitespace-nowrap">
                    {a.icon}
                    <span className="hidden sm:inline">{a.label}</span>
                    <ChevronDown size={14} className="rotate-180" />
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
                "text-sm px-2.5 sm:px-3 py-1.5 rounded-full hover:bg-white/15 dark:hover:bg-black/10 inline-flex items-center gap-1.5 whitespace-nowrap",
                a.danger && "text-red-400 dark:text-negative",
              )}
            >
              {a.icon}
              <span className={a.icon ? "hidden sm:inline" : undefined}>{a.label}</span>
            </button>
          );
        })}
        <button onClick={onClear} aria-label="Clear selection" className="ml-1 p-1.5 rounded-full hover:bg-white/15 dark:hover:bg-black/10 shrink-0">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
