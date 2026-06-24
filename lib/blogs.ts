import { db } from "@/lib/db";
import { getResolvedSettings } from "@/lib/settings";
import { publishToGhost, uploadImageToGhost } from "@/lib/ghost";
import { generateHeroBackground } from "@/lib/agent/image-gen";
import { getGeminiClient } from "@/lib/gemini";
import {
  compressIllustration,
  generateBodyIllustration,
  localImageUrl,
  placeImagesInMarkdown,
  planBodyImages,
  stripBodyImages,
} from "@/lib/agent/body-images";
import { renderHeroPng } from "@/lib/image/hero";
import { bodyImageTempFile, heroTempFile } from "@/lib/image/store";
import { htmlToMarkdown, markdownToHtml } from "@/lib/markdown";

export async function listBlogs() {
  const blogs = await db.blog.findMany({
    orderBy: { updatedAt: "desc" },
    include: { topic: { select: { title: true } } },
    omit: { heroImage: true },
  });
  return blogs.map((b) => ({
    id: b.id,
    title: b.title,
    status: b.status,
    evalScore: b.evalScore,
    excerpt: b.excerpt,
    topicTitle: b.topic?.title ?? null,
    hasHero: !!b.heroImagePath,
    ghostUrl: b.ghostUrl,
    updatedAt: b.updatedAt,
  }));
}

/** Blog record without the (potentially large) hero image bytes. */
export async function getBlog(id: string) {
  return db.blog.findUnique({ where: { id }, omit: { heroImage: true } });
}

/** The raw hero PNG bytes for a blog, or null if none stored. */
export async function getHeroImage(id: string): Promise<Buffer | null> {
  const row = await db.blog.findUnique({
    where: { id },
    select: { heroImage: true },
  });
  return row?.heroImage ? Buffer.from(row.heroImage) : null;
}

export async function updateBlog(
  id: string,
  data: {
    title?: string;
    markdown?: string;
    html?: string;
    excerpt?: string | null;
    tags?: string[];
  },
) {
  const patch: {
    title?: string;
    markdown?: string;
    html?: string;
    excerpt?: string | null;
    tags?: string[];
  } = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.excerpt !== undefined) patch.excerpt = data.excerpt;
  if (data.tags !== undefined) patch.tags = data.tags;

  // Markdown is the source of truth: when provided, regenerate the HTML.
  if (data.markdown !== undefined) {
    patch.markdown = data.markdown;
    patch.html = markdownToHtml(data.markdown);
  } else if (data.html !== undefined) {
    patch.html = data.html;
  }

  return db.blog.update({ where: { id }, data: patch, omit: { heroImage: true } });
}

/** Render + store a hero image (in the DB) for the blog. */
export async function regenerateHero(id: string): Promise<void> {
  const blog = await db.blog.findUnique({
    where: { id },
    select: { id: true, title: true, topic: { select: { brief: true } } },
  });
  if (!blog) throw new Error("Blog not found");
  const settings = await getResolvedSettings();
  const style = settings.heroStyle;

  // Generate a topic-relevant, text-free line-art background with Nano Banana 2.
  // Falls back to the plain cream design if disabled, unkeyed, or it fails.
  let background: Buffer | null = null;
  if (style.generateBackground !== false && settings.geminiApiKey) {
    background = await generateHeroBackground({
      apiKey: settings.geminiApiKey,
      model: style.imageModel,
      title: blog.title,
      brief: blog.topic?.brief ?? null,
    });
  }

  const png = await renderHeroPng({ title: blog.title, style, background });
  await db.blog.update({
    where: { id },
    // heroImagePath doubles as a lightweight "has hero" marker for list queries.
    data: { heroImage: new Uint8Array(png), heroImagePath: "db" },
  });
}

/** List body-image metadata for a blog (no bytes). */
export async function listBodyImages(id: string) {
  return db.blogImage.findMany({
    where: { blogId: id },
    orderBy: { idx: "asc" },
    select: { idx: true, alt: true, prompt: true, mimeType: true, ghostUrl: true },
  });
}

