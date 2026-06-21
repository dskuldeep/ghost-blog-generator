import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import type { HeroStyle } from "@/lib/settings";

// Flo brand palette (matches the marketing og-image).
const BG = "#fdf8ec"; // warm cream
const INK = "#14142b"; // near-black navy for the wordmark
const PERIWINKLE = "#97a6f0"; // dot + footer
const BAR = "#aab4f4"; // bottom accent bar
const SUBTLE = "#6e7390"; // muted slate for the title/subtitle

let fontCache: { name: string; data: Buffer; weight: number; style: "normal" }[] | null = null;

async function loadFonts() {
  if (fontCache) return fontCache;
  const dir = path.join(process.cwd(), "assets", "fonts");
  const [i500, i700, i800, mono] = await Promise.all([
    readFile(path.join(dir, "Inter-500.woff")),
    readFile(path.join(dir, "Inter-700.woff")),
    readFile(path.join(dir, "Inter-800.woff")),
    readFile(path.join(dir, "JetBrainsMono-700.woff")),
  ]);
  fontCache = [
    { name: "Inter", data: i500, weight: 500, style: "normal" },
    { name: "Inter", data: i700, weight: 700, style: "normal" },
    { name: "Inter", data: i800, weight: 800, style: "normal" },
    { name: "JetBrains Mono", data: mono, weight: 700, style: "normal" },
  ];
  return fontCache;
}

function titleFontSize(len: number): number {
  if (len < 40) return 52;
  if (len < 70) return 46;
  if (len < 110) return 40;
  return 34;
}

/**
 * Render the Flo-branded hero image (1200×630) as PNG bytes:
 * big "Flo." wordmark, the blog title as a subtitle, a monospace
 * "flo.finance" footer, and a periwinkle accent bar along the bottom.
 */
export async function renderHeroPng(opts: {
  title: string;
  style?: HeroStyle;
}): Promise<Buffer> {
  const fonts = await loadFonts();
  const title = opts.title.trim().slice(0, 160);
  const footer = opts.style?.brand?.trim() || "flo.finance";

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: BG,
          fontFamily: "Inter",
          padding: "0 100px",
          position: "relative",
        }}
      >
        {/* Wordmark: "Flo" + periwinkle dot */}
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <div
            style={{
              fontSize: 150,
              fontWeight: 800,
              color: INK,
              letterSpacing: -6,
              lineHeight: 1,
            }}
          >
            Flo
          </div>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 40,
              background: PERIWINKLE,
              marginLeft: 6,
              marginBottom: 14,
            }}
          />
        </div>

        {/* Title / subtitle */}
        <div
          style={{
            display: "flex",
            marginTop: 28,
            maxWidth: 940,
            fontSize: titleFontSize(title.length),
            fontWeight: 500,
            color: SUBTLE,
            lineHeight: 1.25,
            letterSpacing: -0.5,
          }}
        >
          {title}
        </div>

        {/* Footer wordmark */}
        <div
          style={{
            position: "absolute",
            left: 100,
            bottom: 56,
            display: "flex",
            fontFamily: "JetBrains Mono",
            fontWeight: 700,
            fontSize: 24,
            letterSpacing: 1,
            color: PERIWINKLE,
          }}
        >
          {footer}
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 12,
            background: BAR,
          }}
        />
      </div>
    ) as never,
    { width: 1200, height: 630, fonts: fonts as never },
  );

  return Buffer.from(await image.arrayBuffer());
}
