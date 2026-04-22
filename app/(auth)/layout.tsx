import type { ReactNode } from "react";

import { HandiBowlsWordmark } from "@/components/brand/HandiBowlsWordmark";

// Public shell for /login, /signup, /invite/[token]. No role required; the
// root middleware short-circuits authenticated users away from /login and
// /signup, and /invite/[token] is valid for anyone with a token.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex h-16 items-center px-6">
        <HandiBowlsWordmark variant="light" height={28} />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
