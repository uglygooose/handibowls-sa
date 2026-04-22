import { cn } from "@/lib/utils";

export type SpeckleDensity = "low" | "med" | "high";

type Props = {
  seed?: string | number;
  density?: SpeckleDensity;
  opacity?: number;
  className?: string;
};

const DENSITY_COUNT: Record<SpeckleDensity, number> = {
  low: 60,
  med: 90,
  high: 120,
};

// Mulberry32 PRNG — tiny, deterministic, good enough for visual noise.
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

export function SpeckleLayer({
  seed = "handibowls",
  density = "med",
  opacity = 0.08,
  className,
}: Props) {
  const count = DENSITY_COUNT[density];
  const rand = mulberry32(hashSeed(seed));

  const circles = Array.from({ length: count }, (_, i) => {
    const cx = rand() * 100;
    const cy = rand() * 100;
    const r = 0.4 + rand() * 1.6;
    const useA = rand() < 0.55;
    return { cx, cy, r, useA, key: i };
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
      {circles.map((c) => (
        <circle
          key={c.key}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          fill={c.useA ? "var(--color-speckle-a)" : "var(--color-speckle-b)"}
        />
      ))}
    </svg>
  );
}
