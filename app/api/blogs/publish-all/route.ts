import { route, json } from "@/lib/api";
import { publishAllDrafts } from "@/lib/blogs";

// Bulk publish (hero upload + post edit per blog) can take a while.
export const maxDuration = 300;

export const POST = route(async () => {
  const result = await publishAllDrafts();
  return json(result);
});
