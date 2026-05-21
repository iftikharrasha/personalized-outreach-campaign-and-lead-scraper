"use client";
import { cn } from "@/lib/utils";
import { ChevronsLeft, Globe, LayoutDashboard, MapPin, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./logo";

const items = [
  { id: "home",  href: "/",           icon: <LayoutDashboard size={20} />, label: "Outrich Manager" },
  { id: "gmaps", href: "/googlemaps", icon: <MapPin size={20} />,          label: "Google Maps Scraper" },
];

const futureItems = [
  { id: "yelp",     icon: <Globe size={20} />, label: "Yelp" },
  { id: "linkedin", icon: <User size={20} />,  label: "LinkedIn" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const activeId = pathname === "/" ? "home" : pathname.startsWith("/googlemaps") ? "gmaps" : "";

  return (
    <aside
      className={cn(
        "relative shrink-0 sticky top-0 h-screen flex flex-col transition-all duration-200",
        "bg-ink text-canvas-soft dark:bg-canvas dark:text-ink",
        "border-r border-black/20 dark:border-line",
        collapsed ? "w-[64px]" : "w-[240px]",
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-2.5 h-16 px-4", collapsed && "justify-center px-0")}>
        <LogoMark size={28} />
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-canvas dark:text-ink">Outrich</div>
            <div className="text-[11px] text-canvas-soft/55 dark:text-mute -mt-0.5">Lead Scraper</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 pt-4">
        <div className={cn("px-3 mb-2 text-[11px] uppercase tracking-wider font-semibold", "text-canvas-soft/45 dark:text-mute", collapsed && "hidden")}>
          Workspace
        </div>
        <ul className="space-y-1">
          {items.map((it) => {
            const isActive = it.id === activeId;
            return (
              <li key={it.id}>
                <Link
                  href={it.href}
                  className={cn(
                    "relative flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[14px] font-medium transition-colors",
                    isActive
                      ? "bg-primary/20 text-canvas dark:bg-primary-pale dark:text-ink"
                      : "text-canvas-soft/75 hover:bg-white/[0.07] hover:text-canvas dark:text-body dark:hover:bg-canvas-soft dark:hover:text-ink",
                    collapsed && "justify-center px-0",
                  )}
                >
                  {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" />}
                  <span className={cn(isActive ? "text-canvas dark:text-ink" : "text-canvas-soft/55 dark:text-mute")}>
                    {it.icon}
                  </span>
                  {!collapsed && <span className="truncate">{it.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Coming soon */}
        <div className={cn("px-3 mt-6 mb-2 text-[11px] uppercase tracking-wider font-semibold", "text-canvas-soft/45 dark:text-mute", collapsed && "hidden")}>
          Coming soon
        </div>
        <ul className="space-y-1">
          {futureItems.map((it) => (
            <li key={it.id}>
              <span
                className={cn(
                  "relative flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[14px] font-medium cursor-not-allowed",
                  "text-canvas-soft/35 dark:text-mute",
                  collapsed && "justify-center px-0",
                )}
                title={`${it.label} — coming in v2`}
              >
                <span>{it.icon}</span>
                {!collapsed && (
                  <span className="flex items-center gap-2 truncate">
                    {it.label}
                    <span className="text-[10px] uppercase tracking-wide bg-white/10 dark:bg-canvas-soft text-canvas-soft/70 dark:text-mute px-1.5 py-0.5 rounded-full">
                      v2
                    </span>
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </nav>

      {/* Account row */}
      <div className="border-t border-white/10 dark:border-line p-2">
        <div className={cn("flex items-center gap-3 px-3 py-2", collapsed && "justify-center px-0")}>
          <div className="w-8 h-8 rounded-full bg-primary text-ink flex items-center justify-center text-xs font-semibold shrink-0">
            YA
          </div>
          {!collapsed && (
            <div className="leading-tight min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-canvas dark:text-ink truncate">You</div>
              <div className="text-[11px] text-canvas-soft/55 dark:text-mute truncate">localhost</div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-white/10 text-canvas hover:bg-white/20 dark:bg-canvas-soft dark:text-ink dark:hover:bg-line transition-colors"
            >
              <ChevronsLeft size={13} />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={onToggle}
            aria-label="Expand sidebar"
            className="mt-1 mx-auto flex w-7 h-7 rounded-full items-center justify-center bg-white/10 text-canvas hover:bg-white/20 dark:bg-canvas-soft dark:text-ink dark:hover:bg-line transition-colors"
          >
            <ChevronsLeft size={13} className="rotate-180" />
          </button>
        )}
      </div>
    </aside>
  );
}
