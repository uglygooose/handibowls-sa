import { SpeckleField } from "@/components/brand/SpeckleField";

const STATS = [
  { n: "20", l: "BSA districts mapped" },
  { n: "5", l: "Disciplines supported" },
  { n: "✓", l: "BSA-native terminology" },
  { n: "✓", l: "POPIA compliant" },
];

export function SocialProof() {
  return (
    <section
      id="clubs"
      className="relative overflow-hidden bg-[#0E1B3D] text-ink-inverse"
    >
      {/* 12.5-7 (audit id `speckle-field-numeric-consumer-
          reconciliation`): density={1.4} opacityScale={0.35}
          locked as a named exception. The 0.35 opacity is
          significantly below any named tier (subtle/medium/bold
          all use opacityScale ≥ 1.0 — the named scale presumes
          decorative density on a small surface, not full-bleed
          background). SocialProof's full-bleed midnight band
          intentionally renders the speckle very faintly (0.35×)
          while keeping density high (1.4) for a uniformly
          textured backdrop. Keep numeric. */}
      <SpeckleField
        preset="midnight"
        width="100%"
        height="100%"
        density={1.4}
        opacityScale={0.35}
        seedKey="social-proof"
        borderRadius={0}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <div className="relative z-[2] mx-auto grid max-w-[1440px] items-center gap-8 px-5 py-14 md:grid-cols-[1.1fr_1fr] md:gap-16 md:px-12 md:py-20">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-[12px] font-bold tracking-[0.16em] uppercase text-white/70">
            {/* Phase 13 / 13-9: BSA dark-section yellow accents (dot
                bullet + "your club" emphasis) flip to brand green to
                align with the Henselite partnership default. Primary-500
                #08BB00 vs the section's #0E1B3D bg ≈ 6.5:1 — passes
                WCAG AA without needing the --primary-700 fallback. */}
            <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
            Built for BSA
          </div>
          <h2 className="m-0 font-display text-[clamp(36px,4.5vw,56px)] font-black italic leading-none tracking-[-0.02em] uppercase text-balance">
            Built for BSA, ready for{" "}
            <span className="text-primary-500">your club</span>.
          </h2>
          <p className="mt-5 max-w-[480px] text-[17px] leading-[1.5] text-white/75">
            HandiBowls speaks the bowls community&apos;s language — districts,
            disciplines, scoresheets, handicaps. Designed around BSA structure,
            ready for your club to adopt.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-8">
          {STATS.map((s) => (
            <div key={s.l} className="border-t-2 border-white/20 pt-4">
              <div className="font-display text-[clamp(56px,6vw,88px)] font-black italic leading-none tracking-[-0.02em] text-white">
                {s.n}
              </div>
              <div className="mt-2 font-mono text-[11px] tracking-[0.14em] uppercase text-white/60">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
