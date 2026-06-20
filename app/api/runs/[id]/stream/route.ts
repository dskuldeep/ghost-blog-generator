import { db } from "@/lib/db";
import { requireUser } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 600;

const TERMINAL = ["succeeded", "failed", "cancelled"];

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await ctx.params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );

      let lastSeq = -1;
      let closed = false;
      const close = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      };
      req.signal.addEventListener("abort", close);

      try {
        for (;;) {
          if (req.signal.aborted) break;

          const events = await db.runEvent.findMany({
            where: { runId: id, seq: { gt: lastSeq } },
            orderBy: { seq: "asc" },
          });
          for (const e of events) {
            send({
              kind: "event",
              event: {
                seq: e.seq,
                type: e.type,
                level: e.level,
                message: e.message,
                data: e.data,
              },
            });
            lastSeq = e.seq;
          }

          const run = await db.run.findUnique({
            where: { id },
            select: { status: true, blogId: true, error: true },
          });
          if (!run) {
            send({ kind: "error", message: "Run not found" });
            break;
          }
          if (TERMINAL.includes(run.status)) {
            send({
              kind: "status",
              status: run.status,
              blogId: run.blogId,
              error: run.error,
            });
            break;
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (err) {
        send({
          kind: "error",
          message: err instanceof Error ? err.message : "stream error",
        });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
