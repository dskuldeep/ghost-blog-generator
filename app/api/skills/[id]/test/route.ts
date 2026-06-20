import { z } from "zod";
import { route, ApiError } from "@/lib/api";
import { getResolvedSettings } from "@/lib/settings";
import { runAgent } from "@/lib/agent/orchestrator";
import type { AgentEvent } from "@/lib/agent/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  topic: z.string().min(2),
  skillMd: z.string(),
  files: z.array(z.object({ path: z.string(), content: z.string() })),
});

export const POST = route(async (req: Request) => {
  const body = await req.json();
  const { topic, skillMd, files } = schema.parse(body);

  const settings = await getResolvedSettings();
  if (!settings.geminiApiKey) {
    throw new ApiError(400, "Gemini API key is not configured (see Settings).");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      let seq = 0;
      const emit = (e: AgentEvent) =>
        send({ kind: "event", event: { ...e, seq: seq++, level: e.level ?? "info" } });

      try {
        const result = await runAgent(
          {
            topic: { title: topic },
            skill: { skillMd, files },
            settings,
          },
          emit,
        );
        send({
          kind: "result",
          result: {
            title: result.title,
            html: result.html,
            excerpt: result.excerpt,
            tags: result.tags,
            evalScore: result.evalScore,
            citations: result.citations,
          },
        });
      } catch (err) {
        send({
          kind: "error",
          message: err instanceof Error ? err.message : "Agent run failed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
});
