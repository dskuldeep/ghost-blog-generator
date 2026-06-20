import { route, json } from "@/lib/api";
import { listBlogs } from "@/lib/blogs";

export const GET = route(async () => json(await listBlogs()));
