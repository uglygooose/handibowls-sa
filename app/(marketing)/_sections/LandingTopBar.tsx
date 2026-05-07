import Link from "next/link";

import { Bowl } from "@/components/brand/Bowl";
import { HenseliteLogo } from "@/components/brand/HenseliteLogo";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#tournaments", label: "Tournaments" },
  { href: "#t20", label: "Twenty 20" },
  { href: "#clubs", label: "Clubs" },
];

export function LandingTopBar() {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-8 border-b border-border bg-surface/95 px-5 py-4 backdrop-blur-sm md:gap-8 md:px-12 md:py-[18px]">
      {/* Phase 15 — header lockup unification: every TopBar across
          landing / auth / player / club-admin renders the same
          Henselite logo + divider + Bowl glyph pattern. The
          HandiBowlsWordmark "HANDI–bowl–BOWLS" text is dropped here
          and on auth; the bowl glyph IS the HandiBowls mark in the
          co-brand era. The bowl picks up the active CSS theme — on
          landing the `data-theme="ocean-green"` wrapper in app/page.tsx
          drives it to the Henselite default. */}
      <div className="inline-flex items-center gap-3">
        <HenseliteLogo variant="colour" size={32} />
        <span
          aria-hidden="true"
          className="h-8 w-px shrink-0 self-stretch border-l border-foreground/20"
        />
        <Link href="/" aria-label="HandiBowls — home" className="inline-flex shrink-0">
          {/* Phase 15-fix: pinned to ocean-green so unauth landing
              always reads brand-default green regardless of CSS-var
              cascade timing. Same pattern as Hero.tsx main bowl. */}
          <Bowl themeId="ocean-green" size={32} />
        </Link>
      </div>
      <nav
        aria-label="Primary"
        className="ml-8 hidden gap-7 text-sm font-medium text-ink-muted md:flex"
      >
        {NAV_LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="relative hover:text-ink
              after:absolute after:left-0 after:right-0 after:-bottom-1.5 after:h-0.5
              after:origin-left after:scale-x-0 after:bg-primary-500 after:transition-transform
              hover:after:scale-x-100"
          >
            {l.label}
          </a>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2.5">
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild variant="primary" size="sm" className="hidden sm:inline-flex">
          <Link href="/signup">Create account</Link>
        </Button>
      </div>
    </header>
  );
}
