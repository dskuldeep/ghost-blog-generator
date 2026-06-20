import { route, json, ApiError } from "@/lib/api";
import { getRunWithEvents } from "@/lib/runs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const run = await getRunWithEvents(id);
  if (!run) throw new ApiError(404, "Run not found");
  return json({
    id: run.id,
    status: run.status,
    kind: run.kind,
    model: run.model,
    error: run.error,
    topicTitle: run.topic?.title ?? null,
    blogId: run.blog?.id ?? null,
    blogTitle: run.blog?.title ?? null,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    events: run.events.map((e) => ({
      seq: e.seq,
      type: e.type,
      level: e.level,
      message: e.message,
      data: e.data,
      ts: e.ts,
    })),
  });
});
