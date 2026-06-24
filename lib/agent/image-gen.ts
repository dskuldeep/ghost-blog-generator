import { getGeminiClient } from "@/lib/gemini";
import { withRetry } from "@/lib/agent/llm";

/** Nano Banana 2 — Gemini 3.1 Flash Image Preview. */
export const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

// Flo brand palette, handed to the image model so the art matches the site.
// Exported so the body-image generator renders on the SAME palette as the hero,
// keeping the cover and the in-body art as one visual set.
export const BRAND_PROMPT_PALETTE =
  "warm cream/ivory background (#fdf8ec), deep near-black navy ink lines (#14142b), " +
  "soft periwinkle/indigo accents (#97a6f0 and #aab4f4), with restrained use of a single " +
  "muted slate tone for depth";

function buildPrompt(title: string, brief?: string | null): string {
  return [
    "Create a sophisticated editorial hero-image BACKGROUND for a fintech blog post.",
    `The post is about: "${title}".`,
    brief ? `Context: ${brief}.` : "",
    "",
    "Visual style: elegant ISOMETRIC LINE-ART illustration — confident, clearly visible thin " +
      "outlines in deep navy with periwinkle/indigo fills, forming a thematic scene that " +
      "visually represents the topic (e.g. tokenized assets, on-chain finance, treasuries, " +
      "vaults, infrastructure, networks — choose imagery that fits the specific topic). " +
      "Clean, premium, detailed enough to read clearly.",
    `Color theme: ${BRAND_PROMPT_PALETTE}.`,
    "Composition (IMPORTANT): leave the LEFT 45% of the frame as calm, almost-empty negative " +
      "space — plain cream with at most a few faint thin lines (a title will be placed there). " +
      "Compose the ENTIRE isometric illustration within the RIGHT 55% of the canvas, bleeding " +
      "off the right edge.",
    "",
    "STRICT REQUIREMENTS:",
    "- Absolutely NO text, NO letters, NO numbers, NO words, NO logos, NO watermarks anywhere.",
    "- No photorealism, no 3D render, no gradients-heavy backgrounds — flat line-art only.",
    "- Wide 16:9 landscape banner.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Generate a text-free, brand-themed isometric line-art background relevant to
 * the blog topic using Nano Banana 2. Returns PNG bytes, or null on any failure
 * (callers fall back to the plain hero design).
 */
export async function generateHeroBackground(opts: {
  apiKey: string;
  model?: string;
  title: string;
  brief?: string | null;
}): Promise<Buffer | null> {
  try {
    const ai = getGeminiClient(opts.apiKey);
    // Retry transient 503/429s — the image preview model is flaky under load.
    const res = await withRetry(
      () =>
        ai.models.generateContent({
          model: opts.model || DEFAULT_IMAGE_MODEL,
          contents: buildPrompt(opts.title, opts.brief),
          config: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "16:9" },
          },
        }),
      4,
    );

    const parts = res.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (data) return Buffer.from(data, "base64");
    }
    return null;
  } catch (err) {
    console.error(
      "[image-gen] hero background generation failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
