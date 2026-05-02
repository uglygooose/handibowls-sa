import { cn } from "@/lib/utils";

// Composed entries-gate pill. The schema has no flat `entries_closed` boolean
// — "accepting entries" is a joint check on `tournaments.status` and
// `tournaments.entries_close_at`:
//
//   open  ↔  status === 'open' AND
//            (entries_close_at IS NULL OR entries_close_at > now())
//
// All callers that surface this concept (list cards, detail hero, command
// palette) MUST go through this primitive so the gate stays consistent.
// Phase 7d / future Phase-12 polish: add audit-log filter that queries
// against the same expression.

export type EntriesGateState = "open" | "closed" | "draft" | "in_progress" | "completed" | "cancelled";

export type EntriesGateInput = {
  status: string; // tournaments.status enum value (lowercase)
  entries_close_at: string | null;
  /** Override "now" for SSR snapshots — defaults to Date.now() at render. */
  now?: Date;
};

export function deriveEntriesGate(input: EntriesGateInput): EntriesGateState {
  const status = String(input.status ?? "");
  if (status === "draft") return "draft";
  if (status === "in_progress") return "in_progress";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "open") {
    const closeAt = input.entries_close_at ? new Date(input.entries_close_at) : null;
    const now = input.now ?? new Date();
    if (closeAt && closeAt <= now) return "closed";
    return "open";
  }
  return "closed";
}

const LABEL: Record<EntriesGateState, string> = {
  open: "Entries open",
  closed: "Entries closed",
  draft: "Draft",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TONE: Record<
  EntriesGateState,
  { bg: string; fg: string; ring: string; dot: string }
> = {
  open: {
    bg: "bg-success-500/10",
    fg: "text-success-700",
    ring: "ring-success-500/30",
    dot: "bg-success-500",
  },
  closed: {
    bg: "bg-warning-500/10",
    fg: "text-warning-700",
    ring: "ring-warning-500/30",
    dot: "bg-warning-500",
  },
  draft: {
    bg: "bg-surface-muted",
    fg: "text-ink-muted",
    ring: "ring-border",
    dot: "bg-ink-subtle",
  },
  in_progress: {
    bg: "bg-info-500/10",
    fg: "text-info-500",
    ring: "ring-info-500/30",
    dot: "bg-info-500",
  },
  completed: {
    bg: "bg-primary-500/10",
    fg: "text-accent-ink",
    ring: "ring-primary-500/30",
    dot: "bg-primary-500",
  },
  cancelled: {
    bg: "bg-danger-500/10",
    fg: "text-danger-500",
    ring: "ring-danger-500/30",
    dot: "bg-danger-500",
  },
};

type Props = {
  /** Pass the raw row fields; the pill derives state internally. */
  status: string;
  entries_close_at: string | null;
  /** Override label for design-spec'd contexts (e.g. "Entries open · 12 days"). */
  label?: string;
  className?: string;
  /** Render larger pill in the detail-hero context. */
  size?: "sm" | "md";
  /** Override "now" in SSR or test snapshots. */
  now?: Date;
};

export function EntriesGatePill({
  status,
  entries_close_at,
  label,
  className,
  size = "sm",
  now,
}: Props) {
  const state = deriveEntriesGate({ status, entries_close_at, now });
  const tone = TONE[state];
  const display = label ?? LABEL[state];

  return (
    <span
      data-slot="entries-gate-pill"
      data-state={state}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-mono font-bold uppercase tracking-[0.06em] ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        tone.bg,
        tone.fg,
        tone.ring,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", tone.dot)}
      />
      {display}
    </span>
  );
}
