import { db } from "@/lib/db";

export async function listRuns(limit = 50) {
  const runs = await db.run.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      topic: { select: { title: true } },
      blog: { select: { id: true, title: true } },
    },
  });
  return runs.map((r) => ({
    id: r.id,
    status: r.status,
    kind: r.kind,
    model: r.model,
    topicTitle: r.topic?.title ?? "(deleted topic)",
    blogId: r.blog?.id ?? null,
    error: r.error,
    createdAt: r.createdAt,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
  }));
}

export async function getRunWithEvents(id: string) {
  return db.run.findUnique({
    where: { id },
    include: {
      events: { orderBy: { seq: "asc" } },
      topic: { select: { title: true } },
      blog: { select: { id: true, title: true } },
    },
  });
}

export async function cancelRun(id: string) {
  const run = await db.run.findUnique({ where: { id } });
  if (!run) throw new Error("Run not found");
  if (run.status === "queued" || run.status === "running") {
    await db.run.update({
      where: { id },
      data: { status: "cancelled", finishedAt: new Date() },
    });
    if (run.topicId) {
      await db.topic.update({
        where: { id: run.topicId },
        data: { status: "pending" },
      });
    }
  }
}
