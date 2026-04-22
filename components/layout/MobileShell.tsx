import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  header?: ReactNode;
  nav?: ReactNode;
  className?: string;
};

// Player mobile shell. Sticky header, scrollable main, fixed bottom nav.
// Main content gets pb-20 so the last card clears the 64px bottom nav
// (plus safe-area inset baked into PlayerBottomNav).
export function MobileShell({ children, header, nav, className }: Props) {
  return (
    <div
      data-slot="mobile-shell"
      className={cn("flex min-h-dvh flex-col bg-surface", className)}
    >
      {header}
      <main className="flex-1 pb-20">{children}</main>
      {nav}
    </div>
  );
}
