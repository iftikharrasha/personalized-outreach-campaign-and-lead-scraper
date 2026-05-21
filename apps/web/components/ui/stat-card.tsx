import { cn } from "@/lib/utils";
import { Card } from "./card";

type Tone = "canvas" | "primary" | "ink";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  valueClassName?: string;
  accent?: React.ReactNode;
}

const tones: Record<Tone, string> = {
  canvas:  "bg-canvas dark:bg-d-canvas",
  primary: "bg-primary-pale dark:bg-primary/15 text-ink dark:text-d-ink",
  ink:     "bg-ink text-canvas dark:bg-d-canvas dark:text-d-ink",
};

export function StatCard({ label, value, sub, icon, tone = "canvas", valueClassName = "", accent }: StatCardProps) {
  const isInk = tone === "ink";
  return (
    <Card className={cn("p-5 flex flex-col gap-3 min-h-[136px]", tones[tone])}>
      <div className="flex items-start justify-between gap-2">
        <div className={cn("text-[12px] uppercase tracking-wide font-semibold", isInk ? "text-canvas-soft/70" : "text-mute")}>
          {label}
        </div>
        {icon && <span className={cn("shrink-0", isInk ? "text-primary" : "text-mute")}>{icon}</span>}
      </div>
      <div className={cn(
        "text-[40px] font-black leading-none tabular-nums",
        isInk ? "text-canvas" : "text-ink dark:text-d-ink",
        valueClassName,
      )}>
        {value}
      </div>
      {sub && (
        <div className={cn("text-[12px] mt-auto", isInk ? "text-canvas-soft/70" : "text-mute")}>
          {sub}
        </div>
      )}
      {accent}
    </Card>
  );
}
