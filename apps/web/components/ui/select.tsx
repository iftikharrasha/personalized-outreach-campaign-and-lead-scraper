"use client";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string | number;
  onChange?: (e: { target: { value: string } }) => void;
  children?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function parseOptions(children: React.ReactNode): SelectOption[] {
  const opts: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || child.type !== "option") return;
    const props = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean };
    opts.push({
      value: String(props.value ?? ""),
      label: String(props.children ?? ""),
      disabled: !!props.disabled,
    });
  });
  return opts;
}

export function Select({ value, onChange, children, placeholder, disabled, className }: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(-1);
  const [coords, setCoords] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const options = React.useMemo(() => parseOptions(children), [children]);
  const selected = options.find((o) => String(o.value) === String(value));

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(options.length - 1, h + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)); }
      else if (e.key === "Enter") {
        const o = options[highlight];
        if (o && !o.disabled) commit(o.value);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open, highlight, options]);

  React.useEffect(() => {
    if (!open) { setCoords(null); return; }
    const measure = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    measure();
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", measure); };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => String(o.value) === String(value));
      setHighlight(idx >= 0 ? idx : 0);
    }
  }, [open, value, options]);

  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    if (!el) return;
    const list = listRef.current;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [highlight, open]);

  const commit = (v: string) => { setOpen(false); onChange?.({ target: { value: v } }); };
  const display = selected ? selected.label : (placeholder ?? <span className="text-mute">Select…</span>);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "w-full text-left flex items-center justify-between gap-2",
          "bg-canvas dark:bg-d-canvas text-ink dark:text-d-ink",
          "border border-line dark:border-d-line rounded-[12px]",
          "px-4 py-2.5 text-[15px]",
          "hover:border-mute dark:hover:border-d-mute transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
          disabled && "opacity-50 cursor-not-allowed",
          open && "ring-2 ring-primary border-transparent",
        )}
      >
        <span className="truncate">{display}</span>
        <ChevronDown size={16} className={cn("text-mute shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && coords && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          role="listbox"
          style={{ position: "fixed", top: coords.top, left: coords.left, minWidth: coords.width, zIndex: 100 }}
          className={cn(
            "animate-fadein bg-canvas dark:bg-d-canvas border border-line dark:border-d-line rounded-[14px] p-1",
            "shadow-[0_18px_40px_-16px_rgba(0,0,0,0.25)]",
          )}
        >
          <ul ref={listRef} className="max-h-[260px] overflow-auto py-0.5">
            {options.length === 0 && <li className="px-3 py-2 text-sm text-mute">No options</li>}
            {options.map((o, i) => {
              const isSel = String(o.value) === String(value);
              const isHi = i === highlight;
              return (
                <li
                  key={o.value + i}
                  data-idx={i}
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => !o.disabled && commit(o.value)}
                  className={cn(
                    "flex items-center justify-between gap-2 px-3 py-2 text-[14px] rounded-[10px] cursor-pointer",
                    o.disabled
                      ? "text-mute cursor-not-allowed"
                      : isHi
                        ? "bg-canvas-soft dark:bg-d-canvas-soft text-ink dark:text-d-ink"
                        : "text-ink dark:text-d-ink",
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <Check size={14} className="text-positive shrink-0" />}
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
