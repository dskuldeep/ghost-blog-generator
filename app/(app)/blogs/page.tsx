import { PageHeader, PageBody } from "@/components/page-header";
import { listBlogs } from "@/lib/blogs";
import { getClientSettings } from "@/lib/settings";
import { BlogsList } from "./blogs-list";
import { SyncGhostButton } from "./sync-ghost-button";
import { PublishAllButton } from "./publish-all-button";

export const dynamic = "force-dynamic";

export default async function BlogsPage() {
  const [blogs, settings] = await Promise.all([listBlogs(), getClientSettings()]);
  const ghostConfigured = !!settings.ghostApiUrl && settings.ghostAdminKeySet;
  const draftCount = blogs.filter((b) => b.status === "drafted").length;
  return (
    <>
      <PageHeader
        title="Blogs"
        description="Review, edit, and publish generated drafts to Ghost."
        actions={
          <div className="flex items-center gap-2">
            {draftCount > 0 && (
              <PublishAllButton
                ghostConfigured={ghostConfigured}
                draftCount={draftCount}
              />
            )}
            <SyncGhostButton ghostConfigured={ghostConfigured} />
          </div>
        }
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
