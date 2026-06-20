import { makeWorkerUtils, type WorkerUtils } from "graphile-worker";

export const GENERATE_BLOG = "generate-blog";

let utilsPromise: Promise<WorkerUtils> | null = null;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  return url;
}

async function getWorkerUtils(): Promise<WorkerUtils> {
  if (!utilsPromise) {
    utilsPromise = (async () => {
      const utils = await makeWorkerUtils({
        connectionString: connectionString(),
      });
      // Ensure the graphile_worker schema exists even if the worker hasn't run yet.
      await utils.migrate();
      return utils;
    })();
  }
  return utilsPromise;
}

export async function enqueueJob(
  task: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const utils = await getWorkerUtils();
  const job = await utils.addJob(task, payload);
  return String(job.id);
}
