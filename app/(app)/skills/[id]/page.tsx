import { notFound } from "next/navigation";
import { getActiveOrLatestVersion, getSkillDetail } from "@/lib/skills";
import { Playground } from "./playground";

export const dynamic = "force-dynamic";

export default async function SkillPlaygroundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const skill = await getSkillDetail(id);
  if (!skill) notFound();
  const current = await getActiveOrLatestVersion(id);

  return (
    <Playground
      skillId={id}
      initialSkill={{
        id: skill.id,
        name: skill.name,
        description: skill.description,
        activeVersionId: skill.activeVersionId,
      }}
      initialVersions={skill.versions.map((v) => ({
        id: v.id,
        version: v.version,
        message: v.message,
        createdAt: v.createdAt.toISOString(),
      }))}
      initialCurrent={
        current
          ? {
              versionId: current.id,
              version: current.version,
              skillMd: current.skillMd,
              files: current.files.map((f) => ({
                path: f.path,
                content: f.content,
              })),
            }
          : null
      }
    />
  );
}
