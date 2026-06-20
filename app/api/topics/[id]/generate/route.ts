import { z } from "zod";
import { route, json } from "@/lib/api";
import { enqueueGeneration } from "@/lib/run-service";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ skillVersionId: z.string().optional() });

export const POST = route(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { skillVersionId } = schema.parse(body);
  const run = await enqueueGeneration(id, skillVersionId);
  return json({ runId: run.id }, { status: 201 });
});
