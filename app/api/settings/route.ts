import { z } from "zod";
import { route, json } from "@/lib/api";
import { getClientSettings, updateSettings } from "@/lib/settings";

export const GET = route(async () => json(await getClientSettings()));

const heroStyleSchema = z.object({
  palette: z.enum(["indigo", "slate", "emerald", "rose", "amber"]),
  font: z.enum(["sans", "serif"]),
  brand: z.string().max(60).optional(),
});

const updateSchema = z.object({
  geminiApiKey: z.string().optional(),
  geminiModel: z.string().min(1).max(80).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxResearchCalls: z.number().int().min(0).max(30).optional(),
  maxReviseIterations: z.number().int().min(0).max(6).optional(),
  evalThreshold: z.number().min(0).max(1).optional(),
  ghostApiUrl: z.string().url().or(z.literal("")).optional(),
  ghostAdminKey: z.string().optional(),
  heroStyle: heroStyleSchema.optional(),
});

export const PUT = route(async (req: Request) => {
  const body = await req.json();
  const parsed = updateSchema.parse(body);
  return json(await updateSettings(parsed));
});
