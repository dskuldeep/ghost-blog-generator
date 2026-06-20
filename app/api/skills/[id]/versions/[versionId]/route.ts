import { route, json, ApiError } from "@/lib/api";
import { getVersion } from "@/lib/skills";

type Ctx = { params: Promise<{ id: string; versionId: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { versionId } = await ctx.params;
  const version = await getVersion(versionId);
  if (!version) throw new ApiError(404, "Version not found");
  return json({
    versionId: version.id,
    version: version.version,
    message: version.message,
    skillMd: version.skillMd,
    files: version.files.map((f) => ({ path: f.path, content: f.content })),
  });
});
