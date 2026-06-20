"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/page-header";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";

interface SkillRow {
  id: string;
  name: string;
  description: string | null;
  activeVersionId: string | null;
  updatedAt: string | Date;
  versionCount: number;
  latestVersion: number;
}

export function SkillsList({ initial }: { initial: SkillRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/skills/import", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      toast("Skill imported.", "success");
      router.push(`/skills/${data.skillId}`);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function createBlank() {
    setCreating(true);
    try {
      const data = await apiFetch<{ skillId: string }>("/api/skills", {
        method: "POST",
        body: JSON.stringify({}),
      });
      router.push(`/skills/${data.skillId}`);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept=".skill,.zip,application/zip"
          className="hidden"
          onChange={onImport}
        />
        <Button
          variant="primary"
          loading={importing}
          onClick={() => fileInput.current?.click()}
        >
          Upload .skill
        </Button>
        <Button variant="outline" loading={creating} onClick={createBlank}>
          New blank skill
        </Button>
      </div>

      {initial.length === 0 ? (
        <EmptyState
          icon="🧪"
          title="No skills yet"
          description="Upload a .skill package (SKILL.md + reference files) or create a blank one to start tuning your blog writer."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {initial.map((s) => (
            <Link key={s.id} href={`/skills/${s.id}`}>
              <Card className="h-full p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-zinc-900">{s.name}</h3>
                  <Badge tone="neutral">v{s.latestVersion}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">
                  {s.description || "No description"}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-muted)]">
                  <span>{s.versionCount} versions</span>
                  <span>·</span>
                  <span>Updated {formatDate(s.updatedAt)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
