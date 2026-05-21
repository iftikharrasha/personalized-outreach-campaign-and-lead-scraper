import { cn } from "@/lib/utils";
import * as React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, rightSlot, ...rest }, ref) => (
    <div className={cn("relative", className)}>
      {leftIcon && (
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute dark:text-d-mute pointer-events-none">
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          "w-full bg-canvas dark:bg-d-canvas text-ink dark:text-d-ink",
          "border border-line dark:border-d-line rounded-[12px]",
          "px-4 py-2.5 text-[15px] placeholder:text-mute dark:placeholder:text-d-mute",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
          leftIcon && "pl-10",
          rightSlot && "pr-10",
        )}
        {...rest}
      />
      {rightSlot && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-mute">{rightSlot}</span>
      )}
    </div>
  )
);
Input.displayName = "Input";
