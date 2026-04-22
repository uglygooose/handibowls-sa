import { cn } from "@/lib/utils";

type Corner = "tl" | "tr" | "bl" | "br";

type Props = {
  seed?: string | number;
  corner?: Corner;
  blobs?: 1 | 2 | 3;
  opacity?: number;
  className?: string;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string | number): number {
  if (typeof seed === "number") return Math.trunc(seed);
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const CORNER_ORIGIN: Record<Corner, { ox: number; oy: number }> = {
  tl: { ox: 0, oy: 0 },
  tr: { ox: 100, oy: 0 },
  bl: { ox: 0, oy: 100 },
  br: { ox: 100, oy: 100 },
};

export function SplatterAccent({
  seed = "splatter",
  corner = "tr",
  blobs = 2,
  opacity = 0.9,
  className,
}: Props) {
  const rand = mulberry32(hashSeed(seed));
  const origin = CORNER_ORIGIN[corner];

  const shapes = Array.from({ length: blobs }, (_, i) => {
    const spread = 14 + rand() * 10;
    const cx = origin.ox + (rand() - 0.5) * spread;
    const cy = origin.oy + (rand() - 0.5) * spread;
    const rx = 8 + rand() * 6;
    const ry = 6 + rand() * 6;
    const useA = i === 0 || rand() < 0.5;
    // 2–4 drip tails per blob
    const drips = Array.from(
      { length: 2 + Math.floor(rand() * 3) },
      () => {
        const angle = rand() * Math.PI * 2;
        const dist = rx * (0.8 + rand() * 0.9);
        return {
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          r: 0.8 + rand() * 1.8,
        };
      },
    );
    return { cx, cy, rx, ry, useA, drips, key: i };
  });

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full",
        className,
      )}
      style={{ opacity }}
    >
      {shapes.map((s) => (
        <g key={s.key}>
          <ellipse
            cx={s.cx}
            cy={s.cy}
            rx={s.rx}
            ry={s.ry}
            fill={s.useA ? "var(--color-speckle-a)" : "var(--color-speckle-b)"}
          />
          {s.drips.map((d, di) => (
            <circle
              key={di}
              cx={d.x}
              cy={d.y}
              r={d.r}
              fill={s.useA ? "var(--color-speckle-a)" : "var(--color-speckle-b)"}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
