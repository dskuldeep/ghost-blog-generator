import { route } from "@/lib/api";
import { downloadVersionZip } from "@/lib/skills";
import { slugify } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string; versionId: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { versionId } = await ctx.params;
  const { buffer, version } = await downloadVersionZip(versionId);
  const filename = `${slugify(version.skill.name) || "skill"}-v${version.version}.skill`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
