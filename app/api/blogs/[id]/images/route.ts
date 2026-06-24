import { route, json } from "@/lib/api";
import { ensureMarkdown, listBodyImages, regenerateBodyImages } from "@/lib/blogs";

type Ctx = { params: Promise<{ id: string }> };

// List body-image metadata.
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return json({ images: await listBodyImages(id) });
});

// (Re)generate the body images; returns the new count + markdown.
export const POST = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const count = await regenerateBodyImages(id);
  const markdown = await ensureMarkdown(id);
  return json({ count, markdown });
});
