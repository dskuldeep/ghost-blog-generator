import { route, json } from "@/lib/api";
import { syncAllToGhost } from "@/lib/blogs";

// Bulk publish/update can take a while (hero upload + post edit per blog).
export const maxDuration = 300;

export const POST = route(async () => {
  const result = await syncAllToGhost();
  return json(result);
});
