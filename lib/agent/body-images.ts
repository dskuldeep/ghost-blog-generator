import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { getGeminiClient } from "@/lib/gemini";
import { generateJSON } from "@/lib/agent/llm";
import { IMAGE_PLAN_SCHEMA } from "@/lib/agent/schemas";
import { BRAND_PROMPT_PALETTE, DEFAULT_IMAGE_MODEL } from "@/lib/agent/image-gen";

/** A planned in-body illustration: what to draw + where it goes. */
export interface ImageSpec {
  /** Visual brief for the illustration (subject + composition, no text). */
  prompt: string;
  /** Accessible alt text. */
  alt: string;
  /** The exact `## ` heading the image should sit under. */
  afterHeading: string;
}

/** A generated image ready to store: its spec plus the encoded bytes. */
export interface GeneratedImage extends ImageSpec {
  data: Buffer;
  mimeType: string;
}

const MAX_PLAN_CHARS = 12000;

/** Clamp a requested count into the supported range. */
export function clampImageCount(count: number): number {
  return Math.max(1, Math.min(4, Math.round(count) || 0));
}

/** Local API path the markdown references; bytes are served on demand. */
export function localImageUrl(blogId: string, idx: number): string {
  return `/api/blogs/${blogId}/images/${idx}`;
}

// ---------------------------------------------------------------------------
// 2. Planner — the "art director" (text model). Matches art to the CONTENT.
// ---------------------------------------------------------------------------

/**
 * Plan `count` on-topic illustrations for the post, each anchored to a distinct
 * `## ` heading. Reads the actual draft so subjects + placement follow the post.
 * Returns at most `count` specs (possibly fewer); never throws on a weak plan.
 */
export async function planBodyImages(
  ai: GoogleGenAI,
  model: string,
  opts: { title: string; content: string; count: number; brief?: string | null },
): Promise<ImageSpec[]> {
  const count = clampImageCount(opts.count);
  // Strip any previously-injected image refs so the planner reads clean prose.
  const content = opts.content
    .replace(/^!\[[^\]]*\]\(\/api\/blogs\/[^)]+\)\s*$/gm, "")
    .slice(0, MAX_PLAN_CHARS);

  const result = await generateJSON<{ images: ImageSpec[] }>(ai, model, {
    system:
      "You are an art director picking minimal, on-topic illustrations for a finance blog.",
    prompt: [
      `Plan exactly ${count} illustration(s) for this blog post.`,
      "",
      `TITLE: ${opts.title}`,
      opts.brief ? `BRIEF: ${opts.brief}` : "",
      "",
      "POST (Markdown):",
      content,
      "",
      "RULES:",
      `- Plan exactly ${count} illustrations, each anchored to a DISTINCT '## ' heading from the post.`,
      "- Spread them across the post; never put two images in the same section.",
      "- Each is a flat, minimal line-art concept representing that section's idea.",
      "- The 'prompt' describes objects + composition ONLY — never any text, letters, numbers, or logos.",
      "- 'afterHeading' must be the exact heading text (without the leading '##').",
    ]
      .filter(Boolean)
      .join("\n"),
    schema: IMAGE_PLAN_SCHEMA,
    temperature: 0.6,
  });

  const images = Array.isArray(result?.images) ? result.images : [];
  return images
    .filter((s) => s && s.prompt && s.afterHeading)
    .slice(0, count);
}

// ---------------------------------------------------------------------------
// 3. Render — Nano Banana 2 (image model). Matches art to the SITE THEME.
// ---------------------------------------------------------------------------

/** Assemble the render prompt: planner supplies the subject, the rest is fixed. */
export function buildImagePrompt(spec: ImageSpec): string {
  return [
    "Create a single sophisticated editorial illustration for a tokenized-markets / trading blog post.",
    `Subject: ${spec.prompt}`,
    "",
    "Visual style: elegant flat LINE-ART illustration — confident, clearly visible thin outlines " +
      "in deep navy ink with periwinkle/indigo fills, forming a clean thematic scene. " +
      "Premium, minimal, plenty of calm negative space.",
    `Color theme: ${BRAND_PROMPT_PALETTE}.`,
    "",
    "STRICT REQUIREMENTS:",
    "- Absolutely NO text, NO letters, NO numbers, NO words, NO logos, NO watermarks anywhere.",
    "- No photorealism, no 3D render, no heavy gradients — flat line-art only.",
    "- Centered composition with comfortable margins; 4:3 landscape.",
  ].join("\n");
}

/**
 * Render one illustration with Nano Banana 2. Returns the raw image bytes, or
 * null on any failure (the caller simply drops that spec — a flaky image never
 * breaks the run).
 */
