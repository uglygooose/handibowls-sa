"use client";

import { useMemo } from "react";

import { ZONE_IDS, ZONE_META, type ZoneOutcome } from "@/lib/t20/rubric";

// Phase 10 — iconic Twenty 20 compass rose for zones_8 sections
// (Drive, Control, Trail). 8 wedges numbered 1–8 with Front / Wide /
// Back + Centre / Left / Right labels around the perimeter.
//
// Geometry verbatim from the design source — wedge 1 (Front Centre)
// at 12 o'clock spanning -22.5° to +22.5°, then 45° wedges clockwise
// (1 FC, 2 FR, 3 WR, 4 BR, 5 BC, 6 BL, 7 WL, 8 FL). The inner radius
// (rInner=8) leaves room for the centre jack disc + a radial gradient
// "shine" for visual depth.
//
// Two modes:
//   default        interactive — onPick fires on wedge tap; pulse ring
//                  animates on selection.
//   readOnly       render-only — drives CompassHeatmap. Pass an
//                  `intensities` map (zone → 0..1 normalised) and each
//                  wedge fills proportionally with primary-500.
//
// Density preserved: 6.6 Barlow Black for zone numbers, 3.4 JetBrains
// Mono for the zone-points pip, 4 Barlow Caps for the cardinal labels.
// Per the brief's "do not soften" — the iconic compass is the visual
// anchor of the assessment and must not be diluted.
//
// The `<title>` on each wedge serves the assessor's hover (desktop) +
// the screen-reader announcement (a11y) — "Zone 1 · Front · Centre · 8pt".

const CX = 50;
const CY = 50;
const R_OUTER = 46;
const R_INNER = 8;
const START_DEG = -90 - 22.5; // wedge 1 starts here (top-centre +/- 22.5°)
const WEDGE_SIZE = 45;

type Props = {
  size?: number;
  /** Currently selected zone (1..8). null when nothing or 'miss' is selected. */
  value?: Exclude<ZoneOutcome, "miss"> | null;
  onPick?: (zone: Exclude<ZoneOutcome, "miss">) => void;
  /** Hand badge under the compass — 'forehand' / 'backhand' / null to hide. */
  hand?: "forehand" | "backhand" | null;
  /** When true, disables onPick + tap targets; renders heatmap fills via `intensities`. */
  readOnly?: boolean;
  /** Zone (1..8) → 0..1 normalised fill intensity. Only honoured when readOnly. */
  intensities?: Partial<Record<Exclude<ZoneOutcome, "miss">, number>>;
  /** Per-zone point values for the pip. Defaults to v1 rubric values. */
  zonePoints?: Record<Exclude<ZoneOutcome, "miss">, number>;
};

const DEFAULT_ZONE_POINTS: Record<Exclude<ZoneOutcome, "miss">, number> = {
  1: 8,
  2: 5,
  3: 2,
  4: 4,
  5: 6,
  6: 4,
  7: 2,
  8: 5,
};

function wedgePath(i: number): string {
  const a0 = ((START_DEG + i * WEDGE_SIZE) * Math.PI) / 180;
  const a1 = ((START_DEG + (i + 1) * WEDGE_SIZE) * Math.PI) / 180;
  const x0 = CX + Math.cos(a0) * R_OUTER;
  const y0 = CY + Math.sin(a0) * R_OUTER;
  const x1 = CX + Math.cos(a1) * R_OUTER;
  const y1 = CY + Math.sin(a1) * R_OUTER;
  const xi0 = CX + Math.cos(a0) * R_INNER;
  const yi0 = CY + Math.sin(a0) * R_INNER;
  const xi1 = CX + Math.cos(a1) * R_INNER;
  const yi1 = CY + Math.sin(a1) * R_INNER;
  return `M ${xi0} ${yi0} L ${x0} ${y0} A ${R_OUTER} ${R_OUTER} 0 0 1 ${x1} ${y1} L ${xi1} ${yi1} A ${R_INNER} ${R_INNER} 0 0 0 ${xi0} ${yi0} Z`;
}

function labelPos(i: number, r = 30): { x: number; y: number } {
  const a = ((START_DEG + (i + 0.5) * WEDGE_SIZE) * Math.PI) / 180;
  return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r };
}

// Mulberry32 PRNG — same algorithm the design source uses for
// deterministic per-wedge speckle dots (so SSR/CSR markup matches
// and snapshot tests stay stable).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SpeckleDot = { x: number; y: number; s: number; a: boolean };

function speckleDotsForWedge(i: number): SpeckleDot[] {
  const r = mulberry32(0x517 + i * 91);
  const dots: SpeckleDot[] = [];
  const a0 = START_DEG + i * WEDGE_SIZE;
  const a1 = START_DEG + (i + 1) * WEDGE_SIZE;
  for (let k = 0; k < 18; k++) {
    const ang = ((a0 + r() * (a1 - a0)) * Math.PI) / 180;
    const rad = R_INNER + 1.5 + r() * (R_OUTER - R_INNER - 4);
    dots.push({
      x: CX + Math.cos(ang) * rad,
      y: CY + Math.sin(ang) * rad,
      s: 0.35 + r() * 1.0,
      a: r() < 0.55,
    });
  }
  return dots;
}

