import GhostAdminAPI from "@tryghost/admin-api";

export function getGhostClient(url: string, key: string) {
  return new GhostAdminAPI({
    url: url.replace(/\/$/, ""),
    key,
    version: "v5.0",
  });
}

export async function testGhost(
  url: string,
  key: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!/^[0-9a-f]{24}:[0-9a-f]{64}$/i.test(key.trim())) {
      return {
        ok: false,
        message:
          'Admin API key must look like "<id>:<secret>" (24 hex : 64 hex). Use the Admin API key from a Ghost Custom Integration.',
      };
    }
    const api = getGhostClient(url, key);
    const site = await api.site.read();
    return {
      ok: true,
      message: `Connected to "${site.title}" (${site.url}).`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Connection failed: ${msg.slice(0, 200)}` };
  }
}

export interface PublishInput {
  title: string;
  html: string;
  excerpt?: string | null;
  tags?: string[];
  heroImagePath?: string | null;
  status?: "draft" | "published";
}

export interface PublishResult {
  id: string;
  url: string;
  status: string;
}

export async function publishToGhost(
  url: string,
  key: string,
  input: PublishInput,
): Promise<PublishResult> {
  const api = getGhostClient(url, key);

  let featureImage: string | undefined;
  if (input.heroImagePath) {
    const uploaded = await api.images.upload({ file: input.heroImagePath });
    featureImage = uploaded.url;
  }

  const post = await api.posts.add(
    {
      title: input.title,
      html: input.html,
      custom_excerpt: input.excerpt ?? undefined,
      tags: input.tags?.length ? input.tags.map((t) => ({ name: t })) : undefined,
      feature_image: featureImage,
      status: input.status ?? "draft",
    } as Record<string, unknown>,
    { source: "html" },
  );

  return {
    id: post.id,
    url: post.url ?? `${url.replace(/\/$/, "")}/`,
    status: post.status ?? "draft",
  };
}