/** The raw bytes + mime type for one body image, or null if none. */
export async function getBodyImage(
  id: string,
  idx: number,
): Promise<{ data: Buffer; mimeType: string } | null> {
  const row = await db.blogImage.findUnique({
    where: { blogId_idx: { blogId: id, idx } },
    select: { data: true, mimeType: true },
  });
  if (!row?.data) return null;
  return { data: Buffer.from(row.data), mimeType: row.mimeType };
}

/**
 * Plan, render, store, and place in-body illustrations for a blog. Replaces any
 * existing set (idempotent). Best-effort: returns the number generated (0 when
 * disabled, unkeyed, no specs, or every render failed) without throwing.
 */
export async function regenerateBodyImages(id: string): Promise<number> {
  const blog = await db.blog.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      markdown: true,
      html: true,
      topic: { select: { brief: true } },
    },
  });
  if (!blog) throw new Error("Blog not found");

  const settings = await getResolvedSettings();
  const style = settings.bodyImageStyle;
  if (style.enabled === false || !settings.geminiApiKey) return 0;

  // Markdown is the source of truth; derive it from HTML on the fly if missing.
  const baseMarkdown = blog.markdown ?? htmlToMarkdown(blog.html);
  const cleaned = stripBodyImages(baseMarkdown, id);

  const ai = getGeminiClient(settings.geminiApiKey);
  const specs = await planBodyImages(ai, settings.geminiModel, {
    title: blog.title,
    content: cleaned,
    count: style.count ?? 3,
    brief: blog.topic?.brief ?? null,
  });
  if (!specs.length) return 0;

  // Render + compress each spec in parallel; drop any that fail.
  const rendered = await Promise.all(
    specs.map(async (spec) => {
      const png = await generateBodyIllustration({
        apiKey: settings.geminiApiKey!,
        model: style.imageModel,
        spec,
      });
      if (!png) return null;
      const data = await compressIllustration(png);
      return { ...spec, data };
    }),
  );
  const images = rendered
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .map((img, idx) => ({ ...img, idx }));
  if (!images.length) return 0;

  // Replace the whole set: delete old rows, write the new ones.
  await db.$transaction([
    db.blogImage.deleteMany({ where: { blogId: id } }),
    ...images.map((img) =>
      db.blogImage.create({
        data: {
          blogId: id,
          idx: img.idx,
          prompt: img.prompt,
          alt: img.alt,
          data: new Uint8Array(img.data),
          mimeType: "image/webp",
        },
      }),
    ),
  ]);

  // Inject markdown refs and re-render the HTML from the updated markdown.
  const placed = placeImagesInMarkdown(
    cleaned,
    images.map((img) => ({
      idx: img.idx,
      alt: img.alt,
      url: localImageUrl(id, img.idx),
      afterHeading: img.afterHeading,
    })),
  );
  await db.blog.update({
    where: { id },
    data: { markdown: placed, html: markdownToHtml(placed) },
    omit: { heroImage: true },
  });

  return images.length;
}

/**
 * Upload each body image to Ghost (caching the hosted URL on the row), then
 * rewrite the local `/api/blogs/{id}/images/N` srcs in the HTML to the hosted
 * URLs. Any `<img>` whose upload failed is stripped so no broken image ships.
 */
async function resolveBodyImagesForGhost(
  blogId: string,
  html: string,
  ghostApiUrl: string,
  ghostAdminKey: string,
): Promise<string> {
  const rows = await db.blogImage.findMany({
    where: { blogId },
    orderBy: { idx: "asc" },
  });
  if (!rows.length) return html;

  const map = new Map<string, string>();
  for (const row of rows) {
    let ghostUrl = row.ghostUrl;
    if (!ghostUrl) {
      try {
        const filePath = await bodyImageTempFile(
          blogId,
          row.idx,
          Buffer.from(row.data),
        );
        ghostUrl = await uploadImageToGhost(ghostApiUrl, ghostAdminKey, filePath);
        await db.blogImage.update({
          where: { id: row.id },
          data: { ghostUrl },
        });
      } catch (err) {
        console.error(
          "[body-images] Ghost upload failed:",
          err instanceof Error ? err.message : err,
        );
        ghostUrl = null;
      }
    }
    if (ghostUrl) map.set(localImageUrl(blogId, row.idx), ghostUrl);
  }

  return rewriteBodyImageUrls(html, map);
}

