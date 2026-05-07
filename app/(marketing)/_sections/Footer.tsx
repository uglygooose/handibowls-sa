import Link from "next/link";

import { BowlChip } from "@/components/brand/BowlChip";
import { HandiBowlsWordmark } from "@/components/brand/HandiBowlsWordmark";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { FooterAttribution } from "@/components/branding/footer-attribution";

// Phase 13 / 13-9 — ocean-green leads as the Henselite partnership default;
// atomic-red stays in the row to keep variety and signal it's still a
// selectable preset.
const FOOTER_CHIPS: ThemePreset[] = [
  "ocean-green",
  "ocean-blue",
  "sunburst",
  "midnight",
  "atomic-red",
];

const PRODUCT = [
  { href: "#tournaments", label: "Tournaments" },
  { href: "#t20", label: "Twenty 20", tag: "NEW" },
  { href: "#features", label: "Scoring" },
  { href: "#clubs", label: "Ladder leagues" },
];

// Phase 15 fix — footer dead-link cleanup. `Status` was `href="#"`
// (literal placeholder, no route, no planned content). `About` was
// `#about` pointing at a non-existent landing-page anchor. Both
// dropped per operator direction.
const CLUB = [
  { href: "/login", label: "Sign in" },
  { href: "/signup", label: "Create club" },
  { href: "/help", label: "Help" },
];

const COMPANY = [
  { href: "mailto:support@handibowls.co.za", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

function Col({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string; tag?: string }[];
}) {
  return (
    <div>
      {/* Phase 13 / 13-1 / commit 10: was h4 — bumped to h3 to close
          the axe `heading-order` moderate violation on /landing. Page
          outline goes h1 (Hero) → h2 (sections) → h3 (cards + footer
          cols). Visual size locked at 18px via className unchanged;
          only the heading rank moved. */}
      <h3 className="m-0 mb-4 font-display text-[18px] font-extrabold italic tracking-[0.04em] uppercase text-white">
        {title}
      </h3>
      {items.map((i) => (
        <Link
          key={i.label}
          href={i.href}
          className="block py-1 text-sm text-white/65 hover:text-white"
        >
          {i.label}
          {i.tag && (
            <span className="ml-1.5 inline-block rounded-sm border border-[#F5B700]/40 px-1.5 py-px align-middle font-mono text-[9px] tracking-[0.1em] text-[#F5B700]">
              {i.tag}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-ink px-5 pb-8 pt-16 text-ink-inverse md:px-12 md:pt-16">
      <div className="mx-auto grid max-w-[1440px] gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="md:col-auto">
          <HandiBowlsWordmark variant="dark" height={36} />
          <p className="my-4 max-w-[320px] text-sm text-white/65">
            HandiBowls — tournaments, scores, and skills in your pocket. Built
            with clubs, for clubs, in South Africa.
          </p>
          <div className="flex gap-1.5">
            {FOOTER_CHIPS.map((p) => (
              <BowlChip key={p} preset={p} size={28} />
            ))}
          </div>
        </div>
        <Col title="Product" items={PRODUCT} />
        <Col title="Clubs" items={CLUB} />
        <Col title="Company" items={COMPANY} />
      </div>

      <div className="mx-auto mt-12 flex max-w-[1440px] flex-col items-center gap-4 border-t border-white/10 pt-6 text-xs text-white/50 md:flex-row md:justify-between">
        <div className="font-mono tracking-[0.04em]">
          HandiBowls · 2026 · Johannesburg
        </div>
        <div className="font-mono text-[11px] tracking-[0.1em]">
          EN
          <span className="mx-1.5 text-white/25">·</span>
          AFR
          <span className="mx-1.5 text-white/25">·</span>
          ZUL
        </div>
        <FooterAttribution onDark />
      </div>
    </footer>
  );
}
