-- Store the hero image bytes directly in the DB so it is shared across
-- the web and worker containers (which have separate filesystems).
ALTER TABLE "Blog" ADD COLUMN "heroImage" BYTEA;
