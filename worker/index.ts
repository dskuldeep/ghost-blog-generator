import { run } from "graphile-worker";
import { GENERATE_BLOG } from "@/lib/queue";
import { executeRun } from "@/lib/run-service";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Did you run with --env-file=.env?");
  }

  const runner = await run({
    connectionString,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
    pollInterval: 1000,
    taskList: {
      [GENERATE_BLOG]: async (payload) => {
        const { runId } = payload as { runId: string };
        console.log(`[worker] generate-blog run=${runId}`);
        await executeRun(runId);
        console.log(`[worker] finished run=${runId}`);
      },
    },
  });

  console.log("[worker] started — waiting for jobs…");
  await runner.promise;
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
