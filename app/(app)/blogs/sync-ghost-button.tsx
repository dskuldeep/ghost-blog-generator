"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

interface SyncResponse {
  total: number;
  synced: number;
  failed: number;
}

export function SyncGhostButton({ ghostConfigured }: { ghostConfigured: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    if (!ghostConfigured) {
      toast("Configure Ghost in Settings first.", "error");
      return;
    }
    setSyncing(true);
    try {
      const res = await apiFetch<SyncResponse>("/api/blogs/sync", {
        method: "POST",
      });
      toast(
        res.failed
          ? `Synced ${res.synced}/${res.total} to Ghost — ${res.failed} failed.`
          : `Synced all ${res.synced} blog(s) to Ghost.`,
        res.failed ? "error" : "success",
      );
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Button
      size="sm"
      onClick={sync}
      loading={syncing}
      disabled={!ghostConfigured}
      title={
        ghostConfigured ? "Push all blogs to Ghost" : "Configure Ghost in Settings"
      }
    >
      {syncing ? "Syncing…" : "Sync all to Ghost"}
    </Button>
  );
}
