import { db } from "@/lib/db";
import { getResolvedSettings } from "@/lib/settings";
import { publishToGhost } from "@/lib/ghost";
import { generateHeroBackground } from "@/lib/agent/image-gen";
import { renderHeroPng } from "@/lib/image/hero";
import { heroTempFile } from "@/lib/image/store";
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
    const html = blog.markdown ? markdownToHtml(blog.markdown) : blog.html;

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
