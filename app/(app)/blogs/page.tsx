import { PageHeader, PageBody } from "@/components/page-header";
import { listBlogs } from "@/lib/blogs";
import { BlogsList } from "./blogs-list";

export const dynamic = "force-dynamic";

export default async function BlogsPage() {
  const blogs = await listBlogs();
  return (
    <>
      <PageHeader
        title="Blogs"
        description="Review, edit, and publish generated drafts to Ghost."
      />
      <PageBody>
        <BlogsList
          initial={blogs.map((b) => ({
            ...b,
            updatedAt: b.updatedAt.toISOString(),
          }))}
        />
      </PageBody>
    </>
  );
}
