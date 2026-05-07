import { cn } from "@/lib/utils";

type Props = {
  variant?: "light" | "dark";
  className?: string;
  height?: number;
};

// SVG layout (viewBox 0 0 380 64):
//   HANDI text  : x = 0   .. ~140
//   ball mark   : x = 146 .. 198 (centered around x=172, y=28)
//   BOWLS text  : x = 210 .. ~378
//
// Ball is the rich speckled raster from /public/icons/icon-512.png.
// That asset bakes in a dark rounded-square app-icon frame (richSvg
// default `bg = INK` in scripts/gen-pwa-icons.mjs); the clipPath
// circle below hides the frame and shows only the disc.
//
// Disc geometry inside the source PNG: cx/cy = 50,50 r = 42 in a
// 100-unit viewBox, so at 52px render size the disc maps to
// centre (26,26) r ≈ 21.84 → translated by (x=146, y=2) =
// centre (172,28), radius 22 (extra .16px masks the antialias edge).
const VIEWBOX_W = 380;
const VIEWBOX_H = 64;
const CLIP_ID = "hb-wordmark-ball-clip";

export function HandiBowlsWordmark({
  variant = "light",
  className,
  height = 40,
}: Props) {
  const fill = variant === "light" ? "var(--color-ink)" : "var(--color-ink-inverse)";
  const accent = "var(--color-primary-500)";
  const width = Math.round((height * VIEWBOX_W) / VIEWBOX_H);

  return (
    <svg
      aria-label="HandiBowls"
      role="img"
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      width={width}
      height={height}
      className={cn("block shrink-0 select-none", className)}
    >
      <defs>
        <clipPath id={CLIP_ID}>
          <circle cx="172" cy="28" r="22" />
        </clipPath>
      </defs>
      <text
        x="0"
        y="48"
        fontFamily="var(--font-display)"
        fontWeight={900}
        fontStyle="italic"
        fontSize="56"
        fill={fill}
        letterSpacing="-0.02em"
      >
        HANDI
      </text>
      <image
        href="/icons/icon-512.png"
        x="146"
        y="2"
        width="52"
        height="52"
        clipPath={`url(#${CLIP_ID})`}
        preserveAspectRatio="xMidYMid meet"
      />
      <text
        x="210"
        y="48"
        fontFamily="var(--font-display)"
        fontWeight={900}
        fontStyle="italic"
        fontSize="56"
        fill={accent}
        letterSpacing="-0.02em"
      >
        BOWLS
      </text>
    </svg>
  );
}
