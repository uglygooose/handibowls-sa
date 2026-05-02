import { CTABand } from "./(marketing)/_sections/CTABand";
import { FeatureGrid } from "./(marketing)/_sections/FeatureGrid";
import { Footer } from "./(marketing)/_sections/Footer";
import { Hero } from "./(marketing)/_sections/Hero";
import { LandingTopBar } from "./(marketing)/_sections/LandingTopBar";
import { Quote } from "./(marketing)/_sections/Quote";
import { ShowcaseT20 } from "./(marketing)/_sections/ShowcaseT20";
import { ShowcaseTournament } from "./(marketing)/_sections/ShowcaseTournament";
import { SocialProof } from "./(marketing)/_sections/SocialProof";

export const metadata = {
  title: "HandiBowls — Tournaments, scores, and skills in your pocket",
  description:
    "HandiBowls is the bowls-first operating system for South African clubs. Tournaments, live scoring, and Twenty 20 skills — in one place.",
};

// Landing is pinned to the Atomic Red preset so the hero reads consistently
// regardless of the viewer's resolved theme. Scoped via the descendant
// [data-theme] selector extended into globals.css — overrides the
// html[data-theme] set by the server-resolved root theme.
export default function RootPage() {
  return (
    <div data-theme="atomic-red" className="min-h-dvh bg-surface text-ink">
      <LandingTopBar />
      <main id="main-content">
        <Hero />
        <FeatureGrid />
        <SocialProof />
        <ShowcaseTournament />
        <ShowcaseT20 />
        <Quote />
        <CTABand />
      </main>
      <Footer />
    </div>
  );
}
