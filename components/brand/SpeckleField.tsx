import { cn } from "@/lib/utils";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import {
  PRESET_BY_ID,
  hashSeed,
  mulberry32,
  type PresetSwatch,
} from "@/lib/brand/presets";

// Preset-tinted rectangle with a speckle overlay. Use for card headers,
// hero bands, and any place where we want a solid coloured surface with
// speckle texture baked in. Unlike SpeckleLayer, this ships its own
// background — drop it in as a child, don't absolute-position over something.
//
// If width/height are numbers, renders at that pixel size. Otherwise the
// SVG stretches to its container (preserveAspectRatio=none).
//
// Phase 12.5 / 12.5-2 audit closures:
//
//   `speckle-seed` — `seedKey?: string` prop now folds into the
//   pattern id. Two adjacent cards with the same preset render
//   distinct dot fields when each passes a unique seedKey. Required
//   for non-fluid (explicit-pixel-dimension) renders per the
//   12.5-prep locked decision; a dev-only console.warn fires when a
//   non-fluid render omits it.
//
//   `speckle-intensity-step` — three named intensities replace
//   inline density/opacityScale numbers across consumers:
//     subtle  →  density 1.0 · opacityScale 1.0
//     medium  →  density 1.2 · opacityScale 1.2
//     bold    →  density 1.3 · opacityScale 1.4
//   Explicit numeric `density` / `opacityScale` props take
//   precedence over `intensity` (with a dev-only warn) so existing
//   per-call-site fine-tuning still works. Once consumers settle on
//   named intensities the explicit overrides can be retired.

const INTENSITY_MAP: Record<
  "subtle" | "medium" | "bold",
  { density: number; opacityScale: number }
> = {
  subtle: { density: 1.0, opacityScale: 1.0 },
  medium: { density: 1.2, opacityScale: 1.2 },
  bold: { density: 1.3, opacityScale: 1.4 },
};

export type SpeckleIntensity = keyof typeof INTENSITY_MAP;

type Props = {
  preset: ThemePreset | PresetSwatch;
  width?: number | string;
  height?: number | string;
  /**
   * Named intensity — preferred over explicit density / opacityScale.
   * Maps to (density, opacityScale) pairs codified in INTENSITY_MAP
   * (subtle 1.0/1.0, medium 1.2/1.2, bold 1.3/1.4). Per the audit
   * `speckle-intensity-step`, every consumer should pick a name; ad-hoc
   * numeric props are tolerated but flagged in dev.
   */
  intensity?: SpeckleIntensity;
  density?: number;
  opacityScale?: number;
  borderRadius?: number;
  /**
   * Per-render seed for the dot field. Two adjacent SpeckleFields with
   * the same preset render distinct dot patterns when given distinct
   * seedKey values. **Required for non-fluid (explicit-pixel-dimension)
   * renders** — at fixed sizes, missing a seedKey makes the same dot
   * field show up everywhere; dev mode logs a warning. Fluid (`%`) sizes
   * stretch over the container so identical seeds are usually
   * unobjectionable, but unique seedKeys are still recommended for
   * any list/grid where multiple SpeckleFields share a preset.
   */
  seedKey?: string;
  className?: string;
  style?: React.CSSProperties;
};

type Dot = { x: number; y: number; r: number; c: string; o: number };

function resolvePreset(p: ThemePreset | PresetSwatch): PresetSwatch {
  return typeof p === "string" ? PRESET_BY_ID[p] : p;
}

function generatePatternDots(
  id: string,
  colors: readonly string[],
  density: number,
  opacityScale: number,
  scale: number,
): Dot[] {
  const rand = mulberry32(hashSeed(id));
  const n = Math.floor(70 * density);
  const out: Dot[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: rand() * scale,
      y: rand() * scale,
      r: 0.6 + rand() * 2.4,
      c: colors[Math.floor(rand() * colors.length)],
      o: (0.35 + rand() * 0.5) * opacityScale,
    });
  }
  return out;
}

export function SpeckleField({
  preset,
  width = "100%",
  height = 140,
  intensity,
  density,
  opacityScale,
  borderRadius = 20,
  seedKey,
  className,
  style,
}: Props) {
  // Intensity resolution: named intensity sets the defaults; explicit
  // numeric props take precedence with a dev warn so the override
  // intent is visible during refactor.
  const named = intensity ? INTENSITY_MAP[intensity] : null;
  const resolvedDensity = density ?? named?.density ?? 1;
  const resolvedOpacityScale = opacityScale ?? named?.opacityScale ?? 1;

  if (process.env.NODE_ENV !== "production") {
    if (intensity && (density != null || opacityScale != null)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[SpeckleField] intensity="${intensity}" was provided alongside explicit density/opacityScale; the explicit values win. Pick one form.`,
      );
    }
  }

  const p = resolvePreset(preset);
  const scale = 120;
  const patternId = `speckle-field-${p.id}-${resolvedDensity}-${resolvedOpacityScale}-${seedKey ?? "default"}`;
  const dots = generatePatternDots(
    patternId,
    p.speckle,
    resolvedDensity,
    resolvedOpacityScale,
    scale,
  );

  const isFluid = typeof width !== "number" || typeof height !== "number";

  if (process.env.NODE_ENV !== "production") {
    if (!isFluid && !seedKey) {
      // eslint-disable-next-line no-console
      console.warn(
        `[SpeckleField] non-fluid render (width=${width}, height=${height}) is missing seedKey — adjacent same-preset cards will share a pattern. Pass a unique seedKey per visual region.`,
      );
    }
  }

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={
        typeof width === "number" && typeof height === "number"
          ? `0 0 ${width} ${height}`
          : `0 0 ${scale * 4} ${scale * 2}`
      }
      preserveAspectRatio={isFluid ? "none" : "xMidYMid meet"}
      className={cn("block", className)}
      style={{ borderRadius, ...style }}
    >
      <defs>
        <pattern id={patternId} width={scale} height={scale} patternUnits="userSpaceOnUse">
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity={d.o} />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" rx={borderRadius} fill={p.base} />
      <rect width="100%" height="100%" rx={borderRadius} fill={`url(#${patternId})`} />
    </svg>
  );
}
