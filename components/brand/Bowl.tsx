import { useId } from "react";

import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { PRESET_BY_ID } from "@/lib/brand/presets";
import {
  SPECKLE_DATASET_HALO,
  SPECKLE_DATASET_KNOCKOUT,
  cullDotsForSize,
  withPresetColours,
  type SpeckleDot,
} from "@/lib/brand/speckle";
import { cn } from "@/lib/utils";

// Phase 15 — co-brand bowl glyph. The bowl IS the brand mark: a
// speckled per-club-themed bowl with a bone disc + the Henselite mark
// inset. Two visual variants per the design source `HandiBowls Co-Brand
// Glyph.html`:
//
//   • Concept 2 — Knockout Disc (size < 64)
//     Speckled bowl + bone disc covering the centre + Henselite mark.
//     No ring. Dense speckle (240 dots) reads as a textured bowl at
//     small chrome sizes — favicon, sidebar foot, BowlChip swatch.
//
//   • Concept 3 — Halo & Rest (size ≥ 64)
//     Speckled bowl with a 22-unit clear centre + thin engraved ring +
//     freestanding Henselite mark. Larger speckles (90 dots, sizes
//     0.8–3.0). Reads at hero / showcase scales.
//
// Variant crossover at 64 px happens automatically. Operator can force
// either variant via the `variant` prop.
//
// Theme behaviour:
//   • Bowl base = var(--color-primary-500) by default (theme-driven via
//     active `data-theme`). Overridden to a specific preset's hex via
//     the optional `themeId` prop — used by theme-picker swatches and
//     decorative cards that render a specific preset regardless of the
//     active theme.
//   • Disc = #FAFAF7 (bone) — fixed across all 9 presets.
//   • Henselite mark = black PNG (always — bone disc gives consistent
//     contrast across every bowl colour).
//   • Speckle = `var(--color-speckle-a)` / `--speckle-b` per active
//     theme; resolved to literal hexes when `themeId` is set.
//
//   • Mono tone (dark surfaces, e.g. inverted on admin chrome): bowl
//     base #FAFAF7, disc #0A0A0A, mark uses the white Henselite asset.
//     Speckle overrides to ink so dots stay visible on the bone bowl.
//
// All consumers go through this single component — no parallel
// implementations.

const VIEWBOX_R = 48;
const CX = 50;
const CY = 50;

const KNOCKOUT_DISC_R = 28;
const KNOCKOUT_MARK_INSET_R = 22;
const HALO_RING_R = 29;
const HALO_RING_STROKE_WIDTH = 0.8;
const HALO_MARK_INSET_R = 25;

// Per the design source: shine renders only on colour tone at ≥32 px,
// inner C2 ring + outer rim only on colour tone, halo ring only at
// ≥28 px, dot rendering thresholds at 24 px (knockout) / 22 px (halo).
const SHINE_MIN_PX = 32;
const HALO_RING_MIN_PX = 28;
const KNOCKOUT_DOTS_MIN_PX = 24;
const HALO_DOTS_MIN_PX = 22;

const AUTO_VARIANT_THRESHOLD_PX = 64;

const MARK_BLACK_HREF = "/brand/henselite/mark-black.png";
const MARK_WHITE_HREF = "/brand/henselite/mark-white.png";

const MONO_DOT_COLOUR = "#0A0A0A";

type BowlVariant = "auto" | "knockout" | "halo";
type BowlTone = "colour" | "mono";

type Props = {
  size: number;
  variant?: BowlVariant;
  tone?: BowlTone;
  /** Override the active CSS theme — pin the bowl base + speckle to a
   *  specific preset's swatch values regardless of `data-theme`. Used
   *  by theme-picker grids, BowlChip, decorative cards. */
  themeId?: ThemePreset;
  className?: string;
  /** Defaults to "HandiBowls × Henselite". Override for surfaces that
   *  want to advertise an active club preset (e.g. theme picker
   *  swatches read each preset's label out). */
  ariaLabel?: string;
};