export async function generateBodyIllustration(opts: {
  apiKey: string;
  model?: string;
  spec: ImageSpec;
}): Promise<Buffer | null> {
  try {
    const ai = getGeminiClient(opts.apiKey);
    const res = await ai.models.generateContent({
      model: opts.model || DEFAULT_IMAGE_MODEL,
      contents: buildImagePrompt(opts.spec),
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "4:3" },
      },
    });
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (data) return Buffer.from(data, "base64");
    }
    return null;
  } catch (err) {
    console.error(
      "[body-images] illustration generation failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// 4. Compression — make the art cheap to load (WebP, capped width).
// ---------------------------------------------------------------------------

/** Resize to ≤1200px wide and encode as WebP. Best-effort: returns input on failure. */
export async function compressIllustration(image: Buffer): Promise<Buffer> {
  try {
    return await sharp(image)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (err) {
    console.error(
      "[body-images] compression failed, using original:",
      err instanceof Error ? err.message : err,
    );
    return image;
  }
}

// ---------------------------------------------------------------------------
// 5. Placement — pure string work on the Markdown (the source of truth).
// ---------------------------------------------------------------------------

/** Normalize a heading for fuzzy matching: drop '#', '*', '_', collapse spaces. */
function normalizeHeading(text: string): string {
  return text
    .replace(/[#*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Remove any previously-injected image lines for this blog so regeneration is
 * idempotent (no duplicates on re-run).
 */
export function stripBodyImages(markdown: string, blogId: string): string {
  const pattern = new RegExp(
    `^!\\[[^\\]]*\\]\\(/api/blogs/${blogId}/images/\\d+\\)\\s*$\\n?`,
    "gm",
  );
  return markdown.replace(pattern, "");
}

/** A line index of the markdown's `## ` headings. */
function findHeadings(lines: string[]): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) inFence = !inFence;
    if (inFence) continue;
    const m = lines[i].match(/^##\s+(.+?)\s*$/);
    if (m) out.push({ line: i, text: normalizeHeading(m[1]) });
  }
  return out;
}

/**
 * Inject each image as its own paragraph at the END of its target section (just
 * before the next heading). Matching is exact-or-fuzzy on the heading text; a
 * section already used by another image is skipped. Unmatched images are spread
 * evenly across the remaining sections, or appended if the post has no headings.
 */
export function placeImagesInMarkdown(
  markdown: string,
  images: { idx: number; alt: string; url: string; afterHeading: string }[],
): string {
  if (!images.length) return markdown;

  const lines = markdown.split("\n");
  const headings = findHeadings(lines);

  // The line *after* which an image's markdown should be inserted: the last
  // content line of the section (i.e. just before the next `## ` heading, or EOF).
  const sectionEnd = (headingIdx: number): number => {
    const next = headings[headingIdx + 1];
    return next ? next.line - 1 : lines.length - 1;
  };

  // section index in `headings` → image to place there.
  const assignment = new Map<number, (typeof images)[number]>();
  const used = new Set<number>();
  const unplaced: typeof images = [];

  if (headings.length === 0) {
    // No headings: every image is appended at the end of the post.
    const tail = images
      .map((img) => `\n![${escapeAlt(img.alt)}](${img.url})\n`)
      .join("");
    return `${markdown.replace(/\s*$/, "")}\n${tail}`;
  }

  // First pass: match by heading text (exact, then fuzzy includes either way).
  for (const img of images) {
    const target = img.afterHeading ? normalizeHeading(img.afterHeading) : "";
    let found = -1;
    if (target) {
      found = headings.findIndex((h, i) => !used.has(i) && h.text === target);
      if (found < 0) {
        found = headings.findIndex(
          (h, i) =>
            !used.has(i) &&
            (h.text.includes(target) || target.includes(h.text)),
        );
      }
    }
    if (found >= 0) {
      used.add(found);
      assignment.set(found, img);
    } else {
      unplaced.push(img);
    }
  }

  // Second pass: spread the unmatched images evenly across free sections.
  if (unplaced.length) {
    const free = headings
      .map((_, i) => i)
      .filter((i) => !used.has(i));
    if (free.length) {
      const step = Math.max(1, Math.floor(free.length / unplaced.length));
      let slot = 0;
      for (const img of unplaced) {
        const sec = free[Math.min(slot, free.length - 1)];
        if (!used.has(sec)) {
          used.add(sec);
          assignment.set(sec, img);
        }
        slot += step;
      }
    }
  }

  // Insert from the bottom up so earlier line numbers stay valid.
  const insertions = [...assignment.entries()]
    .map(([sec, img]) => ({ at: sectionEnd(sec), img }))
    .sort((a, b) => b.at - a.at);

  for (const { at, img } of insertions) {
    const block = `\n![${escapeAlt(img.alt)}](${img.url})\n`;
    lines.splice(at + 1, 0, block);
  }

  return lines.join("\n");
}

/** Keep alt text safe inside the markdown image syntax. */
function escapeAlt(alt: string): string {
  return alt.replace(/[\[\]]/g, "").replace(/\n/g, " ").slice(0, 120);
}
