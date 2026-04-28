"use client";

import { Sun } from "lucide-react";

import { cn } from "@/lib/utils";

// Phase 8 player surface — subtle "screen kept on" indicator pinned to
// the scorecard. The actual `navigator.wakeLock` acquisition happens in
// the scorecard hook (8c) on the user's first +/− tap (iOS Safari
// requires a user gesture); the hook also handles release on unmount,
// visibility change, and tab blur. This primitive is a passive read-out
// — caller threads `active` based on the hook's state.
//
// Renders only when active. Hidden DOM-side when inactive so it
// doesn't take layout space in the top bar.

type Props = {
  /** True while the wake lock is held. False = no badge rendered. */
  active: boolean;
  className?: string;
};

export function WakeLockIndicator({ active, className }: Props) {
  if (!active) return null;
  return (
    <span
      data-slot="wake-lock-indicator"
      data-state="active"
      role="status"
      aria-label="Screen kept awake"
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border border-border bg-surface-muted px-2",
        "font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted",
        className,
      )}
    >
      <Sun className="size-3 shrink-0" aria-hidden="true" />
      Screen kept on
    </span>
  );
}
