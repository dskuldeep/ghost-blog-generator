import { route, json, ApiError } from "@/lib/api";
import {
  deleteSkill,
  getActiveOrLatestVersion,
  getSkillDetail,
} from "@/lib/skills";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const skill = await getSkillDetail(id);
  if (!skill) throw new ApiError(404, "Skill not found");
  const current = await getActiveOrLatestVersion(id);
  return json({
    skill: {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      activeVersionId: skill.activeVersionId,
    },
    versions: skill.versions,
    current: current
      ? {
          versionId: current.id,
          version: current.version,
          skillMd: current.skillMd,
          files: current.files.map((f) => ({
            path: f.path,
            content: f.content,
          })),
        }
      : null,
  });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteSkill(id);
  return json({ ok: true });
});
