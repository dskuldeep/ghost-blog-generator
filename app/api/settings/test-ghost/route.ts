import { route, json } from "@/lib/api";
import { getResolvedSettings } from "@/lib/settings";
import { testGhost } from "@/lib/ghost";

export const POST = route(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const settings = await getResolvedSettings();
  const url = (body.url as string)?.trim() || settings.ghostApiUrl;
  const key = (body.key as string)?.trim() || settings.ghostAdminKey;

  if (!url || !key) {
    return json({
      ok: false,
      message: "Ghost API URL and Admin API key are both required.",
    });
  }
  return json(await testGhost(url, key));
});
