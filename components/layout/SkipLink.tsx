// Visually-hidden bypass link mounted as the first focusable element in the
// root layout. Becomes visible on keyboard focus (Tab from page load) and
// jumps to the page's `<main id="main-content">` landmark.
//
// WCAG 2.1 / 2.4.1 (Bypass Blocks, Level A): mandatory for any page with
// repeated content (the admin sidebar, player bottom nav, marketing top
// nav all qualify). Without a skip link, keyboard-only users tab through
// every nav item before reaching content on every navigation.
//
// Phase 13 / 13-1 / Tier B / commit 3.
//
// Visibility contract:
//   - Default state: visually hidden via Tailwind sr-only.
//   - On focus-visible: positioned at the top-left, contrast-strong on
//     bone, with a 2px focus ring. Stays inside the viewport and clear
//     of any header chrome (top: 1rem).
//
// The target id `main-content` is stable across role layouts; each
// layout's `<main>` element carries it.

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-[10px] focus-visible:border-2 focus-visible:border-ink focus-visible:bg-bone focus-visible:px-4 focus-visible:py-2 focus-visible:text-[14px] focus-visible:font-semibold focus-visible:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
    >
      Skip to main content
    </a>
  );
}
