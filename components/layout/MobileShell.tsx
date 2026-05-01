import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  header?: ReactNode;
  nav?: ReactNode;
  className?: string;
};

// Player mobile shell. Sticky header, scrollable main, fixed bottom nav.
//
// Phase 12.5 / 12.5-6 (J / `player-bottom-padding`): main content's
// bottom padding is `pb-[calc(env(safe-area-inset-bottom)+80px)]` so
// long lists clear both the 76-80px bottom nav AND the iOS safe-area
// inset (home indicator on notched devices). The previous `pb-20`
// covered only the static nav height — on iOS Safari the last list
// row clipped behind the home indicator on /me/inbox notif lists,
// /tournaments rows, /book slot lists, etc.
//
// 80px upper bound matches the bottom-nav height (76px) plus a 4px
// breathing gap baked into the spec; the calc adds the runtime
// safe-area inset on top so the gap survives across notched +
// non-notched devices.
export function MobileShell({ children, header, nav, className }: Props) {
  return (
    <div
      data-slot="mobile-shell"
      className={cn("flex min-h-dvh flex-col bg-surface", className)}
    >
      {header}
      <main
        data-slot="mobile-shell-main"
        className="flex-1 pb-[calc(env(safe-area-inset-bottom)+80px)]"
      >
        {children}
      </main>
      {nav}
    </div>
  );
}
