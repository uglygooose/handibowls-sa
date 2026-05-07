import Link from "next/link";

import { BrandLockup } from "@/components/branding/brand-lockup";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#tournaments", label: "Tournaments" },
  { href: "#t20", label: "Twenty 20" },
  { href: "#clubs", label: "Clubs" },
  { href: "#about", label: "About" },
];

export function LandingTopBar() {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-8 border-b border-border bg-surface/95 px-5 py-4 backdrop-blur-sm md:gap-8 md:px-12 md:py-[18px]">
      <BrandLockup variant="colour" size="lg" />
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
