import { ImageResponse } from "next/og";
import type { HeroStyle } from "@/lib/settings";

interface Palette {
  from: string;
  to: string;
  fg: string;
  sub: string;
  shape: string;
}

const PALETTES: Record<HeroStyle["palette"], Palette> = {
  indigo: { from: "#4f46e5", to: "#7c3aed", fg: "#ffffff", sub: "#c7d2fe", shape: "rgba(255,255,255,0.10)" },
  slate: { from: "#0f172a", to: "#334155", fg: "#f8fafc", sub: "#94a3b8", shape: "rgba(255,255,255,0.07)" },
  emerald: { from: "#047857", to: "#10b981", fg: "#ffffff", sub: "#a7f3d0", shape: "rgba(255,255,255,0.10)" },
  rose: { from: "#9f1239", to: "#fb7185", fg: "#ffffff", sub: "#fecdd3", shape: "rgba(255,255,255,0.12)" },
  amber: { from: "#b45309", to: "#f59e0b", fg: "#ffffff", sub: "#fde68a", shape: "rgba(255,255,255,0.12)" },
};

function titleFontSize(len: number): number {
  if (len < 30) return 76;
  if (len < 55) return 64;
  if (len < 85) return 52;
  return 44;
}

/** Render a minimal, modern hero image (1200×630) as PNG bytes. */
export async function renderHeroPng(opts: {
  title: string;
  style: HeroStyle;
}): Promise<Buffer> {
  const p = PALETTES[opts.style.palette] ?? PALETTES.indigo;
  const title = opts.title.slice(0, 140);
  const brand = opts.style.brand?.trim();
  const serif = opts.style.font === "serif";

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: `linear-gradient(135deg, ${p.from} 0%, ${p.to} 100%)`,
          fontFamily: serif ? "serif" : "sans-serif",
          position: "relative",
        }}
      >
        {/* abstract shapes */}
        <div
          style={{
            position: "absolute",
            top: -180,
            right: -120,
            width: 460,
            height: 460,
            borderRadius: 460,
            background: p.shape,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -160,
            left: 260,
            width: 320,
            height: 320,
            borderRadius: 320,
            background: p.shape,
          }}
        />

        {/* top: brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: p.fg,
              opacity: 0.95,
            }}
          />
          <div
            style={{
              color: p.sub,
              fontSize: 26,
              letterSpacing: 1,
              fontWeight: 600,
            }}
          >
            {brand || "Insights"}
          </div>
        </div>

        {/* title */}
        <div
          style={{
            display: "flex",
            color: p.fg,
            fontSize: titleFontSize(title.length),
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: -1,
            maxWidth: 980,
          }}
        >
          {title}
        </div>

        {/* bottom accent bar */}
        <div
          style={{
            display: "flex",
            width: 120,
            height: 8,
            borderRadius: 8,
            background: p.fg,
            opacity: 0.9,
          }}
        />
      </div>
    ) as never,
    { width: 1200, height: 630 },
  );

  return Buffer.from(await image.arrayBuffer());
}
