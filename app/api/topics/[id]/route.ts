import { route, json } from "@/lib/api";
import { deleteTopic } from "@/lib/topics";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteTopic(id);
  return json({ ok: true });
});
