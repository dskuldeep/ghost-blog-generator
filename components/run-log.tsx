"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface RunEventLike {
  seq?: number;
  type: string;
  level: string;
  message: string;
  data?: unknown;
  ts?: string;
}

const levelColor: Record<string, string> = {
  info: "text-zinc-600",
  success: "text-[var(--color-success)]",
  warn: "text-[var(--color-warning)]",
  error: "text-[var(--color-danger)]",
};

const typeIcon: Record<string, string> = {
  stage: "▸",
  search: "🔍",
  fetch: "🌐",
  reference: "📄",
  draft: "✍️",
  evaluate: "⚖️",
  revise: "♻️",
  hero: "🎨",
  publish: "🚀",
  done: "✅",
  error: "⛔",
};

export function RunLog({
  events,
  className,
}: {
  events: RunEventLike[];
  className?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [events.length]);

  return (
    <div
      className={cn(
        "h-full overflow-y-auto rounded-lg border border-[var(--color-border)] bg-zinc-50 p-3 font-mono text-xs",
        className,
      )}
    >
      {events.length === 0 ? (
        <div className="text-[var(--color-muted)]">No activity yet.</div>
      ) : (
        <div className="space-y-1">
          {events.map((e, i) => (
            <div key={e.seq ?? i} className="flex gap-2">
              <span className="shrink-0 select-none text-zinc-400">
                {typeIcon[e.type] ?? "•"}
              </span>
              <span
                className={cn(
                  "whitespace-pre-wrap break-words",
                  e.type === "stage"
                    ? "font-semibold text-zinc-900"
                    : levelColor[e.level] ?? "text-zinc-600",
                )}
              >
                {e.message}
              </span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