/** Swap local body-image srcs for hosted Ghost URLs; strip those that failed. */
function rewriteBodyImageUrls(html: string, map: Map<string, string>): string {
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    const m = tag.match(/src="([^"]*\/api\/blogs\/[^"]+\/images\/\d+)"/);
    if (!m) return tag; // not a body image — leave untouched
    const ghostUrl = map.get(m[1]);
    if (!ghostUrl) return ""; // upload failed — drop the tag
    return tag.replace(m[1], ghostUrl);
  });
}

export async function deleteBlog(id: string) {
  await db.blog.delete({ where: { id } });
}

export async function publishBlog(id: string, status: "draft" | "published") {
  const blog = await db.blog.findUnique({ where: { id }, omit: { heroImage: true } });
  if (!blog) throw new Error("Blog not found");

  const settings = await getResolvedSettings();
  if (!settings.ghostApiUrl || !settings.ghostAdminKey) {
    throw new Error("Ghost is not configured (see Settings).");
  }

  await db.blog.update({ where: { id }, data: { status: "publishing" } });
  try {
    // Ensure a hero image exists, then materialize it to a temp file for upload.
    if (!blog.heroImagePath) await regenerateHero(id);
    const heroBytes = await getHeroImage(id);
    const heroPath = heroBytes ? await heroTempFile(id, heroBytes) : null;

    // Prefer the markdown-derived HTML so what was edited is what gets published.
    const baseHtml = blog.markdown ? markdownToHtml(blog.markdown) : blog.html;
    // Upload any in-body images to Ghost and point the HTML at the hosted URLs.
    const html = await resolveBodyImagesForGhost(
      id,
      baseHtml,
      settings.ghostApiUrl,
      settings.ghostAdminKey,
    );

    const result = await publishToGhost(
      settings.ghostApiUrl,
      settings.ghostAdminKey,
      {
        title: blog.title,
        html,
        excerpt: blog.excerpt,
        tags: blog.tags,
        heroImagePath: heroPath,
        status,
        ghostPostId: blog.ghostPostId,
      },
    );

    const updated = await db.blog.update({
      where: { id },
      data: {
        ghostPostId: result.id,
        ghostUrl: result.url,
        status: status === "published" ? "published" : "drafted",
      },
      omit: { heroImage: true },
    });
    if (status === "published" && blog.topicId) {
      await db.topic.update({
        where: { id: blog.topicId },
        data: { status: "published" },
      });
    }
    return updated;
  } catch (err) {
    await db.blog.update({ where: { id }, data: { status: "failed" } });
    throw err;
  }
}

export interface SyncResult {
  total: number;
  synced: number;
  failed: number;
  results: { id: string; title: string; ok: boolean; error?: string }[];
}

/**
 * Push every blog to Ghost: already-published posts are updated live, the rest
 * are pushed/updated as drafts. Uses the latest content + hero for each.
 */
export async function syncAllToGhost(): Promise<SyncResult> {
  const settings = await getResolvedSettings();
  if (!settings.ghostApiUrl || !settings.ghostAdminKey) {
    throw new Error("Ghost is not configured (see Settings).");
  }

  const blogs = await db.blog.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, status: true },
  });

  const results: SyncResult["results"] = [];
  let synced = 0;
  let failed = 0;
  for (const b of blogs) {
    const target = b.status === "published" ? "published" : "draft";
    try {
      await publishBlog(b.id, target);
      synced++;
      results.push({ id: b.id, title: b.title, ok: true });
    } catch (err) {
      failed++;
      results.push({
        id: b.id,
        title: b.title,
        ok: false,
        error: err instanceof Error ? err.message : "failed",
      });
    }
  }
  return { total: blogs.length, synced, failed, results };
}

/** Ensure a blog has markdown content; derive it from HTML on first access. */
export async function ensureMarkdown(id: string): Promise<string> {
  const blog = await db.blog.findUnique({
    where: { id },
    select: { markdown: true, html: true },
  });
  if (!blog) throw new Error("Blog not found");
  if (blog.markdown) return blog.markdown;
  const md = htmlToMarkdown(blog.html);
  await db.blog.update({ where: { id }, data: { markdown: md } });
  return md;
}
