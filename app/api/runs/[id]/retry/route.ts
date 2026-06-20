import { route, json, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { enqueueGeneration } from "@/lib/run-service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const run = await db.run.findUnique({ where: { id } });
  if (!run) throw new ApiError(404, "Run not found");
  if (!run.topicId) throw new ApiError(400, "Run has no topic to retry.");
  const newRun = await enqueueGeneration(run.topicId, run.skillVersionId);
  return json({ runId: newRun.id }, { status: 201 });
});
