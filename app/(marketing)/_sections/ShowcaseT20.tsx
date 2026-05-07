import { SplatterAccent } from "@/components/brand/SplatterAccent";

// Phase 12 / 12-6: design-fidelity sweep on the Twenty 20 compass
// card per design source `landing.jsx:331-368` (`ShowcaseT20`) +
// `landing.jsx:273-329` (`Compass`). Three drift-log items closed
// in this file (consolidated entry "T20 compass card design
// fidelity"):
//
//   • N2 — Wedge labels + A/B/C/D grades inside each wedge
//     (was: blank wedges with only N/E/S/W on the outer ring).
//   • N3 — Grade legend wording (`A · On the jack` / `B · In zone`
//     / `C · Off zone` / `D · No bowl` — was: `A — dead weight to
//     the jack` etc).
//   • N4 — Metadata strings (`BSA T20 · DRAW SHOT` / `End 4 of 20`
//     / `82%` running percentage badge — was: `Station 3 · Draw to
//     jack` / `Nthabi Mokoena` / big `A` grade letter).

// Eight zones with N/NE/E/SE/S/SW/W/NW labels + per-zone grade
// per design source (landing.jsx:275-280). The filled wedge
// (i === 3, SE, grade A) shows the landed delivery — matches the
// landing-marker bowl rendered at (248, 232).
const ZONES = [
  { name: "N", grade: "A" },
  { name: "NE", grade: "B" },
  { name: "E", grade: "C" },
  { name: "SE", grade: "A" },
  { name: "S", grade: "A" },
  { name: "SW", grade: "B" },
  { name: "W", grade: "D" },
  { name: "NW", grade: "C" },
] as const;

// Phase 12.5 / 12.5-2 (audit `theme` system dimension): the C-grade
// hex was duplicated inline at the legend row's `bg-[#F5B700]`.
// Declared once here; both the wedge fill (via `GRADE_FILL.C`) and
// the legend row (`SHOWCASE_GRADE_C_HEX`) consume it.
//
// Note: these are zone-grade colours (A/B/C/D — the compass-card
// zone tier) — distinct from the assessment-tier grades (gold /
// silver / bronze / fail) extracted to `lib/brand/grade.ts`. Same
// concept ("a grade") at different scales (per-shot zone vs
// whole-assessment tier) — kept apart so the t20 module owns
// assessment-tier grades and the marketing module owns its own
// zone-grade legend.
const SHOWCASE_GRADE_C_HEX = "#F5B700";

const GRADE_FILL: Record<"A" | "B" | "C" | "D", string> = {
  A: "var(--color-success-500)",
  B: "var(--color-primary-500)",
  C: SHOWCASE_GRADE_C_HEX,
  D: "var(--color-danger-500)",
};

function Compass() {
  const cx = 200;
  const cy = 200;
  const r = 150;
  // Wedge angle convention: each wedge is 45°. Wedge 0 (N) is
  // centred straight-up (-90°), so the start angle for wedge i is
  // (i*45) - 112.5°. This matches the design source's exact
  // orientation (landing.jsx:296).
  const segments = ZONES.map((z, i) => {
    const a0 = ((i * 45 - 112.5) * Math.PI) / 180;
    const a1 = (((i + 1) * 45 - 112.5) * Math.PI) / 180;
    const x0 = cx + Math.cos(a0) * r;
    const y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r;
    const y1 = cy + Math.sin(a1) * r;
    const mid = (a0 + a1) / 2;
    const tx = cx + Math.cos(mid) * (r * 0.68);
    const ty = cy + Math.sin(mid) * (r * 0.68);
    return { ...z, idx: i, d: `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`, tx, ty };
  });
  const landingWedge = 3; // SE — matches landing-marker bowl at (248, 232)
  return (
    <svg viewBox="0 0 400 400" className="block aspect-square max-w-[360px] mx-auto">
      <defs>
        <radialGradient id="compass-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-bone)" />
          <stop offset="100%" stopColor="var(--color-surface-muted)" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r + 10} fill="url(#compass-bg)" stroke="var(--color-ink)" strokeWidth={2} />
      {segments.map((s) => {
        const filled = s.idx === landingWedge;
        return (
          <g key={s.idx}>
            <path
              d={s.d}
              fill={filled ? GRADE_FILL[s.grade] : "var(--color-bone)"}
              fillOpacity={filled ? 0.92 : 1}
              stroke="var(--color-ink)"
              strokeOpacity={0.35}
              strokeWidth={1}
            />
            <text
              x={s.tx}
              y={s.ty}
              textAnchor="middle"
              dominantBaseline="central"
              className="font-display"
              fontSize={18}
              fontWeight={800}
              fill={filled ? "#fff" : "var(--color-ink)"}
            >
              {s.name}
            </text>
            <text
              x={s.tx}
              y={s.ty + 18}
              textAnchor="middle"
              dominantBaseline="central"
              className="font-mono"
              fontSize={11}
              fill={filled ? "#fff" : "var(--color-ink-muted)"}
            >
              {s.grade}
            </text>
          </g>
        );
      })}
      {/* Concentric grading rings */}
      {[100, 60, 30].map((rr) => (
        <circle key={rr} cx={cx} cy={cy} r={rr} fill="none" stroke="var(--color-ink)" strokeOpacity={0.18} strokeDasharray="3 5" />
      ))}
      {/* Jack in centre */}
      <circle cx={cx} cy={cy} r={8} fill="var(--color-bone)" stroke="var(--color-ink)" strokeWidth={2} />
      {/* Phase 15 — landed bowl marker at (248, 232) is now the
          Henselite mark (black variant). 24×24 box centred on the
          point. The three-circle stack (primary-500 fill + ink
          stroke + on-primary inner dot) it replaces was a stylised
          bowl glyph; the Henselite mark IS the brand glyph in the
          co-brand era, so the rest-position dot reads the same
          token across compass, BowlChip, and TopBar surfaces. */}
      <image
        href="/brand/henselite/mark-black.png"
        x={236}
        y={220}
        width={24}
        height={24}
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}