export function CompassPicker({
  size = 360,
  value = null,
  onPick,
  hand = "forehand",
  readOnly = false,
  intensities = {},
  zonePoints = DEFAULT_ZONE_POINTS,
}: Props) {
  // Pre-bake speckle dots once. Same seed for every render — output
  // is deterministic and SSR-stable.
  const wedgeDots = useMemo(
    () => ZONE_IDS.map((_, i) => speckleDotsForWedge(i)),
    [],
  );

  return (
    <div
      data-slot="compass-picker"
      data-readonly={readOnly}
      className="inline-flex flex-col items-center"
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role={readOnly ? "img" : "group"}
        aria-label={
          readOnly
            ? "Twenty 20 compass heatmap"
            : "Twenty 20 compass — tap a zone to record this delivery"
        }
        style={{ display: "block", touchAction: "manipulation" }}
      >
        <defs>
          <radialGradient id="cp-shine" cx="40%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer ring backdrop */}
        <circle cx={CX} cy={CY} r={R_OUTER + 1.2} fill="var(--ink)" opacity="0.08" />
        <circle
          cx={CX}
          cy={CY}
          r={R_OUTER}
          fill="var(--bone)"
          stroke="var(--border-strong)"
          strokeWidth="0.4"
        />

        {/* Wedges */}
        {ZONE_IDS.map((zoneId, i) => {
          const z = zoneId as Exclude<ZoneOutcome, "miss">;
          const meta = ZONE_META[z];
          const pts = zonePoints[z];
          const selected = value === z;
          const intensity = readOnly ? (intensities[z] ?? 0) : 0;
          const fillOpacity = readOnly
            ? Math.min(0.85, 0.08 + intensity * 0.85)
            : selected
              ? 1
              : 0;
          const fill =
            selected || readOnly ? "var(--primary-500)" : "var(--bone)";
          const showSpeckle = selected || (readOnly && intensity > 0.05);
          return (
            <g key={z} data-slot="compass-wedge" data-zone={z}>
              {/* Base hairline */}
              <path
                d={wedgePath(i)}
                fill="var(--bone)"
                stroke="var(--border)"
                strokeWidth="0.3"
              />
              {/* Active fill */}
              <path
                d={wedgePath(i)}
                fill={fill}
                fillOpacity={fillOpacity}
                stroke="var(--border-strong)"
                strokeWidth="0.3"
                style={{ transition: "fill-opacity 0.18s" }}
              />
              {/* Speckle dots inside wedge */}
              {showSpeckle && (
                <g opacity={selected ? 0.5 : 0.35}>
                  {wedgeDots[i].map((d, k) => (
                    <circle
                      key={k}
                      cx={d.x}
                      cy={d.y}
                      r={d.s}
                      fill={d.a ? "var(--speckle-a)" : "var(--speckle-b)"}
                    />
                  ))}
                </g>
              )}
              {/* Tap target */}
              {!readOnly && (
                <path
                  d={wedgePath(i)}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onClick={() => onPick?.(z)}
                  data-slot="compass-target"
                  data-zone={z}
                >
                  <title>{`Zone ${z} · ${meta.label} · ${pts}pt`}</title>
                </path>
              )}
              {/* Zone number */}
              <text
                x={labelPos(i, 36).x}
                y={labelPos(i, 36).y + 1.2}
                fontFamily="Barlow Condensed"
                fontWeight={900}
                fontSize={6.6}
                textAnchor="middle"
                fill={selected ? "var(--on-primary)" : "var(--ink)"}
              >
                {z}
              </text>
              {/* Points pip */}
              <text
                x={labelPos(i, 22).x}
                y={labelPos(i, 22).y + 0.8}
                fontFamily="JetBrains Mono"
                fontWeight={700}
                fontSize={3.4}
                textAnchor="middle"
                fill={selected ? "var(--on-primary)" : "var(--ink-muted)"}
                opacity={0.85}
              >
                {pts}pt
              </text>
            </g>
          );
        })}

        {/* Cardinal labels — outside the disc */}
        <g
          fontFamily="Barlow Condensed"
          fontWeight={800}
          fontSize={4}
          textAnchor="middle"
          fill="var(--ink-muted)"
          letterSpacing="0.16"
        >
          <text x={50} y={3.6}>FRONT</text>
          <text x={50} y={99.5}>BACK</text>
          <text x={2.5} y={51.4} textAnchor="start">L</text>
          <text x={97.5} y={51.4} textAnchor="end">R</text>
        </g>

        {/* Centre jack */}
        <circle
          cx={CX}
          cy={CY}
          r={R_INNER}
          fill="#fff"
          stroke="var(--ink)"
          strokeOpacity={0.12}
          strokeWidth={0.4}
        />
        <circle cx={CX} cy={CY} r={R_INNER} fill="url(#cp-shine)" />
        <circle cx={CX - 1.5} cy={CY - 2} r={1.4} fill="#fff" opacity={0.7} />
      </svg>

      {/* Hand badge under the compass */}
      {hand && (
        <div
          data-slot="compass-hand-badge"
          data-hand={hand}
          className="-mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 font-display text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-inverse"
        >
          {hand === "forehand" ? "Forehand" : "Backhand"} · 28m
        </div>
      )}
    </div>
  );
}
