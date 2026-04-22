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

type Props = {
  preset: ThemePreset | PresetSwatch;
  width?: number | string;
  height?: number | string;
  density?: number;
  opacityScale?: number;
  borderRadius?: number;
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
  density = 1,
  opacityScale = 1,
  borderRadius = 20,
  className,
  style,
}: Props) {
  const p = resolvePreset(preset);
  const scale = 120;
  const patternId = `speckle-field-${p.id}-${density}-${opacityScale}`;
  const dots = generatePatternDots(patternId, p.speckle, density, opacityScale, scale);

  const isFluid = typeof width !== "number" || typeof height !== "number";

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={typeof width === "number" && typeof height === "number" ? `0 0 ${width} ${height}` : `0 0 ${scale * 4} ${scale * 2}`}
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
