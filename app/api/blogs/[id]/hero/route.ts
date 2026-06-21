import { route, json, ApiError } from "@/lib/api";
import { getHeroImage, regenerateHero } from "@/lib/blogs";

type Ctx = { params: Promise<{ id: string }> };

// Serve the current hero image from the DB.
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const buf = await getHeroImage(id);
  if (!buf) throw new ApiError(404, "No hero image");
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