export function ShowcaseT20() {
  return (
    <section
      id="t20"
      className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-16 md:grid-cols-2 md:gap-20 md:px-12 md:py-[100px]"
    >
      <div className="md:order-1">
        <div className="mb-4 inline-flex items-center gap-2 font-mono text-[12px] font-bold tracking-[0.16em] uppercase text-ink-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
          Twenty 20 skills
        </div>
        <h2 className="m-0 mb-5 font-display text-[clamp(36px,4.5vw,60px)] font-black italic leading-[0.95] tracking-[-0.02em] uppercase">
          Eight zones.{" "}
          <em className="not-italic text-primary-500 italic">One jack.</em>{" "}
          Proof you&apos;re improving.
        </h2>
        <p className="max-w-[480px] text-[17px] leading-[1.5] text-ink-muted">
          The compass grades every delivery from A to D against the jack. Drop
          the rubric once at the district level and every Twenty 20 card at
          every club lines up on the same axis.
        </p>
        <ul className="mt-8 grid grid-cols-2 gap-2 text-sm">
          {(
            [
              ["A", "A · On the jack"],
              ["B", "B · In zone"],
              ["C", "C · Off zone"],
              ["D", "D · No bowl"],
            ] as const
          ).map(([grade, label]) => (
            <li key={label} className="flex items-center gap-2 text-ink-muted">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: GRADE_FILL[grade] }}
              />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative md:order-2">
        <div className="pointer-events-none absolute -bottom-8 -left-10 -z-10 opacity-80">
          <SplatterAccent preset="sunburst" variant={2} size={280} rotate={14} />
        </div>
        {/* Phase 13 / 13-9: card offset shadow flips from sunburst yellow
            (#F5B700) to ink so the Twenty 20 compass card matches the
            black-shadow treatment used by the Brackenfell scoring card +
            FeatureGrid hover. Same 12px 14px 0 offset, same alpha (full),
            same blur (none) — only the hue changes. The in-card C-grade
            hex SHOWCASE_GRADE_C_HEX stays sunburst yellow per the
            existing T20 grade-colour brand decision. */}
        <div
          className="mx-auto max-w-[440px] rounded-[20px] border-2 border-ink bg-bone p-6"
          style={{ boxShadow: "12px 14px 0 var(--color-ink)" }}
        >
          <header className="mb-4 flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-subtle">
                BSA Twenty 20 · Draw shot
              </div>
              <div className="mt-1 font-display text-[22px] font-extrabold italic uppercase">
                End 4 of 20
              </div>
            </div>
            <div className="rounded-full border-2 border-ink bg-bone px-3 py-1 font-mono text-[14px] font-bold tabular-nums">
              82%
            </div>
          </header>
          <Compass />
        </div>
      </div>
    </section>
  );
}
