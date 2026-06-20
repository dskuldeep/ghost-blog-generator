import { route, json, ApiError } from "@/lib/api";
import { getBlog, regenerateHero } from "@/lib/blogs";
import { readHero } from "@/lib/image/store";

type Ctx = { params: Promise<{ id: string }> };

// Serve the current hero image.
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const blog = await getBlog(id);
  if (!blog?.heroImagePath) throw new ApiError(404, "No hero image");
  const buf = await readHero(blog.heroImagePath);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
});

// (Re)generate the hero image.
export const POST = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await regenerateHero(id);
  return json({ ok: true });
});
