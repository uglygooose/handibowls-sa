import { deriveEntriesGate } from "@/components/tournament/EntriesGatePill";
import { cn } from "@/lib/utils";

import type { TournamentListRow } from "../_data";

// Tournament-list status pill. The design source (page-list.jsx) treats
// `entries_closed` as a top-level status value, but the schema only has
// open / draft / in_progress / completed / cancelled. We derive the
// display state by composing status + entries_close_at via the same
// `deriveEntriesGate` helper used by the EntriesGatePill primitive —
// keeps the two surfaces in lock-step.

type DisplayState =
  | "draft"
  | "open"
  | "entries_closed"
  | "in_progress"
  | "completed"
  | "cancelled";

const LABEL: Record<DisplayState, string> = {
  draft: "Draft",
  open: "Open",
  entries_closed: "Entries Closed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TONE: Record<DisplayState, { bg: string; fg: string; ring: string }> = {
  draft: { bg: "bg-surface-muted", fg: "text-ink-muted", ring: "ring-border" },
  open: {
    bg: "bg-info-500/10",
    fg: "text-info-500",
    ring: "ring-info-500/30",
  },
  entries_closed: {
    bg: "bg-warning-500/10",
    fg: "text-warning-700",
    ring: "ring-warning-500/30",
  },
  in_progress: {
    bg: "bg-primary-500/10",
    fg: "text-primary-500",
    ring: "ring-primary-500/30",
  },
  completed: {
    bg: "bg-success-500/10",
    fg: "text-success-700",
    ring: "ring-success-500/30",
  },
  cancelled: {
    bg: "bg-danger-500/10",
    fg: "text-danger-500",
    ring: "ring-danger-500/30",
  },
};

type Input = Pick<TournamentListRow, "status" | "entries_close_at">;

export function deriveDisplayState(t: Input, now?: Date): DisplayState {
  // For statuses other than "open", deriveEntriesGate returns the matching
  // state directly. For "open" it returns either "open" (still accepting)
  // or "closed" (window expired) — we re-label "closed" as "entries_closed"
  // for the list context.
  const gate = deriveEntriesGate({
    status: t.status,
    entries_close_at: t.entries_close_at,
    now,
  });
  if (gate === "closed") return "entries_closed";
  return gate;
}

type Props = {
  tournament: Input;
  className?: string;
  now?: Date;
};

export function StatusPill({ tournament, className, now }: Props) {
  const state = deriveDisplayState(tournament, now);
  const tone = TONE[state];

  return (
    <span
      data-slot="tournament-status-pill"
      data-state={state}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.06em] ring-1 ring-inset",
        tone.bg,
        tone.fg,
        tone.ring,
        className,
      )}
    >
      {LABEL[state]}
    </span>
  );
}
