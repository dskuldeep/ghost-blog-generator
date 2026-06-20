declare module "@tryghost/admin-api" {
  interface GhostAdminAPIOptions {
    url: string;
    key: string;
    version: string;
  }

  interface GhostImage {
    url: string;
    ref?: string | null;
  }

  interface GhostPost {
    id: string;
    uuid?: string;
    title: string;
    slug?: string;
    url?: string;
    status?: string;
    html?: string;
    feature_image?: string | null;
    [key: string]: unknown;
  }

  interface GhostSite {
    title: string;
    description?: string;
    url: string;
    version?: string;
  }

  class GhostAdminAPI {
    constructor(options: GhostAdminAPIOptions);
    site: { read(): Promise<GhostSite> };
    posts: {
      add(
        data: Partial<GhostPost>,
        options?: { source?: "html" },
      ): Promise<GhostPost>;
      edit(
        data: Partial<GhostPost> & { id: string; updated_at?: string },
        options?: { source?: "html" },
      ): Promise<GhostPost>;
      read(data: { id: string }): Promise<GhostPost>;
    };
    images: {
      upload(data: {
        file: string | Buffer | { value: Buffer; filename: string; contentType?: string };
        ref?: string;
      }): Promise<GhostImage>;
    };
  }

  export default GhostAdminAPI;
}
