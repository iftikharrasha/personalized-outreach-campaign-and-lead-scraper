"use client";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, X } from "lucide-react";
import * as React from "react";

type ToastType = "success" | "error" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  show: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

const shells: Record<ToastType, { wrap: string; body: string; close: string; icon: React.ReactNode }> = {
  success: {
    wrap:  "bg-ink text-canvas border border-positive/60 dark:bg-canvas dark:text-ink dark:border-primary-pale",
    body:  "text-canvas-soft/80 dark:text-body",
    close: "text-canvas-soft/60 hover:text-canvas dark:text-mute dark:hover:text-ink",
    icon:  <CheckCircle size={18} className="text-positive" />,
  },
  error: {
    wrap:  "bg-ink text-canvas border-l-4 border-negative dark:bg-canvas dark:text-ink shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)]",
    body:  "text-canvas-soft/80 dark:text-body",
    close: "text-canvas-soft/60 hover:text-canvas dark:text-mute dark:hover:text-ink",
    icon:  <AlertTriangle size={18} className="text-negative" />,
  },
  warning: {
    wrap:  "bg-[#ffd11a]/20 border border-[#ffd11a]/40 text-ink dark:text-d-ink",
    body:  "text-body dark:text-d-body",
    close: "text-mute hover:text-ink dark:hover:text-d-ink",
    icon:  <AlertTriangle size={18} className="text-[#7a4500]" />,
  },
};

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const s = shells[toast.type];
  return (
    <div className={cn("rounded-[16px] p-4 animate-fadein flex items-start gap-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)]", s.wrap)}>
      <div className="mt-0.5">{s.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{toast.title}</div>
        {toast.message && <div className={cn("text-[13px] mt-0.5", s.body)}>{toast.message}</div>}
        {toast.action && (
          <button onClick={toast.action.onClick} className="mt-2 text-sm font-semibold underline underline-offset-2">
            {toast.action.label}
          </button>
        )}
      </div>
      <button onClick={onClose} className={s.close}><X size={16} /></button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const show = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, type: t.type ?? "success", title: t.title, message: t.message, action: t.action };
    setToasts((arr) => [...arr, toast]);
    if (toast.type === "success") {
      setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), 3200);
    }
  }, []);

  const dismiss = React.useCallback((id: string) => setToasts((arr) => arr.filter((x) => x.id !== id)), []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="fixed z-[60] bottom-4 right-4 flex flex-col gap-2 w-[340px] max-w-[calc(100vw-32px)]">
        {toasts.map((t) => <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}
