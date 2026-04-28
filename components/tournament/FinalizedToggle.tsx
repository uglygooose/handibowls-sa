"use client";

import { Lock, Unlock } from "lucide-react";

import { cn } from "@/lib/utils";

// "Lock match score" toggle from the design's match-detail modal.
// Mirrors `matches.finalized_by_admin` — when on, the match is treated
// as admin-verified. Calls onChange with the next intended value;
// caller wires it to `verifyMatch` / `confirmMatch` actions or to a
// local override before the bulk-save run.

type Props = {
  finalized: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function FinalizedToggle({
  finalized,
  onChange,
  disabled,
  className,
}: Props) {
  const Icon = finalized ? Lock : Unlock;
  return (
    <label
      data-slot="finalized-toggle"
      data-finalized={finalized}
      className={cn(
        "inline-flex items-center gap-2 text-[13px] text-ink-muted",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon className="size-3.5" aria-hidden="true" />
        Lock match score
      </span>
      <span className="relative inline-flex h-5 w-9 items-center">
        <input
          type="checkbox"
          checked={finalized}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={finalized ? "Unlock match score" : "Lock match score"}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-surface-muted ring-1 ring-inset ring-border transition-colors peer-checked:bg-primary-500 peer-disabled:opacity-60"
        />
        <span
          aria-hidden="true"
          className="relative ml-0.5 size-4 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-4"
        />
      </span>
    </label>
  );
}
