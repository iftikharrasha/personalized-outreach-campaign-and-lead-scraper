import { cn } from "@/lib/utils";
import * as React from "react";

type BadgeTone = "neutral" | "positive" | "warning" | "negative" | "purple" | "mute" | "primary" | "info";
type BadgeSize = "sm" | "md";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: string;
}

const tones: Record<BadgeTone, string> = {
  neutral: "bg-canvas-soft text-ink dark:bg-d-canvas-soft dark:text-d-ink",
  positive: "bg-primary-pale text-[#054d28]",
  warning: "bg-[#ffd11a]/25 text-[#7a4500] dark:text-[#ffd11a]",
  negative: "bg-red-100 text-[#a7000d] dark:bg-red-900/30 dark:text-red-300",
  purple: "bg-[#f3e8ff] text-[#6b21a8] dark:bg-purple-900/30 dark:text-purple-300",
  mute: "bg-[#f5f5f4] text-mute dark:bg-d-canvas-soft dark:text-d-mute",
  primary: "bg-primary text-ink",
  info: "bg-[#dbeafe] text-[#1e3a8a] dark:bg-blue-900/30 dark:text-blue-300",
};

const sizes: Record<BadgeSize, string> = {
  sm: "text-[10px] px-2 py-[2px]",
  md: "text-xs px-3 py-1",
};

export function Badge({ tone = "neutral", size = "md", dot, className, children, onClick, ...rest }: BadgeProps) {
  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold rounded-full",
        sizes[size],
        tones[tone],
        onClick && "cursor-pointer hover:opacity-90",
        className,
      )}
      {...rest}
    >
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />}
      {children}
    </span>
  );
}
