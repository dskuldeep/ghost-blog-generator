"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ToastTone = "default" | "success" | "error";
type Toast = { id: number; message: string; tone: ToastTone };

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback(
    (message: string, tone: ToastTone = "default") => {
      const id = ++counter;
      setToasts((t) => [...t, { id, message, tone }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 4000);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto min-w-[240px] max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg",
              t.tone === "success" &&
                "border-green-200 bg-green-50 text-green-800",
              t.tone === "error" && "border-red-200 bg-red-50 text-red-800",
              t.tone === "default" &&
                "border-zinc-200 bg-white text-zinc-800",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}
