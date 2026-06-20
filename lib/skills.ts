import { db } from "@/lib/db";
import {
  packSkillZip,
  parseFrontmatter,
  parseSkillZip,
  STARTER_SKILL_MD,
} from "@/lib/skill";

export async function listSkills() {
  const skills = await db.skill.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      versions: {
        orderBy: { version: "desc" },
        select: { id: true, version: true, createdAt: true, message: true },
      },
    },
  });
  return skills.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    activeVersionId: s.activeVersionId,
    updatedAt: s.updatedAt,
    versionCount: s.versions.length,
    latestVersion: s.versions[0]?.version ?? 0,
  }));
}

export async function getSkillDetail(id: string) {
  const skill = await db.skill.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { version: "desc" },
        select: { id: true, version: true, createdAt: true, message: true },
      },
    },
  });
  return skill;
}

export async function getVersion(versionId: string) {
  return db.skillVersion.findUnique({
    where: { id: versionId },
    include: { files: { orderBy: { path: "asc" } }, skill: true },
  });
}

/** Active version of a skill (or latest if none marked active). */
export async function getActiveOrLatestVersion(skillId: string) {
  const skill = await db.skill.findUnique({ where: { id: skillId } });
  if (!skill) return null;
  if (skill.activeVersionId) {
    const v = await getVersion(skill.activeVersionId);
    if (v) return v;
  }
  const latest = await db.skillVersion.findFirst({
    where: { skillId },
    orderBy: { version: "desc" },
  });
  return latest ? getVersion(latest.id) : null;
}

export async function createSkill(input: {
  name: string;
  description?: string;
  skillMd: string;
  files: { path: string; content: string }[];
}) {
  const skill = await db.skill.create({
    data: { name: input.name, description: input.description },
  });
  const version = await db.skillVersion.create({
    data: {
      skillId: skill.id,
      version: 1,
      message: "Initial import",
      skillMd: input.skillMd,
      files: { create: input.files },
    },
  });
  await db.skill.update({
    where: { id: skill.id },
    data: { activeVersionId: version.id },
  });
  return { skillId: skill.id, versionId: version.id };
}

export async function createBlankSkill(name = "New skill") {
  return createSkill({
    name,
    description: "Writes authentic, well-researched blog posts.",
    skillMd: STARTER_SKILL_MD,
    files: [
      {
        path: "references/example.md",
        content:
          "# Reference example\n\nAdd background context, style examples, or data the writer should use.\n",
      },
    ],
  });
}

export async function importSkillFromZip(buffer: Buffer) {
  const parsed = await parseSkillZip(buffer);
  return createSkill(parsed);
}

export async function saveNewVersion(
  skillId: string,
  input: {
    skillMd: string;
    files: { path: string; content: string }[];
    message?: string;
    setActive?: boolean;
  },
) {
  const latest = await db.skillVersion.findFirst({
    where: { skillId },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const version = await db.skillVersion.create({
    data: {
      skillId,
      version: nextVersion,
      message: input.message || `Version ${nextVersion}`,
      skillMd: input.skillMd,
      files: { create: input.files },
    },
  });

  // Keep the skill's name/description in sync with the latest frontmatter.
  const fm = parseFrontmatter(input.skillMd);
  await db.skill.update({
    where: { id: skillId },
    data: {
      name: fm.name || undefined,
      description: fm.description || undefined,
      activeVersionId: input.setActive ? version.id : undefined,
      updatedAt: new Date(),
    },
  });

  return { versionId: version.id, version: nextVersion };
}

export async function setActiveVersion(skillId: string, versionId: string) {
  await db.skill.update({
    where: { id: skillId },
    data: { activeVersionId: versionId },
  });
}

export async function deleteSkill(skillId: string) {
  await db.skill.delete({ where: { id: skillId } });
}

export async function downloadVersionZip(versionId: string) {
  const version = await getVersion(versionId);
  if (!version) throw new Error("Version not found");
  const buffer = await packSkillZip({
    name: version.skill.name,
    skillMd: version.skillMd,
    files: version.files.map((f) => ({ path: f.path, content: f.content })),
  });
  return { buffer, version };
}
