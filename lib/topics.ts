import { db } from "@/lib/db";

export async function listTopics() {
  const topics = await db.topic.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true },
      },
      blogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true },
      },
    },
  });
  return topics.map((t) => ({
    id: t.id,
    title: t.title,
    brief: t.brief,
    status: t.status,
    createdAt: t.createdAt,
    latestRunId: t.runs[0]?.id ?? null,
    latestBlogId: t.blogs[0]?.id ?? null,
  }));
}

export async function createTopics(
  items: { title: string; brief?: string | null }[],
) {
  const clean = items
    .map((i) => ({ title: i.title.trim(), brief: i.brief?.trim() || null }))
    .filter((i) => i.title.length > 0);
  if (clean.length === 0) return { count: 0 };
  const res = await db.topic.createMany({ data: clean });
  return { count: res.count };
}

export async function deleteTopic(id: string) {
  await db.topic.delete({ where: { id } });
}

export async function listPendingTopicIds(): Promise<string[]> {
  const topics = await db.topic.findMany({
    where: { status: { in: ["pending", "failed"] } },
    select: { id: true },
  });
  return topics.map((t) => t.id);
}
