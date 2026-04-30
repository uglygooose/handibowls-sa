import { SplatterAccent } from "@/components/brand/SplatterAccent";

// Eight-zone compass: 8 equal wedges, one filled to show a landed jack.
function Compass() {
  const cx = 200;
  const cy = 200;
  const r = 150;
  const segments = Array.from({ length: 8 }, (_, i) => {
    const a1 = (i * 360) / 8 - 90;
    const a2 = ((i + 1) * 360) / 8 - 90;
    const p1 = polar(cx, cy, r, a1);
    const p2 = polar(cx, cy, r, a2);
    const large = 0;
    const d = `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y} Z`;
    return { d, idx: i };
  });
  const landingWedge = 2; // east-north-east wedge
  return (
    <svg viewBox="0 0 400 400" className="block aspect-square max-w-[360px] mx-auto">
      <defs>
        <radialGradient id="compass-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-bone)" />
          <stop offset="100%" stopColor="var(--color-surface-muted)" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r + 10} fill="url(#compass-bg)" stroke="var(--color-ink)" strokeWidth={2} />
      {segments.map((s) => (
        <path
          key={s.idx}
          d={s.d}
          fill={s.idx === landingWedge ? "var(--color-success-500)" : "transparent"}
          fillOpacity={s.idx === landingWedge ? 0.28 : 0}
          stroke="var(--color-ink)"
          strokeOpacity={0.35}
          strokeWidth={1}
        />
      ))}
      {/* Concentric grading rings */}
      {[100, 60, 30].map((rr) => (
        <circle key={rr} cx={cx} cy={cy} r={rr} fill="none" stroke="var(--color-ink)" strokeOpacity={0.18} strokeDasharray="3 5" />
      ))}
      {/* Jack in centre */}
      <circle cx={cx} cy={cy} r={8} fill="var(--color-bone)" stroke="var(--color-ink)" strokeWidth={2} />
      {/* Landed bowl marker at (248, 232) per design spec */}
      <circle cx={248} cy={232} r={12} fill="var(--color-primary-500)" stroke="var(--color-ink)" strokeWidth={2} />
      <circle cx={248} cy={232} r={3} fill="var(--color-on-primary)" opacity={0.6} />
      {/* Compass labels */}
      {["N", "E", "S", "W"].map((label, i) => {
        const pos = polar(cx, cy, r + 24, -90 + i * 90);
        return (
          <text
            key={label}
            x={pos.x}
            y={pos.y + 5}
            textAnchor="middle"
            className="font-mono"
            fontSize="12"
            fill="var(--color-ink-subtle)"
            fontWeight={700}
            letterSpacing="2"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
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
          {[
            { cls: "bg-success-500", label: "A — dead weight to the jack" },
            { cls: "bg-primary-500", label: "B — hugs the zone" },
            { cls: "bg-[#F5B700]", label: "C — in the head" },
            { cls: "bg-danger-500", label: "D — off the rink" },
          ].map((g) => (
            <li key={g.label} className="flex items-center gap-2 text-ink-muted">
              <span className={`inline-block h-3 w-3 rounded-sm ${g.cls}`} />
              {g.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative md:order-2">
        <div className="pointer-events-none absolute -bottom-8 -left-10 -z-10 opacity-80">
          <SplatterAccent preset="sunburst" variant={2} size={280} rotate={14} />
        </div>
        <div
          className="mx-auto max-w-[440px] rounded-[20px] border-2 border-ink bg-bone p-6"
          style={{ boxShadow: "12px 14px 0 #F5B700" }}
        >
          <header className="mb-4 flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-subtle">
                Station 3 · Draw to jack
              </div>
              <div className="mt-1 font-display text-[22px] font-extrabold italic uppercase">
                Nthabi Mokoena
              </div>
            </div>
            <div className="font-display text-[40px] font-black italic leading-none tracking-[-0.02em] text-success-500">
              A
            </div>
          </header>
          <Compass />
          <div className="mt-5 flex justify-between font-mono text-[11px] tracking-[0.1em] uppercase text-ink-subtle">
            <span>End 4 of 6</span>
            <span>Card locked</span>
          </div>
        </div>
      </div>
    </section>
  );
}
