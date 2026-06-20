"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/page-header";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";

interface Topic {
  id: string;
  title: string;
  brief: string | null;
  status: string;
  createdAt: string;
  latestRunId: string | null;
  latestBlogId: string | null;
}
interface SkillOpt {
  id: string;
  name: string;
  activeVersionId: string | null;
}

export function TopicsClient({
  initialTopics,
  skills,
}: {
  initialTopics: Topic[];
  skills: SkillOpt[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [topics, setTopics] = useState(initialTopics);
  const [raw, setRaw] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [skillVersionId, setSkillVersionId] = useState<string>(
    skills[0]?.activeVersionId ?? "",
  );

  const hasSkill = skills.length > 0 && skillVersionId;

  async function refresh() {
    const t = await apiFetch<Topic[]>("/api/topics");
    setTopics(t);
    router.refresh();
  }

  function parseTopics(text: string) {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const sep = line.match(/\s\|\s|\t/);
        if (sep) {
          const idx = line.indexOf(sep[0]);
          return {
            title: line.slice(0, idx).trim(),
            brief: line.slice(idx + sep[0].length).trim(),
          };
        }
        return { title: line, brief: null };
      });
  }

  async function addTopics() {
    const items = parseTopics(raw);
    if (items.length === 0) {
      toast("Enter at least one topic.", "error");
      return;
    }
    setAdding(true);
    try {
      const res = await apiFetch<{ count: number }>("/api/topics", {
        method: "POST",
        body: JSON.stringify({ topics: items }),
      });
      toast(`Added ${res.count} topic(s).`, "success");
      setRaw("");
      await refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setAdding(false);
    }
  }

  async function generate(id: string) {
    if (!hasSkill) {
      toast("Create or import a skill first (Skill Playground).", "error");
      return;
    }
    setBusy(id);
    try {
      const res = await apiFetch<{ runId: string }>(
        `/api/topics/${id}/generate`,
        { method: "POST", body: JSON.stringify({ skillVersionId }) },
      );
      router.push(`/runs/${res.runId}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(null);
    }
  }

  async function generateAll() {
    if (!hasSkill) {
      toast("Create or import a skill first (Skill Playground).", "error");
      return;
    }
    setBusy("all");
    try {
      const res = await apiFetch<{ enqueued: number }>(
        "/api/topics/generate",
        { method: "POST", body: JSON.stringify({ skillVersionId }) },
      );
      toast(`Queued ${res.enqueued} generation(s).`, "success");
      await refresh();
      router.push("/runs");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this topic?")) return;
    try {
      await apiFetch(`/api/topics/${id}`, { method: "DELETE" });
      setTopics((ts) => ts.filter((t) => t.id !== id));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <label className="mb-2 block text-sm font-medium">
          Add topics{" "}
          <span className="font-normal text-[var(--color-muted)]">
            (one per line; optional brief after “ | ”)
          </span>
        </label>
        <Textarea
          rows={4}
          placeholder={"How rolling budgets beat annual ones | focus on SMBs\nThe hidden cost of late invoicing"}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-muted)]">Skill:</span>
            <Select
              className="h-8 w-56"
              value={skillVersionId}
              onChange={(e) => setSkillVersionId(e.target.value)}
            >
              {skills.length === 0 && <option value="">No skills</option>}
              {skills.map((s) => (
                <option key={s.id} value={s.activeVersionId ?? ""}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={generateAll}
              loading={busy === "all"}
              disabled={!hasSkill}
            >
              Generate all pending
            </Button>
            <Button onClick={addTopics} loading={adding}>
              Add topics
            </Button>
          </div>
        </div>
      </Card>

      {topics.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No topics yet"
          description="Paste a list of blog topics above to get started."
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Topic</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Added</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{t.title}</div>
                    {t.brief && (
                      <div className="text-xs text-[var(--color-muted)]">
                        {t.brief}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {formatDate(t.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {t.latestBlogId && (
                        <Link
                          href={`/blogs/${t.latestBlogId}`}
                          className="text-[var(--color-accent)] hover:underline"
                        >
                          Blog
                        </Link>
                      )}
                      {t.latestRunId && (
                        <Link
                          href={`/runs/${t.latestRunId}`}
                          className="text-[var(--color-accent)] hover:underline"
                        >
                          Run
                        </Link>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        loading={busy === t.id}
                        onClick={() => generate(t.id)}
                      >
                        Generate
                      </Button>
                      <button
                        onClick={() => remove(t.id)}
                        className="text-zinc-400 hover:text-[var(--color-danger)]"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
