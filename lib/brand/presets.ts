import type { ThemePreset } from "@/components/brand/ThemeApplier";

// Canonical per-preset swatch values. Mirrors app/globals.css, which is the
// runtime source of truth via html[data-theme] CSS variables. This module
// exists so primitives that render a SPECIFIC preset regardless of the
// active theme (BowlChip, Bowl, Splatter, SpeckleField) can pull the right
// hex values deterministically.
//
// If app/globals.css preset blocks change, mirror the change here.

export type PresetSwatch = {
  id: ThemePreset;
  label: string;
  /** Primary body colour. Maps to --primary-500 at runtime. */
  base: string;
  /** Legible ink on top of base. Maps to --on-primary at runtime. */
  on: string;
  /** Two-colour speckle palette. Maps to --speckle-a, --speckle-b. */
  speckle: [string, string];
};

export const BOWL_PRESETS: readonly PresetSwatch[] = [
  { id: "atomic-red",    label: "Atomic Red",    base: "#D7261E", on: "#FFFFFF", speckle: ["#000000", "#FAFAF7"] },
  { id: "ocean-blue",    label: "Ocean Blue",    base: "#1E4DD8", on: "#FFFFFF", speckle: ["#3FB8AF", "#FAFAF7"] },
  { id: "sunburst",      label: "Sunburst",      base: "#F5B700", on: "#0A0A0A", speckle: ["#0A0A0A", "#0E7C7B"] },
  { id: "midnight",      label: "Midnight",      base: "#0E1B3D", on: "#FFFFFF", speckle: ["#D7261E", "#F5B700"] },
  { id: "ruby",          label: "Ruby",          base: "#C2185B", on: "#FFFFFF", speckle: ["#0A0A0A", "#FAFAF7"] },
  { id: "ocean-green",   label: "Ocean Green",   base: "#0E7C7B", on: "#FFFFFF", speckle: ["#3FB8AF", "#0A0A0A"] },
  { id: "grape",         label: "Grape",         base: "#6A1B9A", on: "#FFFFFF", speckle: ["#EC407A", "#FAFAF7"] },
  { id: "white-speckle", label: "White Speckle", base: "#F4F4F4", on: "#0A0A0A", speckle: ["#D7261E", "#1E4DD8"] },
  { id: "core-black",    label: "Core Black",    base: "#0A0A0A", on: "#FFFFFF", speckle: ["#D7261E", "#FAFAF7"] },
] as const;

export const PRESET_BY_ID: Record<ThemePreset, PresetSwatch> = Object.fromEntries(
  BOWL_PRESETS.map((p) => [p.id, p]),
) as Record<ThemePreset, PresetSwatch>;

// Phase 12.5 / 12.5-6 — splatter size tier. Resolves the
// `splatter-accent-size-tier-missing` drift entry. Pre-12.5-6 the
// shipped surfaces used unsanctioned literals (130, 170, 180, 240,
// 260, 300, 320). Three tiers anchored to the design source bundle's
// most-common admin uses (page-list / page-detail hero splatter at
// 300; secondary accents at 180; card-level accents at 130). All
// SplatterAccent consumers should pass `size={SPLATTER_SIZE.L}`
// instead of inline numbers.
//
//   S — card-level accents (~130) — booking cards, hero sub-rosettes
//   M — section / mid-card accents (~180) — list cards, profile bands
//   L — page-hero splatter (~300) — admin page hero, T20 list hero
export const SPLATTER_SIZE = { S: 130, M: 180, L: 300 } as const;
export type SplatterSize = keyof typeof SPLATTER_SIZE;

// Mulberry32 — tiny deterministic PRNG. Paired with hashSeed to turn any
// string/number seed into a stable pseudo-random stream.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(seed: string | number): number {
  if (typeof seed === "number") return Math.trunc(seed) >>> 0;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}
