import { z } from "zod";
import { route, json } from "@/lib/api";
import { createTopics, listTopics } from "@/lib/topics";

export const GET = route(async () => json(await listTopics()));

const schema = z.object({
  topics: z.array(
    z.object({
      title: z.string().min(1),
      brief: z.string().optional().nullable(),
    }),
  ),
});

export const POST = route(async (req: Request) => {
  const { topics } = schema.parse(await req.json());
  const result = await createTopics(topics);
  return json(result, { status: 201 });
});