export function Bowl({
  size,
  variant = "auto",
  tone = "colour",
  themeId,
  className,
  ariaLabel = "HandiBowls × Henselite",
}: Props) {
  const reactId = useId();
  const clipId = `bowl-clip-${reactId}`;
  const shineId = `bowl-shine-${reactId}`;

  const resolvedVariant: Exclude<BowlVariant, "auto"> =
    variant === "auto"
      ? size < AUTO_VARIANT_THRESHOLD_PX
        ? "knockout"
        : "halo"
      : variant;

  const isMono = tone === "mono";

  // Bowl base + speckle palette resolution.
  let bowlFill: string;
  let dotsSource: readonly SpeckleDot[];
  if (isMono) {
    bowlFill = "#FAFAF7";
    const base =
      resolvedVariant === "knockout"
        ? SPECKLE_DATASET_KNOCKOUT
        : SPECKLE_DATASET_HALO;
    dotsSource = base.map((d) => ({ ...d, color: MONO_DOT_COLOUR }));
  } else if (themeId) {
    const swatch = PRESET_BY_ID[themeId];
    bowlFill = swatch.base;
    const [a, b] = swatch.speckle;
    dotsSource =
      resolvedVariant === "knockout"
        ? withPresetColours(SPECKLE_DATASET_KNOCKOUT, a, b)
        : withPresetColours(SPECKLE_DATASET_HALO, a, b);
  } else {
    bowlFill = "var(--color-primary-500)";
    dotsSource =
      resolvedVariant === "knockout"
        ? SPECKLE_DATASET_KNOCKOUT
        : SPECKLE_DATASET_HALO;
  }

  const dotsMinPx =
    resolvedVariant === "knockout" ? KNOCKOUT_DOTS_MIN_PX : HALO_DOTS_MIN_PX;
  const visibleDots =
    size >= dotsMinPx ? cullDotsForSize(dotsSource, size) : [];

  const useShine = !isMono && size >= SHINE_MIN_PX;
  const showHaloRing = resolvedVariant === "halo" && size >= HALO_RING_MIN_PX;

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
          <circle cx={CX} cy={CY} r={VIEWBOX_R} />
        </clipPath>
        <radialGradient id={shineId} cx="32%" cy="26%" r="75%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="22%" stopColor="#FFFFFF" stopOpacity="0.18" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
        </radialGradient>
      </defs>

      {/* Bowl base */}
      <circle cx={CX} cy={CY} r={VIEWBOX_R} fill={bowlFill} />

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

      {resolvedVariant === "knockout" ? (
        <>
          {/* Bone disc covers the speckle centre */}
          <circle
            cx={CX}
            cy={CY}
            r={KNOCKOUT_DISC_R}
            fill={isMono ? "#0A0A0A" : "#FAFAF7"}
          />
          {!isMono && (
            <circle
              cx={CX}
              cy={CY}
              r={KNOCKOUT_DISC_R}
              fill="none"
              stroke="rgba(0,0,0,0.18)"
              strokeWidth="0.4"
            />
          )}
          {/* Henselite mark — knockout uses the inset-22 area inside the
              disc (44×44 box centred at 50,50) */}
          <image
            href={isMono ? MARK_WHITE_HREF : MARK_BLACK_HREF}
            x={CX - KNOCKOUT_MARK_INSET_R}
            y={CY - KNOCKOUT_MARK_INSET_R}
            width={KNOCKOUT_MARK_INSET_R * 2}
            height={KNOCKOUT_MARK_INSET_R * 2}
            preserveAspectRatio="xMidYMid meet"
          />
        </>
      ) : (
        <>
          {/* Halo ring — engraved into the bowl surface, not the disc */}
          {showHaloRing && (
            <circle
              cx={CX}
              cy={CY}
              r={HALO_RING_R}
              fill="none"
              stroke={isMono ? "#0A0A0A" : "#FAFAF7"}
              strokeOpacity={isMono ? 0.35 : 0.55}
              strokeWidth={HALO_RING_STROKE_WIDTH}
            />
          )}
          {/* Henselite mark — halo uses the larger inset-25 area
              (50×50 box centred at 50,50). Rests on the bowl directly,
              no disc behind. */}
          <image
            href={isMono ? MARK_WHITE_HREF : MARK_BLACK_HREF}
            x={CX - HALO_MARK_INSET_R}
            y={CY - HALO_MARK_INSET_R}
            width={HALO_MARK_INSET_R * 2}
            height={HALO_MARK_INSET_R * 2}
            preserveAspectRatio="xMidYMid meet"
          />
        </>
      )}

      {/* Radial-gradient shine — only on colour tone at ≥32 px */}
      {useShine && (
        <circle cx={CX} cy={CY} r={VIEWBOX_R} fill={`url(#${shineId})`} />
      )}

      {/* Outer rim — only on colour tone */}
      {!isMono && (
        <circle
          cx={CX}
          cy={CY}
          r={VIEWBOX_R}
          fill="none"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="0.6"
        />
      )}
    </svg>
  );
}
