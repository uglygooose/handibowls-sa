"use client";

import { cn } from "@/lib/utils";

// Phase 10 / 10-6 — capture-wizard save indicator.
//
// Three states match the design source's vocabulary verbatim:
//
//   saved    "Saved"             success-500 dot + ink-muted text
//   saving   "Saving…"           amber dot pulsing + ink-muted text
//   failed   "Save failed — retry" danger dot + danger text
//
// Pulsed dot animation on `saving` state mirrors the 0.9s pulse from
// t20-page-capture.jsx. Failed state emphasises action ("retry") so
// the coach knows the surface is live.
//
// Distinct from `OfflineSyncBadge` (Phase 8c scorecard) — that
// component's vocabulary speaks of "ends pending" + queue counts;
// the Twenty 20 capture is online-only per plan §13 ("Autosave every
// 5s — online-only for v1"), so per-delivery success/failure is the
// only state we surface.

export type SaveState = "saved" | "saving" | "failed";

type Props = {
  state: SaveState;
  className?: string;
};

const TONE: Record<
  SaveState,
  { label: string; textClass: string; dotClass: string; pulse: boolean }
> = {
  saved: {
    label: "Saved",
    textClass: "text-success-500",
    dotClass: "bg-success-500",
    pulse: false,
  },
  saving: {
    label: "Saving…",
    textClass: "text-ink-muted",
    dotClass: "bg-warning-500",
    pulse: true,
  },
  failed: {
    label: "Save failed — retry",
    textClass: "text-danger-500",
    dotClass: "bg-danger-500",
    pulse: false,
  },
};

export function SaveIndicator({ state, className }: Props) {
  const tone = TONE[state];
  return (
    <span
      data-slot="save-indicator"
      data-state={state}
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[12.5px]",
        tone.textClass,
        className,
      )}
    >
      <span
        aria-hidden="true"
        data-slot="save-indicator-dot"
        className={cn(
          "size-2 shrink-0 rounded-full",
          tone.dotClass,
          tone.pulse && "animate-pulse",
        )}
      />
      {tone.label}
    </span>
  );
}
