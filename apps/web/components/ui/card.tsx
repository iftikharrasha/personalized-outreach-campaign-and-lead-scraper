import { cn } from "@/lib/utils";
import * as React from "react";

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-canvas dark:bg-d-canvas rounded-card", className)} {...rest}>
      {children}
    </div>
  );
}
