import { useId } from "react";

import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { PRESET_BY_ID } from "@/lib/brand/presets";
import {
  SPECKLE_DATASET_KNOCKOUT,
  cullDotsForSize,
  withPresetColours,
} from "@/lib/brand/speckle";
import { cn } from "@/lib/utils";

// Phase 15 (corrected) — speckled bowl glyph. The bowl IS the brand
// mark. Per-club theme drives the bowl base + speckle palette; the
// rendering is the same pre-Phase-15 dimensional speckled bowl across
// every size, with a single addition at large render sizes:
//
//   • size < 64 px → plain speckled bowl (active theme colour). No
//     mark, no disc, no ring. Used in TopBar, sidebar, /me + /play
//     avatars, BowlChip, theme-picker swatches.
//
//   • size ≥ 64 px → same speckled bowl + a centred Henselite-mark
//     image (~30% of bowl Ø, no disc behind it, sits directly on
//     the speckle). Used on landing hero, auth aside, T20 hero,
//     empty-state cards, design showcase.
//
// Theme behaviour:
//   • bowl base: `var(--color-primary-500)` by default (active CSS
//     theme), overridden to `BOWL_PRESETS[themeId].base` when the
//     `themeId` prop pins a specific preset (theme picker, decorative
//     variety bowls).
//   • speckle: `var(--color-speckle-a)` / `--speckle-b` per active
//     theme; resolved to literal hexes via `withPresetColours` when
//     `themeId` is set.
//   • shine + outer rim: theme-neutral.

const MARK_HREF = "/brand/henselite/mark-black.png";

// Threshold at which the Henselite mark overlay becomes visible.
// Below this, the bowl renders as plain speckle in active theme
// colour; consumers using compact lockups (TopBar, sidebar foot,
// theme-picker chips) sit in this band.
const MARK_THRESHOLD_PX = 64;

// Mark sizing in viewBox-100 units. ~30% of the 96-unit bowl Ø
// (rounded to a clean 30 box, centred on (50, 50) → x=y=35).
const MARK_INSET = 35;
const MARK_BOX = 30;

// Phase 15-fix: thin bone ring framing the mark on big bowls. Sits
// between the speckle field and the mark image — gives the mark a
// breath of separation from the textured bowl surface so it doesn't
// read as "stuck on" floating speckle.
const MARK_RING_R = 22;
const MARK_RING_STROKE = 0.8;
const MARK_RING_OPACITY = 0.55;

const SHINE_MIN_PX = 32;
const VIEWBOX_R = 48;

type Props = {
  size: number;
  /** Pin the bowl to a specific preset's swatch values (theme picker,
   *  decorative variety bowls). Without this, the bowl reads from
   *  active CSS theme via `--color-primary-500` + speckle vars. */
  themeId?: ThemePreset;
  className?: string;
  /** Defaults to "HandiBowls × Henselite". */
  ariaLabel?: string;
};

export function Bowl({
  size,
  themeId,
  className,
  ariaLabel = "HandiBowls × Henselite",
}: Props) {
  const reactId = useId();
  const clipId = `bowl-clip-${reactId}`;
  const shineId = `bowl-shine-${reactId}`;

  let bowlFill: string;
  let dotsSource;
  if (themeId) {
    const swatch = PRESET_BY_ID[themeId];
    bowlFill = swatch.base;
    const [a, b] = swatch.speckle;
    dotsSource = withPresetColours(SPECKLE_DATASET_KNOCKOUT, a, b);
  } else {
    bowlFill = "var(--color-primary-500)";
    dotsSource = SPECKLE_DATASET_KNOCKOUT;
  }

  const visibleDots = cullDotsForSize(dotsSource, size);
  const showShine = size >= SHINE_MIN_PX;
  const showMark = size >= MARK_THRESHOLD_PX;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("block select-none overflow-visible", className)}
    >
      <title>{ariaLabel}</title>
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r={VIEWBOX_R} />
        </clipPath>
        <radialGradient id={shineId} cx="32%" cy="26%" r="75%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="22%" stopColor="#FFFFFF" stopOpacity="0.18" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
        </radialGradient>
      </defs>

      {/* Bowl base */}
      <circle cx="50" cy="50" r={VIEWBOX_R} fill={bowlFill} />

      {/* Speckle field — clipped to the bowl disc */}
      {visibleDots.length > 0 && (
        <g clipPath={`url(#${clipId})`}>
          {visibleDots.map((d, i) =>
            d.shape === "streak" ? (
              <ellipse
                key={i}
                cx={Number(d.x.toFixed(2))}
                cy={Number(d.y.toFixed(2))}
                rx={Number((d.size * 1.6).toFixed(2))}
                ry={Number((d.size * 0.5).toFixed(2))}
                fill={d.color}
                opacity={Number(d.opacity.toFixed(2))}
                transform={`rotate(${d.angle.toFixed(1)} ${d.x.toFixed(2)} ${d.y.toFixed(2)})`}
              />
            ) : (
              <circle
                key={i}
                cx={Number(d.x.toFixed(2))}
                cy={Number(d.y.toFixed(2))}
                r={Number(d.size.toFixed(2))}
                fill={d.color}
                opacity={Number(d.opacity.toFixed(2))}
              />
            ),
          )}
        </g>
      )}

      {/* Engraved bone ring — ONLY at size ≥ 64. Frames the mark
          with a breath of separation from the speckle. Renders
          between the speckle layer and the mark image so the mark
          sits cleanly inside the ring. */}
      {showMark && (
        <circle
          cx="50"
          cy="50"
          r={MARK_RING_R}
          fill="none"
          stroke="#FAFAF7"
          strokeOpacity={MARK_RING_OPACITY}
          strokeWidth={MARK_RING_STROKE}
        />
      )}

      {/* Henselite mark — ONLY at size ≥ 64. Sits directly on the
          speckled bowl, no disc behind it. */}
      {showMark && (
        <image
          href={MARK_HREF}
          x={MARK_INSET}
          y={MARK_INSET}
          width={MARK_BOX}
          height={MARK_BOX}
          preserveAspectRatio="xMidYMid meet"
        />
      )}

      {/* Radial-gradient shine */}
      {showShine && (
        <circle cx="50" cy="50" r={VIEWBOX_R} fill={`url(#${shineId})`} />
      )}

      {/* Outer rim — depth cue */}
      <circle
        cx="50"
        cy="50"
        r={VIEWBOX_R}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.6"
      />
    </svg>
  );
}
