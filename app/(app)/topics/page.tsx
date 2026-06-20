import { PageHeader, PageBody } from "@/components/page-header";
import { listTopics } from "@/lib/topics";
import { listSkills } from "@/lib/skills";
import { TopicsClient } from "./topics-client";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const [topics, skills] = await Promise.all([listTopics(), listSkills()]);
  return (
    <>
      <PageHeader
        title="Topics"
        description="Upload topics, then generate well-researched blog drafts with the agent."
      />
      <PageBody>
        <TopicsClient
          initialTopics={topics.map((t) => ({
            ...t,
            createdAt: t.createdAt.toISOString(),
          }))}
          skills={skills.map((s) => ({
            id: s.id,
            name: s.name,
            activeVersionId: s.activeVersionId,
          }))}
        />
      </PageBody>
    </>
  );
}
