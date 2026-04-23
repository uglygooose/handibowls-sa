import type { ReactNode } from "react";

// Pass-through shell for /login, /signup, /invite/[token]. Each page
// composes its own split/single layout — the chrome (wordmark, aside,
// card) lives in app/(auth)/_components/.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-surface text-ink">{children}</div>;
}
