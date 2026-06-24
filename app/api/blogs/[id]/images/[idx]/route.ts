import { route, ApiError } from "@/lib/api";
import { getBodyImage } from "@/lib/blogs";

type Ctx = { params: Promise<{ id: string; idx: string }> };

// Serve the raw bytes for one body image from the DB.
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { id, idx } = await ctx.params;
  const n = Number.parseInt(idx, 10);
  if (!Number.isInteger(n) || n < 0) throw new ApiError(400, "Bad image index");
  const img = await getBodyImage(id, n);
  if (!img) throw new ApiError(404, "No such image");
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mimeType,
      "Cache-Control": "no-store",
    },
  });
});
