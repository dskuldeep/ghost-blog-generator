"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

interface PublishResponse {
  total: number;
  synced: number;
  failed: number;
}

export function PublishAllButton({
  ghostConfigured,
  draftCount,
}: {
  ghostConfigured: boolean;
  draftCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [publishing, setPublishing] = useState(false);

  async function publish() {
    if (!ghostConfigured) {
      toast("Configure Ghost in Settings first.", "error");
      return;
    }
    setPublishing(true);
    try {
      const res = await apiFetch<PublishResponse>("/api/blogs/publish-all", {
        method: "POST",
      });
      toast(
        res.failed
          ? `Published ${res.synced}/${res.total} to Ghost — ${res.failed} failed.`
          : `Published all ${res.synced} draft(s) to Ghost.`,
        res.failed ? "error" : "success",
      );
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Button
      size="sm"
      onClick={publish}
      loading={publishing}
      disabled={!ghostConfigured}
      title={
        ghostConfigured
          ? "Publish all drafted blogs to Ghost"
          : "Configure Ghost in Settings"
      }
    >
      {publishing ? "Publishing…" : `Publish all drafts (${draftCount})`}
    </Button>
  );
}
