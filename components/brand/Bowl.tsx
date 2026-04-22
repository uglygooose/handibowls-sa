import { cn } from "@/lib/utils";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import {
  PRESET_BY_ID,
  hashSeed,
  mulberry32,
  type PresetSwatch,
} from "@/lib/brand/presets";

// Dimensional speckled bowl. SVG-only, SSR-safe. 260 deterministic speckles
// inside a clipped circle, a radial-gradient shine on top, an engraved-emblem
// target ring, and a thin rim. Pass `preset` (ThemePreset id) or a PresetSwatch
// directly. `idSuffix` lets multiple bowls on the same page have unique
// gradient/clip ids and different speckle seeds.

type Props = {
  preset: ThemePreset | PresetSwatch;
  size?: number;
  seed?: string | number;
  emblem?: boolean;
  idSuffix?: string;
  className?: string;
};

type Speckle = {
  x: number;
  y: number;
  size: number;
  color: string;
  shape: "dot" | "streak";
  angle: number;
  opacity: number;
};

function resolvePreset(p: ThemePreset | PresetSwatch): PresetSwatch {
  return typeof p === "string" ? PRESET_BY_ID[p] : p;
}

function generateSpeckles(
  seedNum: number,
  colors: readonly string[],
  radius: number,
  cx: number,
  cy: number,
): Speckle[] {
  const rand = mulberry32(seedNum);
  const dots: Speckle[] = [];
  for (let i = 0; i < 260; i++) {
    const r = Math.sqrt(rand()) * radius * 0.96;
    const theta = rand() * Math.PI * 2;
    const x = cx + Math.cos(theta) * r;
    const y = cy + Math.sin(theta) * r;
    const size = 0.45 + rand() * (2.3 - 0.45);
    const colorIdx = Math.floor(rand() * colors.length);
    const shape: Speckle["shape"] = rand() < 0.18 ? "streak" : "dot";
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

export function Bowl({
  preset,
  size = 220,
  seed,
  emblem = true,
  idSuffix = "",
  className,
}: Props) {
  const p = resolvePreset(preset);
  const R = 48;
  const cx = 50;
  const cy = 50;
  const seedNum = seed != null ? hashSeed(seed) : hashSeed(p.id + idSuffix);
  const dots = generateSpeckles(seedNum, p.speckle, R, cx, cy);

  const gradId = `bowl-shine-${p.id}-${idSuffix}`;
  const clipId = `bowl-clip-${p.id}-${idSuffix}`;

  return (
    <svg
      aria-label={p.label}
      role="img"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("block select-none overflow-visible", className)}
    >
      <title>{p.label}</title>
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={R} />
        </clipPath>
        <radialGradient id={gradId} cx="32%" cy="26%" r="75%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="22%" stopColor="#FFFFFF" stopOpacity="0.18" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r={R} fill={p.base} />

      <g clipPath={`url(#${clipId})`}>
        {dots.map((d, i) =>
          d.shape === "streak" ? (
            <ellipse
              key={i}
              cx={d.x}
              cy={d.y}
              rx={d.size * 1.6}
              ry={d.size * 0.5}
              fill={d.color}
              opacity={d.opacity}
              transform={`rotate(${d.angle} ${d.x} ${d.y})`}
            />
          ) : (
            <circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={d.size}
              fill={d.color}
              opacity={d.opacity}
            />
          ),
        )}
      </g>

      {emblem && (
        <g clipPath={`url(#${clipId})`} opacity="0.85">
          <circle
            cx={cx}
            cy={cy}
            r="14"
            fill="none"
            stroke={p.on}
            strokeOpacity="0.55"
            strokeWidth="0.6"
          />
          <circle
            cx={cx}
            cy={cy}
            r="9"
            fill="none"
            stroke={p.on}
            strokeOpacity="0.35"
            strokeWidth="0.5"
          />
          <circle cx={cx} cy={cy} r="2.5" fill={p.on} fillOpacity="0.75" />
          {[0, 90, 180, 270].map((a) => (
            <line
              key={a}
              x1={cx}
              y1={cy - 14}
              x2={cx}
              y2={cy - 9}
              stroke={p.on}
              strokeOpacity="0.5"
              strokeWidth="0.7"
              transform={`rotate(${a} ${cx} ${cy})`}
            />
          ))}
        </g>
      )}

      <circle cx={cx} cy={cy} r={R} fill={`url(#${gradId})`} />
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.6"
      />
      <circle
        cx={cx}
        cy={cy}
        r={R - 0.5}
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.3"
      />
    </svg>
  );
}
