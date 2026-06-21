import { notFound } from "next/navigation";
import { ensureMarkdown, getBlog } from "@/lib/blogs";
import { getClientSettings } from "@/lib/settings";
import { BlogEditor } from "./blog-editor";

export const dynamic = "force-dynamic";

export default async function BlogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const blog = await getBlog(id);
  if (!blog) notFound();
  const markdown = await ensureMarkdown(id);
  const settings = await getClientSettings();

  return (
    <BlogEditor
      ghostConfigured={!!settings.ghostApiUrl && settings.ghostAdminKeySet}
      initial={{
        id: blog.id,
        title: blog.title,
        markdown,
        excerpt: blog.excerpt,
        tags: blog.tags,
        status: blog.status,
        evalScore: blog.evalScore,
        evalData: blog.evalData as unknown,
        hasHero: !!blog.heroImagePath,
        ghostUrl: blog.ghostUrl,
      }}
    />
  );
}
