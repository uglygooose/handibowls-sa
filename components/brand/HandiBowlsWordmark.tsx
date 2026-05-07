import { cn } from "@/lib/utils";

type Props = {
  variant?: "light" | "dark";
  className?: string;
  height?: number;
};

// SVG layout (viewBox 0 0 360 64):
//   HANDI text  : x = 0   .. ~140
//   BOWLS text  : x = 162 .. ~315 (natural italic spacing — unchanged)
//   ball mark   : 58×58 image at (122, 0); clipped disc cx=151 cy=29 r=25
//
// Ball disc diameter ≈ 50px ≈ 1.25× the wordmark cap height (≈ 40px at
// fontSize 56). The disc straddles the gap, overlapping HANDI's "I"
// (~127..140) and BOWLS' "B" (~162..175). z-order: ball is the last
// child, so it renders on top of both text elements — the overlap
// reads as "mark sits in front of wordmark", not as clipping.
//
// Source raster /public/icons/icon-512.png bakes a dark rounded-square
// app-icon frame (richSvg `bg = INK` default in scripts/gen-pwa-icons.mjs);
// the clipPath circle hides the frame and shows only the speckled disc.
// Disc geometry inside the source PNG: cx/cy = 50,50 r = 42 in a 100-unit
// viewBox → at 58px render size the disc maps to centre (29,29) r ≈ 24.4.
// Clip r = 25 leaves a sub-px antialias buffer.
const VIEWBOX_W = 360;
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
          <circle cx="151" cy="29" r="25" />
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
      <text
        x="162"
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
      <image
        href="/icons/icon-512.png"
        x="122"
        y="0"
        width="58"
        height="58"
        clipPath={`url(#${CLIP_ID})`}
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}
