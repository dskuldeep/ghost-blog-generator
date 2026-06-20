import { route, json, ApiError } from "@/lib/api";
import { importSkillFromZip } from "@/lib/skills";

export const POST = route(async (req: Request) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    throw new ApiError(400, "No file uploaded.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const result = await importSkillFromZip(buffer);
    return json(result, { status: 201 });
  } catch (err) {
    throw new ApiError(
      400,
      err instanceof Error ? err.message : "Failed to parse .skill archive.",
    );
  }
});
