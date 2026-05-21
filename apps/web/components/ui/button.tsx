"use client";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import * as React from "react";

type Variant = "primary" | "secondary" | "chip" | "ghost" | "destructive" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variants: Record<Variant, string> = {
  primary: "bg-primary text-ink hover:bg-primary-hover",
  secondary: "bg-canvas-soft text-ink hover:bg-line dark:bg-d-canvas dark:text-d-ink dark:hover:bg-d-line",
  chip: "bg-canvas text-ink hover:bg-canvas-soft border border-line dark:bg-d-canvas dark:text-d-ink dark:hover:bg-d-line dark:border-d-line",
  ghost: "bg-transparent text-ink hover:bg-canvas-soft dark:text-d-ink dark:hover:bg-d-canvas",
  destructive: "bg-negative text-white hover:bg-[#b62a30]",
  outline: "bg-transparent text-ink border border-line hover:bg-canvas-soft dark:text-d-ink dark:border-d-line dark:hover:bg-d-canvas",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5 rounded-[14px]",
  md: "text-[15px] px-5 py-2.5 rounded-[18px]",
  lg: "text-base px-6 py-3 rounded-[24px]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", loading, disabled, leftIcon, rightIcon, children, className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-colors select-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : leftIcon}
      <span>{children}</span>
      {rightIcon}
    </button>
  )
);
Button.displayName = "Button";
