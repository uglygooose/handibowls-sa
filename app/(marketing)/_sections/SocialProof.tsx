import { SpeckleField } from "@/components/brand/SpeckleField";

const STATS = [
  { n: "20", l: "Clubs in pilot" },
  { n: "5", l: "Districts onboard" },
  { n: "4", l: "Formats supported" },
  { n: "∞", l: "Ends per match" },
];

export function SocialProof() {
  return (
    <section
      id="clubs"
      className="relative overflow-hidden bg-[#0E1B3D] text-ink-inverse"
    >
      <SpeckleField
        preset="midnight"
        width="100%"
        height="100%"
        density={1.4}
        opacityScale={0.35}
        borderRadius={0}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <div className="relative z-[2] mx-auto grid max-w-[1440px] items-center gap-8 px-5 py-14 md:grid-cols-[1.1fr_1fr] md:gap-16 md:px-12 md:py-20">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-[12px] font-bold tracking-[0.16em] uppercase text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F5B700]" />
            The rollout
          </div>
          <h2 className="m-0 font-display text-[clamp(36px,4.5vw,56px)] font-black italic leading-none tracking-[-0.02em] uppercase text-balance">
            Backed by clubs from Cape Town to{" "}
            <span className="text-[#F5B700]">Pretoria</span>.
          </h2>
          <p className="mt-5 max-w-[480px] text-[17px] leading-[1.5] text-white/75">
            HandiBowls started with the Western Province pilot and now runs
            knockouts, Twenty 20 cards, and ladder leagues at 20+ clubs across
            five districts.
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
