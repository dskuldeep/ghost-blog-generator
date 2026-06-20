import { z } from "zod";
import { route, json } from "@/lib/api";
import { createBlankSkill, listSkills } from "@/lib/skills";

export const GET = route(async () => json(await listSkills()));

const createSchema = z.object({ name: z.string().min(1).max(120).optional() });

export const POST = route(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { name } = createSchema.parse(body);
  const result = await createBlankSkill(name);
  return json(result, { status: 201 });
});
