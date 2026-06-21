import { z } from "zod";
import { route, json, ApiError } from "@/lib/api";
import { deleteBlog, getBlog, updateBlog } from "@/lib/blogs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const blog = await getBlog(id);
  if (!blog) throw new ApiError(404, "Blog not found");
  return json({
    id: blog.id,
    title: blog.title,
    html: blog.html,
    excerpt: blog.excerpt,
    tags: blog.tags,
    status: blog.status,
    evalScore: blog.evalScore,
    evalData: blog.evalData,
    citations: blog.citations,
    hasHero: !!blog.heroImagePath,
    ghostUrl: blog.ghostUrl,
    ghostPostId: blog.ghostPostId,
    updatedAt: blog.updatedAt,
  });
});

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  markdown: z.string().optional(),
  html: z.string().optional(),
  excerpt: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const data = patchSchema.parse(await req.json());
  await updateBlog(id, data);
  return json({ ok: true });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteBlog(id);
  return json({ ok: true });
});
