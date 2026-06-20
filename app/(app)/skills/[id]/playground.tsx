"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { CodeEditor } from "@/components/code-editor";
import { RunLog, type RunEventLike } from "@/components/run-log";
import { apiFetch } from "@/lib/client";
import { cn } from "@/lib/utils";

interface SkillMeta {
  id: string;
  name: string;
  description: string | null;
  activeVersionId: string | null;
}
interface VersionMeta {
  id: string;
  version: number;
  message: string | null;
  createdAt: string;
}
interface CurrentVersion {
  versionId: string;
  version: number;
  skillMd: string;
  files: { path: string; content: string }[];
}

const SKILL_MD = "SKILL.md";

export function Playground({
  skillId,
  initialSkill,
  initialVersions,
  initialCurrent,
}: {
  skillId: string;
  initialSkill: SkillMeta;
  initialVersions: VersionMeta[];
  initialCurrent: CurrentVersion | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [skill, setSkill] = useState(initialSkill);
  const [versions, setVersions] = useState(initialVersions);
  const [loadedVersion, setLoadedVersion] = useState<number>(
    initialCurrent?.version ?? 0,
  );
  const [loadedVersionId, setLoadedVersionId] = useState<string | null>(
    initialCurrent?.versionId ?? null,
  );

  const [skillMd, setSkillMd] = useState(initialCurrent?.skillMd ?? "");
  const [files, setFiles] = useState<{ path: string; content: string }[]>(
    initialCurrent?.files ?? [],
  );
  const [active, setActive] = useState<string>(SKILL_MD);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Test run state
  const [topic, setTopic] = useState("");
  const [testing, setTesting] = useState(false);
  const [events, setEvents] = useState<RunEventLike[]>([]);
  const [testResult, setTestResult] = useState<{
    title?: string;
    html?: string;
    evalScore?: number;
  } | null>(null);

  function editorValue() {
    if (active === SKILL_MD) return skillMd;
    return files.find((f) => f.path === active)?.content ?? "";
  }
  function onEditorChange(value: string) {
    setDirty(true);
    if (active === SKILL_MD) {
      setSkillMd(value);
    } else {
      setFiles((fs) =>
        fs.map((f) => (f.path === active ? { ...f, content: value } : f)),
      );
    }
  }

  function addFile() {
    const path = window.prompt(
      "New reference file path",
      "references/new.md",
    );
    if (!path) return;
    if (path === SKILL_MD || files.some((f) => f.path === path)) {
      toast("A file with that path already exists.", "error");
      return;
    }
    setFiles((fs) => [...fs, { path, content: "" }]);
    setActive(path);
    setDirty(true);
  }

  function deleteFile(path: string) {
    if (!window.confirm(`Delete ${path}?`)) return;
    setFiles((fs) => fs.filter((f) => f.path !== path));
    if (active === path) setActive(SKILL_MD);
    setDirty(true);
  }

  async function loadVersion(versionId: string) {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    try {
      const v = await apiFetch<CurrentVersion>(
        `/api/skills/${skillId}/versions/${versionId}`,
      );
      setSkillMd(v.skillMd);
      setFiles(v.files);
      setLoadedVersion(v.version);
      setLoadedVersionId(v.versionId);
      setActive(SKILL_MD);
      setDirty(false);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function saveVersion() {
    const message = window.prompt(
      "Describe this version (optional)",
      `Edited from v${loadedVersion}`,
    );
    if (message === null) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ versionId: string; version: number }>(
        `/api/skills/${skillId}/versions`,
        {
          method: "POST",
          body: JSON.stringify({ skillMd, files, message, setActive: true }),
        },
      );
      toast(`Saved version ${res.version}.`, "success");
      setVersions((vs) => [
        {
          id: res.versionId,
          version: res.version,
          message,
          createdAt: new Date().toISOString(),
        },
        ...vs,
      ]);
      setLoadedVersion(res.version);
      setLoadedVersionId(res.versionId);
      setSkill((s) => ({ ...s, activeVersionId: res.versionId }));
      setDirty(false);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function setActiveVersion() {
    if (!loadedVersionId) return;
    try {
      await apiFetch(`/api/skills/${skillId}/active`, {
        method: "POST",
        body: JSON.stringify({ versionId: loadedVersionId }),
      });
      setSkill((s) => ({ ...s, activeVersionId: loadedVersionId }));
      toast("Marked as active version.", "success");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  function downloadCurrent() {
    if (!loadedVersionId) return;
    window.open(
      `/api/skills/${skillId}/versions/${loadedVersionId}/download`,
      "_blank",
    );
  }

  async function runTest() {
    if (!topic.trim()) {
      toast("Enter a sample topic to test.", "error");
      return;
    }
    setTesting(true);
    setEvents([]);
    setTestResult(null);
    try {
      const res = await fetch(`/api/skills/${skillId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, skillMd, files }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Test failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.kind === "event") {
            setEvents((prev) => [...prev, msg.event]);
          } else if (msg.kind === "result") {
            setTestResult(msg.result);
          } else if (msg.kind === "error") {
            toast(msg.message, "error");
          }
        }
      }
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setTesting(false);
    }
  }

  const treeFiles = [{ path: SKILL_MD }, ...files];

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/skills")}
            className="text-sm text-[var(--color-muted)] hover:text-zinc-900"
          >
            ← Skills
          </button>
          <h2 className="text-lg font-semibold">{skill.name}</h2>
          <Badge tone="neutral">editing v{loadedVersion}</Badge>
          {dirty && <Badge tone="warning">unsaved</Badge>}
          {skill.activeVersionId === loadedVersionId && (
            <Badge tone="success">active</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
            value={loadedVersionId ?? ""}
            onChange={(e) => loadVersion(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version}
                {v.message ? ` — ${v.message}` : ""}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={downloadCurrent}>
            Download
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={setActiveVersion}
            disabled={skill.activeVersionId === loadedVersionId}
          >
            Set active
          </Button>
          <Button size="sm" onClick={saveVersion} loading={saving}>
            Save version
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[180px_1fr_360px]">
        {/* File tree */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              FILES
            </span>
            <button
              onClick={addFile}
              className="text-sm text-[var(--color-accent)] hover:opacity-80"
              title="Add reference file"
            >
              +
            </button>
          </div>
          <div className="space-y-0.5">
            {treeFiles.map((f) => (
              <div
                key={f.path}
                className={cn(
                  "group flex items-center justify-between rounded px-2 py-1 text-sm",
                  active === f.path
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-zinc-700 hover:bg-zinc-100",
                )}
              >
                <button
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => setActive(f.path)}
                  title={f.path}
                >
                  {f.path}
                </button>
                {f.path !== SKILL_MD && (
                  <button
                    onClick={() => deleteFile(f.path)}
                    className="ml-1 hidden text-zinc-400 hover:text-[var(--color-danger)] group-hover:block"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="h-[560px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="border-b px-3 py-2 text-xs font-medium text-[var(--color-muted)]">
            {active}
          </div>
          <div className="h-[calc(560px-37px)]">
            <CodeEditor
              path={active}
              value={editorValue()}
              onChange={onEditorChange}
            />
          </div>
        </div>

        {/* Test panel */}
        <div className="flex h-[560px] flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="text-sm font-semibold">Test run</div>
          <p className="text-xs text-[var(--color-muted)]">
            Runs the agent with the <em>current (unsaved)</em> skill on a sample
            topic. Nothing is published.
          </p>
          <Textarea
            rows={2}
            placeholder="e.g. How rolling business budgets beat annual ones"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <Button size="sm" onClick={runTest} loading={testing}>
            {testing ? "Running…" : "Run test"}
          </Button>
          <div className="min-h-0 flex-1">
            <RunLog events={events} className="h-full" />
          </div>
          {testResult && (
            <div className="rounded-lg border border-[var(--color-border)] p-2">
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium">
                  {testResult.title}
                </span>
                {typeof testResult.evalScore === "number" && (
                  <Badge tone="accent">
                    score {(testResult.evalScore * 100).toFixed(0)}
                  </Badge>
                )}
              </div>
              {testResult.html && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-[var(--color-accent)]">
                    Preview HTML
                  </summary>
                  <div
                    className="prose-blog mt-2 max-h-48 overflow-y-auto text-sm"
                    dangerouslySetInnerHTML={{ __html: testResult.html }}
                  />
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
