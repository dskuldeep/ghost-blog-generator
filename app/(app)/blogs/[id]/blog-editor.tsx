"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { CodeEditor } from "@/components/code-editor";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

interface EvalData {
  scores?: Record<string, number>;
  overall?: number;
  feedback?: string;
  gaps?: string[];
}

interface BlogData {
  id: string;
  title: string;
  markdown: string;
  excerpt: string | null;
  tags: string[];
  status: string;
  evalScore: number | null;
  evalData: unknown;
  hasHero: boolean;
  ghostUrl: string | null;
}

export function BlogEditor({
  initial,
  ghostConfigured,
}: {
  initial: BlogData;
  ghostConfigured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState(initial.title);
  const [markdown, setMarkdown] = useState(initial.markdown);
  const [excerpt, setExcerpt] = useState(initial.excerpt ?? "");
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [tab, setTab] = useState<"edit" | "preview">("preview");
  const [dirty, setDirty] = useState(false);

  const previewHtml = useMemo(
    () => marked.parse(markdown, { async: false }) as string,
    [markdown],
  );

  const [hasHero, setHasHero] = useState(initial.hasHero);
  const [heroV, setHeroV] = useState(0);
  const [genningHero, setGenningHero] = useState(false);
  const [genningBody, setGenningBody] = useState(false);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<"draft" | "published">(
    "published",
  );
  const [ghostUrl, setGhostUrl] = useState(initial.ghostUrl);
  const [status, setStatus] = useState(initial.status);

  const evalData = (initial.evalData ?? {}) as EvalData;

  function mark<T>(setter: (v: T) => void) {
    return (v: T) => {
      setDirty(true);
      setter(v);
    };
  }

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/api/blogs/${initial.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          markdown,
          excerpt,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      setDirty(false);
      toast("Saved.", "success");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function generateHero() {
    setGenningHero(true);
    try {
      await apiFetch(`/api/blogs/${initial.id}/hero`, { method: "POST" });
      setHasHero(true);
      setHeroV((v) => v + 1);
      toast("Hero image generated.", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setGenningHero(false);
    }
  }

  async function generateBodyImages() {
    setGenningBody(true);
    try {
      // Regeneration works off the saved markdown, so flush edits first.
      if (dirty) await save();
      const res = await apiFetch<{ count: number; markdown: string }>(
        `/api/blogs/${initial.id}/images`,
        { method: "POST" },
      );
      setMarkdown(res.markdown);
      setDirty(false);
      toast(
        res.count > 0
          ? `Generated ${res.count} body image${res.count === 1 ? "" : "s"}.`
          : "No body images were added.",
        res.count > 0 ? "success" : "error",
      );
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setGenningBody(false);
    }
  }

  async function publish() {
    if (!ghostConfigured) {
      toast("Configure Ghost in Settings first.", "error");
      return;
    }
    setPublishing(true);
    try {
      if (dirty) await save();
      const res = await apiFetch<{ ghostUrl: string; status: string }>(
        `/api/blogs/${initial.id}/publish`,
        { method: "POST", body: JSON.stringify({ status: publishStatus }) },
      );
      setGhostUrl(res.ghostUrl);
      setStatus(res.status);
      setHasHero(true);
      setHeroV((v) => v + 1);
      toast(
        publishStatus === "published"
          ? "Published to Ghost."
          : "Pushed as draft to Ghost.",
        "success",
      );
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/blogs"
            className="text-sm text-[var(--color-muted)] hover:text-zinc-900"
          >
            ← Blogs
          </Link>
          <StatusBadge status={status} />
          {dirty && <Badge tone="warning">unsaved</Badge>}
          {ghostUrl && (
            <a
              href={ghostUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              View on Ghost ↗
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={save} loading={saving}>
            Save
          </Button>
          <Select
            className="h-8 w-32"
            value={publishStatus}
            onChange={(e) =>
              setPublishStatus(e.target.value as "draft" | "published")
            }
          >
            <option value="published">Publish live</option>
            <option value="draft">As draft</option>
          </Select>
          <Button
            size="sm"
            onClick={publish}
            loading={publishing}
            disabled={!ghostConfigured}
          >
            Push to Ghost
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-8 lg:grid-cols-[1fr_320px]">
        {/* Editor / preview */}
        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => mark(setTitle)(e.target.value)}
              className="text-base font-medium"
            />
          </div>

          <div className="flex gap-1 border-b">
            {(["preview", "edit"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm font-medium ${
                  tab === t
                    ? "border-b-2 border-[var(--color-accent)] text-zinc-900"
                    : "text-[var(--color-muted)]"
                }`}
              >
                {t === "preview" ? "Preview" : "Markdown"}
              </button>
            ))}
          </div>

          {tab === "preview" ? (
            <div
              className="prose-blog rounded-lg border border-[var(--color-border)] bg-white p-6"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <div className="h-[560px] overflow-hidden rounded-lg border border-[var(--color-border)]">
              <CodeEditor
                path="content.md"
                value={markdown}
                onChange={mark(setMarkdown)}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Hero */}
          <div className="space-y-2">
            <Label>Hero image</Label>
            <div className="flex aspect-[1200/630] items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-zinc-100">
              {hasHero ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/blogs/${initial.id}/hero?v=${heroV}`}
                  alt="Hero preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs text-[var(--color-muted)]">
                  Not generated
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={generateHero}
              loading={genningHero}
            >
              {hasHero ? "Regenerate hero" : "Generate hero"}
            </Button>
            <p className="text-xs text-[var(--color-muted)]">
              Style is configured in Settings → Hero image style.
            </p>
          </div>

          {/* Body images */}
          <div className="space-y-2">
            <Label>Body images</Label>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={generateBodyImages}
              loading={genningBody}
            >
              Regenerate body images
            </Button>
            <p className="text-xs text-[var(--color-muted)]">
              Plans on-topic line-art and injects it under the post&apos;s
              sections. Configured in Settings → Body images.
            </p>
          </div>

          {/* Metadata */}
          <div className="space-y-1.5">
            <Label htmlFor="excerpt">Excerpt (meta description)</Label>
            <Input
              id="excerpt"
              value={excerpt}
              onChange={(e) => mark(setExcerpt)(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => mark(setTags)(e.target.value)}
            />
          </div>

          {/* Eval */}
          {typeof initial.evalScore === "number" && (
            <div className="rounded-lg border border-[var(--color-border)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Quality score</span>
                <Badge tone="accent">
                  {(initial.evalScore * 100).toFixed(0)}/100
                </Badge>
              </div>
              {evalData.scores && (
                <div className="space-y-1">
                  {Object.entries(evalData.scores).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 text-xs">
                      <span className="w-28 capitalize text-[var(--color-muted)]">
                        {k}
                      </span>
                      <div className="h-1.5 flex-1 rounded-full bg-zinc-100">
                        <div
                          className="h-1.5 rounded-full bg-[var(--color-accent)]"
                          style={{ width: `${Math.round(v * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {evalData.feedback && (
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  {evalData.feedback}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
