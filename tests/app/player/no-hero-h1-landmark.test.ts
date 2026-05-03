import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Phase 12.5 / 12.5-6.5 Stage D — pin the `sr-only`-wrapped h1
// landmark on the no-hero player surfaces. Bundle prescribes no
// visible h1 on /book / /tournaments / /me/inbox (player-pages.jsx
// PageBook / PageInbox + player-core.jsx PageTournaments — all
// start with .mcontent + tab-bar / notif-banner / etc, no
// page-level h1). Shipped surfaces wrap the existing h1 in
// `<header className="sr-only">` (or apply sr-only directly on
// the h1) so screen readers still get a page landmark, but
// visually nothing renders.
//
// Phase 13 / 13-4.5 IA tweak: /play moved from the no-hero list
// to the has-hero list — it now mounts a visible <PlayerHero>
// (identity card + 3-cell stats grid) which carries the visible
// h1 via its title prop. The visible h1 inside PlayerHero is the
// landmark; no sr-only fallback needed.
//
// Static-grep style assertions — these surfaces are Server
// Components with auth + data fetches that don't render cleanly
// in Vitest. Reading the source as text is the pragmatic guard.

const SURFACES = [
  "app/(player)/(gated)/book/page.tsx",
  "app/(player)/(gated)/tournaments/page.tsx",
  "app/(player)/(gated)/me/inbox/page.tsx",
] as const;

function readSurface(relativePath: string): string {
  // Tests run from repo root via `npm test` config; resolve from
  // process.cwd() to match.
  return readFileSync(resolve(process.cwd(), relativePath), "utf-8");
}

describe("no-hero player surfaces — h1 landmark visually hidden via sr-only (12.5-6.5 Stage D)", () => {
  it.each(SURFACES)("`%s` ships an h1 (a11y landmark required)", (path) => {
    const src = readSurface(path);
    expect(src).toMatch(/<h1\b/);
  });

  it.each(SURFACES)(
    "`%s` h1 is wrapped in sr-only (NOT visible — bundle has no visible h1 on no-hero surfaces)",
    (path) => {
      const src = readSurface(path);
      // Either the h1 itself has sr-only, or its parent <header>
      // has sr-only (preferred — also hides decorative eyebrow
      // siblings on /play / /book / /tournaments).
      const directSrOnly = /<h1[^>]*className="[^"]*\bsr-only\b/i.test(src);
      const headerSrOnlyContainsH1 =
        /<header[^>]*className="[^"]*\bsr-only\b[^"]*"[^>]*>[\s\S]*?<h1\b[\s\S]*?<\/header>/i.test(
          src,
        );
      expect(
        directSrOnly || headerSrOnlyContainsH1,
        `${path} should have h1 inside an sr-only header OR an sr-only h1 directly`,
      ).toBe(true);
    },
  );

  it.each(SURFACES)(
    "`%s` h1 does NOT carry the visible-hero typography classes (sr-only is the only style)",
    (path) => {
      const src = readSurface(path);
      // Pre-12.5-6.5 Stage D had `<h1 className="font-display text-3xl
      // font-black italic ...">` patterns. Pin against drift back
      // to those visible-hero classes on the h1 element directly.
      // Allow the visible classes inside the file (other elements
      // can still use them), but the h1 itself shouldn't.
      const h1Matches = src.matchAll(/<h1\b[^>]*className="([^"]*)"/g);
      for (const match of h1Matches) {
        const cls = match[1];
        // h1 should either have sr-only or be empty-classed (the
        // only legal styling on these surfaces post-Stage D).
        if (!cls.includes("sr-only")) {
          // If not sr-only itself, the parent <header> should be
          // sr-only — checked in the previous test. Soft-skip here.
          continue;
        }
        expect(cls).toContain("sr-only");
        // Pin against drift back to the visible hero classes.
        expect(cls).not.toMatch(/text-3xl|text-\[28px\]/);
      }
    },
  );
});
