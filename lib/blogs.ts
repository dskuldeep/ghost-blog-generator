import { db } from "@/lib/db";
import { getResolvedSettings } from "@/lib/settings";
import { publishToGhost } from "@/lib/ghost";
import { renderHeroPng } from "@/lib/image/hero";
import { writeHero } from "@/lib/image/store";

export async function listBlogs() {
  const blogs = await db.blog.findMany({
    orderBy: { updatedAt: "desc" },
    include: { topic: { select: { title: true } } },
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

export async function getBlog(id: string) {
  return db.blog.findUnique({ where: { id } });
}

export async function updateBlog(
  id: string,
  data: {
    title?: string;
    html?: string;
    excerpt?: string | null;
    tags?: string[];
  },
) {
  return db.blog.update({ where: { id }, data });
}

export async function deleteBlog(id: string) {
  await db.blog.delete({ where: { id } });
}

/** Render + store a hero image for the blog; returns the stored file path. */
export async function regenerateHero(id: string): Promise<string> {
  const blog = await db.blog.findUnique({ where: { id } });
  if (!blog) throw new Error("Blog not found");
  const settings = await getResolvedSettings();
  const png = await renderHeroPng({
    title: blog.title,
    style: settings.heroStyle,
  });
  const filePath = await writeHero(id, png);
  await db.blog.update({ where: { id }, data: { heroImagePath: filePath } });
  return filePath;
}

export async function publishBlog(
  id: string,
  status: "draft" | "published",
) {
  const blog = await db.blog.findUnique({ where: { id } });
  if (!blog) throw new Error("Blog not found");

  const settings = await getResolvedSettings();
  if (!settings.ghostApiUrl || !settings.ghostAdminKey) {
    throw new Error("Ghost is not configured (see Settings).");
  }

  await db.blog.update({ where: { id }, data: { status: "publishing" } });
  try {
    // Ensure a hero image exists.
    let heroPath = blog.heroImagePath;
    if (!heroPath) heroPath = await regenerateHero(id);

    const result = await publishToGhost(
      settings.ghostApiUrl,
      settings.ghostAdminKey,
      {
        title: blog.title,
        html: blog.html,
        excerpt: blog.excerpt,
        tags: blog.tags,
        heroImagePath: heroPath,
        status,
      },
    );

    const updated = await db.blog.update({
      where: { id },
      data: {
        ghostPostId: result.id,
        ghostUrl: result.url,
        status: status === "published" ? "published" : "drafted",
      },
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
