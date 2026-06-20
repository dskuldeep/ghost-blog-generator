import { route, json } from "@/lib/api";
import { cancelRun } from "@/lib/runs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await cancelRun(id);
  return json({ ok: true });
});
