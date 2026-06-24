-- Body-image style settings (enabled / model / count) live in this JSON blob.
ALTER TABLE "Settings" ADD COLUMN "bodyImageStyle" JSONB;

-- In-body illustrations for a post, stored as bytes in the DB so they are
-- shared across the web + worker containers (which have separate filesystems).
CREATE TABLE "BlogImage" (
    "id" TEXT NOT NULL,
    "blogId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
    "ghostUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BlogImage_blogId_idx" ON "BlogImage"("blogId");

CREATE UNIQUE INDEX "BlogImage_blogId_idx_key" ON "BlogImage"("blogId", "idx");

ALTER TABLE "BlogImage" ADD CONSTRAINT "BlogImage_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
