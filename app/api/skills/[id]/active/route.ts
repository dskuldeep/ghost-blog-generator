import { z } from "zod";
import { route, json } from "@/lib/api";
import { setActiveVersion } from "@/lib/skills";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ versionId: z.string().min(1) });

export const POST = route(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { versionId } = schema.parse(await req.json());
  await setActiveVersion(id, versionId);
  return json({ ok: true });
});
