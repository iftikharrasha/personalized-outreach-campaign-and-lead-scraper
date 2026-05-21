"use client";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

function useBreadcrumb(pathname: string): string[] {
  if (pathname === "/") return ["Outrich Manager"];
  if (pathname === "/googlemaps") return ["Google Maps Scraper", "Campaigns"];
  if (pathname.startsWith("/googlemaps/")) return ["Google Maps Scraper", "Campaigns", pathname.split("/")[2] ?? "Detail"];
  return [pathname];
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const pathname = usePathname();
  const breadcrumb = useBreadcrumb(pathname);

  React.useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", collapsed ? "64px" : "240px");
  }, [collapsed]);

  return (
    <div className="min-h-screen flex bg-canvas-soft dark:bg-d-canvas-soft text-ink dark:text-d-ink">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header breadcrumb={breadcrumb} onMenuClick={() => setCollapsed((c) => !c)} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
