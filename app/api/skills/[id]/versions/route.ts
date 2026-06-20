import { z } from "zod";
import { route, json } from "@/lib/api";
import { saveNewVersion } from "@/lib/skills";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  skillMd: z.string(),
  files: z.array(z.object({ path: z.string().min(1), content: z.string() })),
  message: z.string().max(200).optional(),
  setActive: z.boolean().optional(),
});

export const POST = route(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await req.json();
  const input = schema.parse(body);
  const result = await saveNewVersion(id, input);
  return json(result, { status: 201 });
});
