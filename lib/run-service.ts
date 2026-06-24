import { db } from "@/lib/db";
import { getResolvedSettings } from "@/lib/settings";
import { runAgent } from "@/lib/agent/orchestrator";
import { regenerateBodyImages, regenerateHero } from "@/lib/blogs";
import { htmlToMarkdown } from "@/lib/markdown";
import { enqueueJob, GENERATE_BLOG } from "@/lib/queue";
import type { AgentEvent } from "@/lib/agent/types";
import type { Prisma } from "@prisma/client";

/** Append a run event (sequential per run, so count-based seq is safe). */
export async function addEvent(runId: string, e: AgentEvent) {
  const seq = await db.runEvent.count({ where: { runId } });
  await db.runEvent.create({
    data: {
      runId,
      seq,
      type: e.type,
      level: e.level ?? "info",
      message: e.message,
      data: (e.data as Prisma.InputJsonValue) ?? undefined,
    },
  });
}

/** Resolve which skill version to use: explicit, else the most-recent skill's active/latest. */
export async function resolveSkillVersionId(
  explicit?: string | null,
): Promise<string | null> {
  if (explicit) return explicit;
  const skill = await db.skill.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!skill) return null;
  if (skill.activeVersionId) return skill.activeVersionId;
  const latest = await db.skillVersion.findFirst({
    where: { skillId: skill.id },
    orderBy: { version: "desc" },
  });
  return latest?.id ?? null;
}

/** Create a queued Run for a topic and enqueue the background job. */
export async function enqueueGeneration(
  topicId: string,
  skillVersionId?: string | null,
) {
  const settings = await getResolvedSettings();
  const versionId = await resolveSkillVersionId(skillVersionId);
  if (!versionId) {
    throw new Error("No skill available. Create or import a skill first.");
  }

  const run = await db.run.create({
    data: {
      kind: "generate",
      status: "queued",
      topicId,
      skillVersionId: versionId,
      model: settings.geminiModel,
    },
  });
  await db.topic.update({
    where: { id: topicId },
    data: { status: "queued" },
  });

  const jobId = await enqueueJob(GENERATE_BLOG, { runId: run.id });
  await db.run.update({ where: { id: run.id }, data: { jobId } });
  await addEvent(run.id, { type: "stage", message: "Queued for generation." });

  return run;
}

/** Execute a run end-to-end. Called by the worker. */
export async function executeRun(runId: string) {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: { topic: true },
  });
  if (!run) throw new Error(`Run ${runId} not found`);
  if (run.status === "cancelled") {
    console.log(`[run] ${runId} was cancelled before start; skipping.`);
    return;
  }
  if (!run.topic) throw new Error(`Run ${runId} has no topic`);

  const version = run.skillVersionId
    ? await db.skillVersion.findUnique({
        where: { id: run.skillVersionId },
        include: { files: true },
      })
    : null;
  if (!version) throw new Error("Skill version not found for run");

  const settings = await getResolvedSettings();

  await db.run.update({
    where: { id: runId },
    data: { status: "running", startedAt: new Date() },
  });
  await db.topic.update({
    where: { id: run.topicId! },
    data: { status: "running" },
  });

  const emit = (e: AgentEvent) => addEvent(runId, e);

  try {
    const result = await runAgent(
      {
        topic: { title: run.topic.title, brief: run.topic.brief },
        skill: {
          skillMd: version.skillMd,
          files: version.files.map((f) => ({
            path: f.path,
            content: f.content,
          })),
        },
        settings,
      },
      emit,
    );

    const blog = await db.blog.create({
      data: {
        topicId: run.topicId,
        skillVersionId: version.id,
        title: result.title,
        html: result.html,
        markdown: htmlToMarkdown(result.html),
        excerpt: result.excerpt,
        tags: result.tags,
        status: "drafted",
        evalScore: result.evalScore,
        evalData: result.evalData as unknown as Prisma.InputJsonValue,
        citations: result.citations as unknown as Prisma.InputJsonValue,
      },
    });

    // Auto-generate the hero image (non-fatal: a failure shouldn't fail the run).
    try {
      await emit({ type: "stage", message: "Generating hero image…" });
      await regenerateHero(blog.id);
      await emit({
        type: "stage",
        level: "success",
        message: "Hero image generated.",
      });
    } catch (heroErr) {
      await emit({
        type: "stage",
        level: "warn",
        message: `Hero image generation failed: ${
          heroErr instanceof Error ? heroErr.message : "error"
        }`,
      });
    }

    // Auto-generate in-body illustrations (best-effort; never fails the run).
    try {
      await emit({ type: "stage", message: "Generating body images…" });
      const n = await regenerateBodyImages(blog.id);
      await emit({
        type: "stage",
        level: "success",
        message: n > 0 ? `Generated ${n} body image(s).` : "No body images added.",
      });
    } catch (bodyErr) {
      await emit({
        type: "stage",
        level: "warn",
        message: `Body image generation failed: ${
          bodyErr instanceof Error ? bodyErr.message : "error"
        }`,
      });
    }

    await db.run.update({
      where: { id: runId },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
        blogId: blog.id,
        result: {
          blogId: blog.id,
          evalScore: result.evalScore,
        } as Prisma.InputJsonValue,
      },
    });
    await db.topic.update({
      where: { id: run.topicId! },
      data: { status: "drafted" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    await addEvent(runId, { type: "error", level: "error", message });
    await db.run.update({
      where: { id: runId },
      data: { status: "failed", finishedAt: new Date(), error: message },
    });
    if (run.topicId) {
      await db.topic.update({
        where: { id: run.topicId },
        data: { status: "failed" },
      });
    }
    throw err;
  }
}
