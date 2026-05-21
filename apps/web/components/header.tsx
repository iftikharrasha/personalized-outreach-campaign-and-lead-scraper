"use client";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Menu, Moon, Sun } from "lucide-react";

interface HeaderProps {
  breadcrumb: string[];
  onMenuClick?: () => void;
}

export function Header({ breadcrumb, onMenuClick }: HeaderProps) {
  const { dark, setDark } = useTheme();
  return (
    <header className="sticky top-0 z-20 h-16 bg-canvas/90 dark:bg-d-canvas/90 backdrop-blur border-b border-line dark:border-d-line">
      <div className="h-full flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-[10px] hover:bg-canvas-soft dark:hover:bg-d-canvas-soft text-ink dark:text-d-ink"
            aria-label="Toggle menu"
          >
            <Menu size={18} />
          </button>
          <div className="text-[13px] text-mute flex items-center gap-1.5">
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-line dark:text-d-line">/</span>}
                <span className={cn(i === breadcrumb.length - 1 ? "text-ink dark:text-d-ink font-medium" : "")}>
                  {b}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDark(!dark)}
            className="p-2.5 rounded-full hover:bg-canvas-soft dark:hover:bg-d-canvas-soft text-ink dark:text-d-ink"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
