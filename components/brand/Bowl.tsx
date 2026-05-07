import { useId } from "react";

import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { PRESET_BY_ID } from "@/lib/brand/presets";
import {
  SPECKLE_DATASET_KNOCKOUT,
  cullDotsForSize,
  withPresetColours,
} from "@/lib/brand/speckle";
import { cn } from "@/lib/utils";

// Phase 15 (final scope) — speckled bowl glyph. The bowl IS the brand
// mark. Per-club theme drives the bowl base + speckle palette; the
// rendering is the same dimensional speckled bowl across every render
// size, with the engraved jack-target emblem (rings + cross + centre
// dot) restored on big bowls per operator preference.
//
// Each bowl renders:
//   • bowl base circle in active theme colour (or pinned via themeId)
//   • speckle field clipped to the bowl, theme-driven palette
//   • engraved jack-target emblem at sizes ≥ 64 px (rings r=14 + r=9
//     + 4 cross lines + centre dot, in the preset's `on` colour —
//     reads as black on ocean-green/sunburst/white-speckle, white on
//     the rest)
//   • radial-gradient shine on top at sizes ≥ 32 px (omitted at small
//     icon sizes where the gradient becomes single-pixel noise)
//   • outer rim stroke for depth
//
// Use the `<HenseliteLogo />` component for explicit Henselite
// branding on surface chrome (top bars, footer attribution); the Bowl
// alone IS the HandiBowls mark.

const SHINE_MIN_PX = 32;
const EMBLEM_MIN_PX = 64;
const VIEWBOX_R = 48;

type Props = {
  size: number;
  /** Pin the bowl to a specific preset's swatch values (theme picker,
   *  decorative variety bowls, brand-stable surfaces like the
   *  unauthenticated landing where CSS-var cascade timing is
   *  unreliable). Without this, the bowl reads from active CSS theme
   *  via `--color-primary-500` + speckle vars. */
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
  let emblemColour: string;
  let dotsSource;
  if (themeId) {
    const swatch = PRESET_BY_ID[themeId];
    bowlFill = swatch.base;
    emblemColour = swatch.on;
    const [a, b] = swatch.speckle;
    dotsSource = withPresetColours(SPECKLE_DATASET_KNOCKOUT, a, b);
  } else {
    bowlFill = "var(--color-primary-500)";
    emblemColour = "var(--color-on-primary)";
    dotsSource = SPECKLE_DATASET_KNOCKOUT;
  }

  const visibleDots = cullDotsForSize(dotsSource, size);
  const showShine = size >= SHINE_MIN_PX;
  const showEmblem = size >= EMBLEM_MIN_PX;

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

      {/* Engraved jack-target emblem — only on big decorative bowls
          (size ≥ 64 px). Outer ring r=14 + inner ring r=9 + centre
          dot r=2.5 + 4 cross lines connecting the two rings. Rendered
          in the preset's `on` colour so it contrasts the bowl base
          (ink on ocean-green/sunburst/white-speckle, white on the
          rest). Group opacity 0.85 + per-element opacities give the
          target an "engraved into the bowl surface" look. */}
      {showEmblem && (
        <g clipPath={`url(#${clipId})`} opacity="0.85">
          <circle
            cx="50"
            cy="50"
            r="14"
            fill="none"
            stroke={emblemColour}
            strokeOpacity="0.55"
            strokeWidth="0.6"
          />
          <circle
            cx="50"
            cy="50"
            r="9"
            fill="none"
            stroke={emblemColour}
            strokeOpacity="0.35"
            strokeWidth="0.5"
          />
          <circle cx="50" cy="50" r="2.5" fill={emblemColour} fillOpacity="0.75" />
          {[0, 90, 180, 270].map((a) => (
            <line
              key={a}
              x1="50"
              y1={50 - 14}
              x2="50"
              y2={50 - 9}
              stroke={emblemColour}
              strokeOpacity="0.5"
              strokeWidth="0.7"
              transform={`rotate(${a} 50 50)`}
            />
          ))}
        </g>
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
