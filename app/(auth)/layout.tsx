import type { ReactNode } from "react";

// Pass-through shell for /login, /signup, /invite/[token]. Each page
// composes its own split/single layout — the chrome (wordmark, aside,
// card) lives in app/(auth)/_components/.
//
// Phase 13 / 13-1 / Tier B / commit 3: wrapped in <main id="main-content">
// so the root layout's SkipLink has a valid bypass target on auth pages.
// Auth pages don't render their own <main>; this layout owns it.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="min-h-dvh bg-surface text-ink">
      {children}
    </main>
  );
}
