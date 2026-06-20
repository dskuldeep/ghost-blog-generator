import { z } from "zod";
import { route, json } from "@/lib/api";
import { enqueueGeneration } from "@/lib/run-service";
import { listPendingTopicIds } from "@/lib/topics";

const schema = z.object({
  topicIds: z.array(z.string()).optional(),
  skillVersionId: z.string().optional(),
});

export const POST = route(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { topicIds, skillVersionId } = schema.parse(body);
  const ids = topicIds?.length ? topicIds : await listPendingTopicIds();

  const runIds: string[] = [];
  for (const id of ids) {
    try {
      const run = await enqueueGeneration(id, skillVersionId);
      runIds.push(run.id);
    } catch {
      /* skip topics that fail to enqueue (e.g. no skill) — surfaced below */
    }
  }
  return json({ enqueued: runIds.length, runIds }, { status: 201 });
});
