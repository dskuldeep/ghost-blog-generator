import { PageHeader, PageBody } from "@/components/page-header";
import { listSkills } from "@/lib/skills";
import { SkillsList } from "./skills-list";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const skills = await listSkills();
  return (
    <>
      <PageHeader
        title="Skill Playground"
        description="Upload, edit, version, and fine-tune the blog-writing skill the agent uses."
      />
      <PageBody>
        <SkillsList initial={skills} />
      </PageBody>
    </>
  );
}
