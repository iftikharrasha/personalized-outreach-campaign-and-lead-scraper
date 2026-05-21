import { cn } from "@/lib/utils";

type Status = "ACTIVE" | "PAUSED" | "ARCHIVED" | "SCRAPING";

const map: Record<Status, { color: string; ring: string; label: string }> = {
  ACTIVE:   { color: "bg-positive",  ring: "ring-positive/20", label: "Active" },
  PAUSED:   { color: "bg-warning",   ring: "ring-warning/20",  label: "Paused" },
  ARCHIVED: { color: "bg-mute",      ring: "ring-mute/20",     label: "Archived" },
  SCRAPING: { color: "bg-positive",  ring: "ring-positive/30", label: "Scraping" },
};

export function StatusDot({ status }: { status: string }) {
  const s = map[status as Status] ?? map.ACTIVE;
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-body dark:text-d-body">
      <span className={cn("relative w-2 h-2 rounded-full", s.color, status === "SCRAPING" && "animate-pulse")}>
        <span className={cn("absolute inset-0 rounded-full ring-2", s.ring)} />
      </span>
      {s.label}
    </span>
  );
}
