import { PageHeader, PageBody } from "@/components/page-header";
import { listRuns } from "@/lib/runs";
import { RunsList } from "./runs-list";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const runs = await listRuns();
  return (
    <>
      <PageHeader
        title="Runs"
        description="Live progress of agentic blog generation jobs."
      />
      <PageBody>
        <RunsList
          initial={runs.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
            startedAt: r.startedAt?.toISOString() ?? null,
            finishedAt: r.finishedAt?.toISOString() ?? null,
          }))}
        />
      </PageBody>
    </>
  );
}
