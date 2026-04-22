import { cn } from "@/lib/utils";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import {
  PRESET_BY_ID,
  hashSeed,
  mulberry32,
  type PresetSwatch,
} from "@/lib/brand/presets";

// Hand-massaged irregular paint-splatter blob with drips and outlying dots.
// Three curated variants; pick one with `variant`. Rendered as a preset-tinted
// path + a tiny dot pepper clipped to the blob for texture.
//
// Use as a corner accent — never as a full background. Absolute-positioned
// via caller (left/top/rotate handled outside).

type Props = {
  preset: ThemePreset | PresetSwatch;
  variant?: 0 | 1 | 2;
  size?: number;
  rotate?: number;
  className?: string;
  style?: React.CSSProperties;
};

const SPLATTERS: ReadonlyArray<{
  blob: string;
  drips: string[];
  dots: ReadonlyArray<readonly [number, number, number]>;
}> = [
  {
    blob: "M 100 30 C 150 18, 182 48, 178 92 C 178 128, 152 160, 118 164 C 84 168, 48 152, 38 118 C 30 90, 44 60, 74 46 C 84 42, 92 34, 100 30 Z",
    drips: [
      "M 168 74 C 178 72, 188 82, 186 96 C 185 104, 178 110, 172 106 C 166 102, 164 92, 168 74 Z",
      "M 46 140 C 40 150, 46 162, 58 164 C 64 165, 70 158, 66 150 C 62 144, 52 142, 46 140 Z",
      "M 140 170 C 150 178, 150 188, 140 188 C 134 188, 132 180, 140 170 Z",
    ],
    dots: [[188, 50, 4], [30, 70, 3], [170, 170, 2.4], [60, 30, 2], [18, 110, 1.8]],
  },
  {
    blob: "M 90 40 C 140 20, 180 50, 180 94 C 182 134, 150 158, 110 162 C 78 164, 48 146, 42 118 C 34 86, 52 58, 80 48 C 84 46, 88 42, 90 40 Z",
    drips: [
      "M 44 58 C 36 56, 28 62, 28 72 C 28 80, 36 82, 42 78 C 50 72, 48 62, 44 58 Z",
      "M 178 130 C 188 130, 194 140, 188 152 C 184 158, 176 158, 172 150 C 168 140, 172 132, 178 130 Z",
      "M 98 176 C 104 186, 100 194, 92 192 C 86 190, 86 180, 98 176 Z",
    ],
    dots: [[20, 30, 3.2], [182, 44, 2.4], [150, 188, 2.8], [30, 160, 2], [190, 80, 1.6]],
  },
  {
    blob: "M 110 36 C 156 32, 184 62, 180 110 C 176 150, 140 172, 98 170 C 58 168, 30 142, 34 104 C 38 72, 66 48, 100 40 C 104 38, 108 36, 110 36 Z",
    drips: [
      "M 36 80 C 24 74, 16 84, 22 96 C 28 106, 38 104, 40 92 C 40 86, 38 82, 36 80 Z",
      "M 160 34 C 172 28, 182 38, 176 50 C 170 58, 160 56, 156 46 C 154 40, 156 36, 160 34 Z",
      "M 70 182 C 60 188, 62 198, 74 196 C 82 194, 82 184, 70 182 Z",
    ],
    dots: [[180, 140, 3], [20, 40, 2.4], [100, 188, 2], [186, 188, 1.8], [8, 140, 1.6]],
  },
];

function resolvePreset(p: ThemePreset | PresetSwatch): PresetSwatch {
  return typeof p === "string" ? PRESET_BY_ID[p] : p;
}

export function SplatterAccent({
  preset,
  variant = 0,
  size = 280,
  rotate = 0,
  className,
  style,
}: Props) {
  const p = resolvePreset(preset);
  const s = SPLATTERS[variant % SPLATTERS.length];
  const clipId = `splat-clip-${p.id}-${variant}`;
  const seed = hashSeed(`splat-${p.id}-${variant}`);
  const rand = mulberry32(seed);

  const tinyDots = Array.from({ length: 50 }, () => ({
    x: 20 + rand() * 160,
    y: 20 + rand() * 160,
    r: 0.4 + rand() * 1.6,
    c: p.speckle[Math.floor(rand() * p.speckle.length)],
    o: 0.55 + rand() * 0.4,
  }));

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={cn("pointer-events-none", className)}
      style={{ transform: `rotate(${rotate}deg)`, ...style }}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={s.blob} />
        </clipPath>
      </defs>
      <path d={s.blob} fill={p.base} />
      <g clipPath={`url(#${clipId})`}>
        {tinyDots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity={d.o} />
        ))}
      </g>
      {s.drips.map((d, i) => (
        <path key={i} d={d} fill={p.base} />
      ))}
      {s.dots.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={p.base} />
      ))}
    </svg>
  );
}
