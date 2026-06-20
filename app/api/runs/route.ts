import { route, json } from "@/lib/api";
import { listRuns } from "@/lib/runs";

export const GET = route(async () => json(await listRuns()));
