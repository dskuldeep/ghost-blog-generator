import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { HeroStyle } from "@/lib/settings";

// Flo brand palette (matches the marketing og-image).
const BG = "#fdf8ec"; // warm cream
const INK = "#14142b"; // near-black navy for the wordmark + title
const PERIWINKLE = "#97a6f0"; // dot + footer
const BAR = "#aab4f4"; // bottom accent bar
const SUBTLE = "#6e7390"; // muted slate (used when there is no background)

const WIDTH = 1200;
const HEIGHT = 630;

let fontCache:
  | { name: string; data: Buffer; weight: number; style: "normal" }[]
  | null = null;

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
  if (len < 40) return 60;
  if (len < 70) return 52;
  if (len < 110) return 44;
  return 36;
}

/**
 * Render the Flo-branded hero image (1200×630) as PNG bytes.
 *
 * The text + scrim layer is rendered with Satori (next/og) on a transparent
 * canvas, then composited over the AI-generated line-art background with sharp.
 * (Satori can't reliably decode raster images, so we don't hand it the bg.)
 * When no background is supplied, a clean cream design is returned.
 */
export async function renderHeroPng(opts: {
  title: string;
  style?: HeroStyle;
  background?: Buffer | null;
}): Promise<Buffer> {
  const fonts = await loadFonts();
  const title = opts.title.trim().slice(0, 160);
  const footer = opts.style?.brand?.trim() || "flo.finance";
  const hasBg = !!opts.background;
  const titleColor = hasBg ? INK : SUBTLE;

  const overlay = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: hasBg ? "transparent" : BG,
          fontFamily: "Inter",
          padding: "76px 80px 110px 80px",
          position: "relative",
        }}
      >
        {/* Wordmark: "Flo" + periwinkle dot */}
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: INK,
              letterSpacing: -4,
              lineHeight: 1,
            }}
          >
            Flo
          </div>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 26,
              background: PERIWINKLE,
              marginLeft: 5,
              marginBottom: 10,
            }}
          />
        </div>

        {/* Title (the focus) */}
        <div
          style={{
            display: "flex",
            maxWidth: 560,
            fontSize: titleFontSize(title.length),
            fontWeight: 700,
            color: titleColor,
            lineHeight: 1.18,
            letterSpacing: -0.5,
          }}
        >
          {title}
        </div>

        {/* Footer wordmark */}
        <div
          style={{
            position: "absolute",
            left: 80,
            bottom: 52,
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
            display: "flex",
            background: BAR,
          }}
        />
      </div>
    ) as never,
    { width: WIDTH, height: HEIGHT, fonts: fonts as never },
  );

  const overlayPng = Buffer.from(await overlay.arrayBuffer());
  if (!opts.background) return overlayPng;

  // Cover-fit the AI background, lay the full-bleed legibility scrim over it,
  // then the text overlay. The scrim is rendered with sharp (not Satori) so it
  // covers the entire canvas — Satori clips absolutely-positioned children to
  // the padded content box, which left a hard seam near the edges.
  const bgPng = await sharp(opts.background)
    .resize(WIDTH, HEIGHT, { fit: "cover" })
    .toBuffer();
  const scrimPng = await sharp(Buffer.from(scrimSvg())).png().toBuffer();
  return sharp(bgPng)
    .composite([{ input: scrimPng }, { input: overlayPng }])
    .png()
    .toBuffer();
}

/** Full-canvas legibility scrim: a light global wash + a left-weighted cream
 *  gradient that keeps the title crisp while the art shows toward the right. */
function scrimSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#fdf8ec" fill-opacity="0.12"/>
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fdf8ec" stop-opacity="0.96"/>
      <stop offset="36%" stop-color="#fdf8ec" stop-opacity="0.93"/>
      <stop offset="52%" stop-color="#fdf8ec" stop-opacity="0.5"/>
      <stop offset="66%" stop-color="#fdf8ec" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#scrim)"/>
</svg>`;
}
