import { route, json } from "@/lib/api";
import { getResolvedSettings } from "@/lib/settings";
import { testGemini } from "@/lib/gemini";

export const POST = route(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const settings = await getResolvedSettings();
  const apiKey = (body.apiKey as string)?.trim() || settings.geminiApiKey;
  const model = (body.model as string)?.trim() || settings.geminiModel;

  if (!apiKey) {
    return json({ ok: false, message: "No Gemini API key configured." });
  }
  return json(await testGemini(apiKey, model));
});
