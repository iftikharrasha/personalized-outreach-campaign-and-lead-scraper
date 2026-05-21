"use client";
import { cn } from "@/lib/utils";
import * as React from "react";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  width?: number;
  labelledBy?: string;
}

export function Modal({ open, onClose, children, width = 520, labelledBy }: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fadein"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          "relative bg-canvas dark:bg-d-canvas text-ink dark:text-d-ink",
          "rounded-card p-6 w-full animate-scalein",
          "shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)]",
        )}
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
