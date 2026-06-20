import { notFound } from "next/navigation";
import { getRunWithEvents } from "@/lib/runs";
import { RunDetail } from "./run-detail";

export const dynamic = "force-dynamic";

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await getRunWithEvents(id);
  if (!run) notFound();

  return (
    <RunDetail
      runId={run.id}
      initialStatus={run.status}
      topicTitle={run.topic?.title ?? "(deleted topic)"}
      model={run.model}
      initialBlogId={run.blog?.id ?? null}
      initialError={run.error}
      initialEvents={run.events.map((e) => ({
        seq: e.seq,
        type: e.type,
        level: e.level,
        message: e.message,
        data: e.data,
      }))}
    />
  );
}
