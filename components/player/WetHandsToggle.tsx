"use client";

import { Eye } from "lucide-react";

import { cn } from "@/lib/utils";

// Phase 8 player surface — wet-hands mode toggle. Renders as a
// monospace pill in the scorecard top bar. When ON, the scorecard
// switches to a high-contrast amber-on-black treatment (8c surface)
// readable on a wet green in direct sunlight.
//
// Distinct concept from dark mode (Q12 locked off in v1) — only the
// scorecard surface honours `data-wet-hands="on"` on its root.
//
// Persistence is per-device localStorage (`handibowls.wetHands`) and
// is owned by the scorecard hook in 8c. This primitive is purely
// controlled — caller threads `on` + `onToggle`.

type Props = {
  on: boolean;
  onToggle: () => void;
  className?: string;
};

export function WetHandsToggle({ on, onToggle, className }: Props) {
  return (
    <button
      data-slot="wet-hands-toggle"
      data-state={on ? "on" : "off"}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Wet hands mode on. Click to turn off." : "Wet hands mode off. Click to turn on."}
      onClick={onToggle}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-2.5",
        "font-mono text-[10px] font-extrabold uppercase tracking-[0.08em]",
        "transition-colors",
        on
          ? "border-[#f5b700] bg-[#f5b700] text-ink"
          : "border-border bg-bone text-ink-muted hover:bg-surface-muted",
        className,
      )}
    >
      <Eye className="size-3 shrink-0" aria-hidden="true" />
      {on ? "Wet hands on" : "Wet hands"}
    </button>
  );
}
