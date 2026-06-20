"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { RunLog, type RunEventLike } from "@/components/run-log";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

const TERMINAL = ["succeeded", "failed", "cancelled"];

export function RunDetail({
  runId,
  initialStatus,
  topicTitle,
  model,
  initialBlogId,
  initialError,
  initialEvents,
}: {
  runId: string;
  initialStatus: string;
  topicTitle: string;
  model: string | null;
  initialBlogId: string | null;
  initialError: string | null;
  initialEvents: RunEventLike[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState(initialStatus);
  const [blogId, setBlogId] = useState(initialBlogId);
  const [error, setError] = useState(initialError);
  const [events, setEvents] = useState<RunEventLike[]>(initialEvents);
  const seenSeq = useRef(new Set(initialEvents.map((e) => e.seq)));

  useEffect(() => {
    if (TERMINAL.includes(initialStatus)) return;
    const es = new EventSource(`/api/runs/${runId}/stream`);
    es.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.kind === "event") {
        const ev = data.event as RunEventLike;
        if (ev.seq !== undefined && seenSeq.current.has(ev.seq)) return;
        if (ev.seq !== undefined) seenSeq.current.add(ev.seq);
        setEvents((prev) => [...prev, ev]);
      } else if (data.kind === "status") {
        setStatus(data.status);
        setBlogId(data.blogId ?? null);
        setError(data.error ?? null);
        es.close();
        router.refresh();
      } else if (data.kind === "error") {
        es.close();
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [runId, initialStatus, router]);

  async function cancel() {
    try {
      await apiFetch(`/api/runs/${runId}/cancel`, { method: "POST" });
      setStatus("cancelled");
      toast("Run cancelled.", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function retry() {
    try {
      const res = await apiFetch<{ runId: string }>(
        `/api/runs/${runId}/retry`,
        { method: "POST" },
      );
      router.push(`/runs/${res.runId}`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const active = !TERMINAL.includes(status);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/runs"
              className="text-sm text-[var(--color-muted)] hover:text-zinc-900"
            >
              ← Runs
            </Link>
            <StatusBadge status={status} />
          </div>
          <h1 className="mt-1 text-xl font-semibold">{topicTitle}</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {model ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {active && (
            <Button variant="outline" size="sm" onClick={cancel}>
              Cancel
            </Button>
          )}
          {status === "failed" && (
            <Button variant="outline" size="sm" onClick={retry}>
              Retry
            </Button>
          )}
          {blogId && (
            <Link href={`/blogs/${blogId}`}>
              <Button size="sm">Open blog →</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-8">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <RunLog events={events} className="h-[calc(100vh-260px)]" />
      </div>
    </div>
  );
}
