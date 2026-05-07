// Phase 15 — co-brand bowl glyph speckle generator + per-concept cached
// datasets. Extracted from the design source `HandiBowls Co-Brand
// Glyph.html` byte-for-byte (algorithm + fixed seeds + avoidR /
// sizeMin / sizeMax constants). The design generates two distinct
// speckle datasets — Concept 2 (Knockout Disc, dense full-radius) and
// Concept 3 (Halo & Rest, fewer larger dots reserved clear of the
// disc area). Each dataset is computed once at module load and reused
// by every <Bowl /> render on the page. Per-render uniqueness comes
// from variant + size, not per-Bowl seeding.
//
// mulberry32 + hashSeed are re-exported from `lib/brand/presets.ts`
// where they were already canonical for SpeckleField / SplatterAccent
// / SpeckleRule. Keeping the primitives in one place avoids the
// "parallel implementations" trap.

import { hashSeed, mulberry32 } from "./presets";

export type SpeckleDot = {
  x: number;
  y: number;
  size: number;
  /** Either a literal hex from the design's input palette OR a CSS
   *  variable expression like `var(--color-speckle-a)`. The renderer
   *  passes the value through to the SVG `fill` attribute as-is. */
  color: string;
  shape: "dot" | "streak";
  angle: number;
  opacity: number;
};

export type GenerateSpecklesOpts = {
  seed: number;
  count: number;
  /** Outer disc radius in viewBox-100 units. */
  radius: number;
  /** Two-colour palette. The generator picks an index per dot
   *  uniformly at random, so the palette is conceptually unordered.
   *  Pass either literal hexes (deterministic colours, e.g. when
   *  pre-computing per-preset) or CSS-var sentinels like
   *  `var(--color-speckle-a)` (theme-driven at render time). */
  colors: readonly string[];
  /** Min dot radius (default 0.45 per design). */
  sizeMin?: number;
  /** Max dot radius (default 2.30 per design). */
  sizeMax?: number;
  /** Centre of the disc in viewBox-100 units. */
  cx?: number;
  cy?: number;
  /** Reserve a clear circle of radius `avoidR` around (cx, cy) so the
   *  central disc / Henselite mark stays uncluttered. 0 = no avoid
   *  (Concept 2 Knockout — disc covers speckle anyway).
   *  ~22 (Concept 3 Halo) — clears centre for a freestanding mark. */
  avoidR?: number;
};

// Generate a deterministic speckle field. Matches the design source's
// algorithm exactly: rejection-sampled point cloud inside the disc,
// optional inner-clearance, ~18% chance per dot of being a streak
// instead of a circle. The `attempts` cap (count × 4) protects against
// degenerate avoidR values eating the entire disc.
export function generateSpeckles(opts: GenerateSpecklesOpts): SpeckleDot[] {
  const {
    seed,
    count,
    radius,
    colors,
    sizeMin = 0.45,
    sizeMax = 2.3,
    cx = 50,
    cy = 50,
    avoidR = 0,
  } = opts;
  const rand = mulberry32(seed);
  const dots: SpeckleDot[] = [];
  let attempts = 0;
  const avoidR2 = avoidR * avoidR;
  while (dots.length < count && attempts < count * 4) {
    attempts++;
    const r = Math.sqrt(rand()) * radius * 0.96;
    const theta = rand() * Math.PI * 2;
    const x = cx + Math.cos(theta) * r;
    const y = cy + Math.sin(theta) * r;
    if (avoidR > 0) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < avoidR2) continue;
    }
    const size = sizeMin + rand() * (sizeMax - sizeMin);
    const colorIdx = Math.floor(rand() * colors.length);
    const shape: SpeckleDot["shape"] = rand() < 0.18 ? "streak" : "dot";
    const angle = rand() * 360;
    dots.push({
      x,
      y,
      size,
      color: colors[colorIdx],
      shape,
      angle,
      opacity: 0.55 + rand() * 0.45,
    });
  }
  return dots;
}

// Pre-computed per-concept datasets. Computed once at module load,
// reused by every Bowl render on the page. Colour palette is the CSS-
// variable sentinels — the renderer outputs them verbatim into the SVG
// `fill` attribute, where the active theme's `--color-speckle-a / -b`
// resolve at paint time.
const SPECKLE_PALETTE_VARS = [
  "var(--color-speckle-a)",
  "var(--color-speckle-b)",
] as const;

// Concept 2 — Knockout Disc. 240 dense dots across the full disc; the
// bone disc covers the centre at render time so no avoidR is needed.
export const SPECKLE_DATASET_KNOCKOUT: readonly SpeckleDot[] = generateSpeckles(
  {
    seed: hashSeed("c2-handi"),
    count: 240,
    radius: 48,
    colors: SPECKLE_PALETTE_VARS,
    avoidR: 0,
  },
);

// Concept 3 — Halo & Rest. 90 larger dots with a 22-unit clear ring
// around the centre so the freestanding Henselite mark and engraved
// halo read cleanly.
export const SPECKLE_DATASET_HALO: readonly SpeckleDot[] = generateSpeckles({
  seed: hashSeed("c3-handi"),
  count: 90,
  radius: 48,
  colors: SPECKLE_PALETTE_VARS,
  sizeMin: 0.8,
  sizeMax: 3.0,
  avoidR: 22,
});

// Per-preset deterministic variants. Used by surfaces that render a
// SPECIFIC preset regardless of the active CSS theme — theme picker
// swatches, splatter accents, the AdminSidebar foot bowl etc. The
// renderer substitutes the swatch's literal speckle hexes in place of
// the CSS-var sentinels.
export function withPresetColours(
  dots: readonly SpeckleDot[],
  speckleA: string,
  speckleB: string,
): SpeckleDot[] {
  return dots.map((d) => ({
    ...d,
    color: d.color === SPECKLE_PALETTE_VARS[0] ? speckleA : speckleB,
  }));
}

// Size-aware dot culling. At small render sizes, dense speckle becomes
// muddy noise — keep the largest ~ratio of dots, drop the rest. The
// floor of 8 dots prevents the field from collapsing to nothing on the
// 12-16 px favicon end of the scale. Matches the design's dotsSvg
// culling behaviour.
export function cullDotsForSize(
  dots: readonly SpeckleDot[],
  sizePx: number,
): SpeckleDot[] {
  const ratio = Math.max(0.18, Math.min(1, sizePx / 96));
  const sorted = [...dots].sort((a, b) => b.size - a.size);
  const keep = Math.max(8, Math.floor(sorted.length * ratio));
  return sorted.slice(0, keep);
}

export { hashSeed, mulberry32 };
