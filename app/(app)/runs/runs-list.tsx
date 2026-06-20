"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/page-header";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";

interface Run {
  id: string;
  status: string;
  kind: string;
  model: string | null;
  topicTitle: string;
  blogId: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

const ACTIVE = ["queued", "running"];

export function RunsList({ initial }: { initial: Run[] }) {
  const [runs, setRuns] = useState(initial);

  useEffect(() => {
    const anyActive = runs.some((r) => ACTIVE.includes(r.status));
    if (!anyActive) return;
    const t = setInterval(async () => {
      try {
        setRuns(await apiFetch<Run[]>("/api/runs"));
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [runs]);

  if (runs.length === 0) {
    return (
      <EmptyState
        icon="⚡"
        title="No runs yet"
        description="Generate a blog from the Topics page to see live agent runs here."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-[var(--color-muted)]">
          <tr>
            <th className="px-4 py-3 font-medium">Topic</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Model</th>
            <th className="px-4 py-3 font-medium">Started</th>
            <th className="px-4 py-3 text-right font-medium">View</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="px-4 py-3">
                <div className="font-medium text-zinc-900">{r.topicTitle}</div>
                {r.error && (
                  <div className="text-xs text-[var(--color-danger)]">
                    {r.error}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-4 py-3 text-[var(--color-muted)]">
                {r.model ?? "—"}
              </td>
              <td className="px-4 py-3 text-[var(--color-muted)]">
                {r.startedAt ? formatDate(r.startedAt) : formatDate(r.createdAt)}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/runs/${r.id}`}
                  className="text-[var(--color-accent)] hover:underline"
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
