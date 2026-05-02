import type { ReactNode } from "react";

// Phase 11 / 11-1c — public route group layout.
//
// Hosts the email unsubscribe surface and any future public-no-auth
// landing pages that need the platform Core Black chrome. The
// (public) group is intentionally minimal — no nav, no footer
// branding from the marketing site — because the people landing
// here arrived from an external inbox link, not from inside the
// product. The aim is "obvious confirmation, no other distractions".
//
// Theme: pinned to Core Black. Per the project-wide DEFAULT_THEME
// invariant, unauth surfaces fall through to core-black; this
// layout makes that explicit so the surface reads consistently
// regardless of any prior html[data-theme] resolution upstream.

export default function PublicLayout({ children }: { children: ReactNode }) {
  // Phase 13 / 13-1 / Tier B / commit 3: data-theme stays as a wrapper
  // div for theme scoping; the inner <main id="main-content"> owns the
  // SkipLink bypass target. Public pages (e.g. /email/unsubscribe) don't
  // render their own <main>.
  return (
    <div data-theme="core-black">
      <main id="main-content">{children}</main>
    </div>
  );
}
