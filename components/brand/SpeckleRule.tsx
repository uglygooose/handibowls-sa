import { cn } from "@/lib/utils";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import {
  PRESET_BY_ID,
  hashSeed,
  mulberry32,
  type PresetSwatch,
} from "@/lib/brand/presets";

// Horizontal row of preset speckle dots — a tiny decorative separator. Use
// between section headers or as a visual caption accent.

type Props = {
  preset: ThemePreset | PresetSwatch;
  width?: number;
  height?: number;
  dots?: number;
  className?: string;
};

function resolvePreset(p: ThemePreset | PresetSwatch): PresetSwatch {
  return typeof p === "string" ? PRESET_BY_ID[p] : p;
}

export function SpeckleRule({
  preset,
  width = 240,
  height = 18,
  dots = 40,
  className,
}: Props) {
  const p = resolvePreset(preset);
  const rand = mulberry32(hashSeed(`rule-${p.id}-${width}-${height}-${dots}`));
  const row = Array.from({ length: dots }, () => ({
    x: rand() * width,
    y: height / 2 + (rand() - 0.5) * (height - 4),
    r: 0.8 + rand() * 2.2,
    c: p.speckle[Math.floor(rand() * p.speckle.length)],
    o: 0.5 + rand() * 0.5,
  }));

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("block", className)}
    >
      {row.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity={d.o} />
      ))}
    </svg>
  );
}
