import * as React from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 border-zinc-200",
  accent: "bg-indigo-50 text-indigo-700 border-indigo-200",
  success: "bg-green-50 text-green-700 border-green-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

const statusTone: Record<string, Tone> = {
  pending: "neutral",
  queued: "info",
  running: "info",
  drafting: "info",
  drafted: "accent",
  publishing: "warning",
  published: "success",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone[status] ?? "neutral";
  const animated = ["running", "queued", "drafting", "publishing"].includes(
    status,
  );
  return (
    <Badge tone={tone}>
      {animated && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {status}
    </Badge>
  );
}
