import Link from "next/link";

import { cn } from "@/lib/utils";

// Phase 15 fix — top-of-page back link for the legal/info pages
// reachable from the marketing footer (`/help`, `/help/[slug]`,
// `/privacy`, `/terms`). The (public) route group's layout is
// intentionally minimal (no nav) because it also hosts
// `/email/unsubscribe` where chrome would distract. Each page that
// _does_ need a way back to HandiBowls renders this component
// inline as the first element in the page content.

type Props = {
  className?: string;
};

export function BackToHome({ className }: Props) {
  return (
    <nav
      aria-label="Back to home"
      className={cn("mx-auto max-w-3xl px-5 pt-6", className)}
    >
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted transition-colors hover:text-ink"
        data-slot="back-to-home"
      >
        <span aria-hidden="true">&larr;</span>
        Back to HandiBowls
      </Link>
    </nav>
  );
}
