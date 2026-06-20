import { z } from "zod";
import { route, json } from "@/lib/api";
import { publishBlog } from "@/lib/blogs";

export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ status: z.enum(["draft", "published"]) });

export const POST = route(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { status } = schema.parse(await req.json());
  const blog = await publishBlog(id, status);
  return json({ ok: true, ghostUrl: blog.ghostUrl, status: blog.status });
});
