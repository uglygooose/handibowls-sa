import { ArrowRight, ClipboardList, Target, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SpeckleField } from "@/components/brand/SpeckleField";
import type { ThemePreset } from "@/components/brand/ThemeApplier";

type Feature = {
  preset: ThemePreset;
  icon: LucideIcon;
  kicker: string;
  title: string;
  number: string;
  body: string;
  cta: string;
};

const FEATURES: Feature[] = [
  {
    preset: "ocean-blue",
    icon: Trophy,
    kicker: "01 · Compete",
    title: "Tournaments",
    number: "01",
    body: "Knockouts, round robins, pairs, triples, fours. Live brackets, auto-seeding, score capture that survives a dropped Wi-Fi.",
    cta: "Run a tournament",
  },
  {
    preset: "atomic-red",
    icon: ClipboardList,
    kicker: "02 · Track",
    title: "Scoring",
    number: "02",
    body: "Greenside scorecards with big-thumb inputs, shot-by-shot logs, and team-sheet history that syncs back to the club.",
    cta: "See a live card",
  },
  {
    preset: "sunburst",
    icon: Target,
    kicker: "03 · Improve",
    title: "Twenty 20 skills",
    number: "03",
    body: "Eight-zone compass, graded jacks, rubrics locked by district. Players see where they land; coaches see who's progressing.",
    cta: "Explore the compass",
  },
];

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border-2 border-ink bg-bone transition-[transform,box-shadow] duration-200 hover:translate-x-[-2px] hover:translate-y-[-4px] hover:shadow-[8px_10px_0_var(--color-ink)]">
      <div className="relative h-[200px] overflow-hidden">
        <SpeckleField
          preset={feature.preset}
          width="100%"
          height="100%"
          intensity="medium"
          seedKey={`feature-${feature.preset}`}
          borderRadius={0}
          className="absolute inset-0"
        />
        <div className="absolute left-[18px] top-[18px] z-[2] flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-black/25 backdrop-blur-[4px]">
          <Icon className="h-5 w-5 text-[color:var(--color-on-primary)]" aria-hidden="true" />
        </div>
        <div className="pointer-events-none absolute bottom-3 right-5 z-[2] font-display text-[96px] font-black italic leading-none text-[color:var(--color-on-primary)] opacity-[0.22]">
          {feature.number}
        </div>
      </div>
      <div className="p-7">
        <div className="mb-2.5 font-mono text-[11px] tracking-[0.1em] text-ink-subtle">
          {feature.kicker}
        </div>
        <h3 className="mb-3 font-display text-[32px] font-black italic leading-none tracking-[-0.01em] uppercase">
          {feature.title}
        </h3>
        <p className="mb-5 text-[15px] text-ink-muted">{feature.body}</p>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-accent-ink">
          {feature.cta}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-[1440px] px-5 py-16 md:px-12 md:py-[100px]">
      <header className="mb-10 max-w-[820px] md:mb-14">
        <div className="mb-4 inline-flex items-center gap-2 font-mono text-[12px] font-bold tracking-[0.16em] uppercase text-ink-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
          What&apos;s inside
        </div>
        <h2 className="m-0 font-display text-[clamp(40px,5vw,72px)] font-black italic leading-[0.95] tracking-[-0.02em] uppercase text-balance">
          Three moving parts.{" "}
          <span className="text-accent-ink">One rink.</span>
        </h2>
      </header>
      <div className="grid gap-6 md:grid-cols-3">
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} feature={f} />
        ))}
      </div>
    </section>
  );
}
