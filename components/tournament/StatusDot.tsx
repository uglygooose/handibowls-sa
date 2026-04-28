import { cn } from "@/lib/utils";

// Inline match-status pill used by the bracket MatchCard, the bracket
// legend, and the (Phase 8) player-side bracket. One source of truth so
// admin + player surfaces stay visually identical.
//
// Domain values are the primitive uppercase strings produced by
// `lib/tournaments/adapters.ts:dbStatusToPrimitive`. The `walkover` →
// `BYE` and `completed + finalized_by_admin` → `FINAL` mappings happen
// at the adapter; this component renders the resolved value.

export type MatchStatusForDot =
  | "OPEN"
  | "SCHEDULED"
  | "IN_PLAY"
  | "FINAL"
  | "COMPLETED"
  | "BYE"
  | "CANCELLED";

const STATUS_TONE: Record<
  MatchStatusForDot,
  { bg: string; fg: string; label: string }
> = {
  OPEN: { bg: "bg-surface-muted", fg: "text-ink-muted", label: "Open" },
  SCHEDULED: { bg: "bg-surface-muted", fg: "text-ink-muted", label: "Scheduled" },
  IN_PLAY: { bg: "bg-warning-500", fg: "text-white", label: "Live" },
  FINAL: { bg: "bg-success-500", fg: "text-white", label: "Final" },
  COMPLETED: { bg: "bg-success-500", fg: "text-white", label: "Done" },
  BYE: { bg: "bg-ink", fg: "text-ink-inverse", label: "Bye" },
  CANCELLED: { bg: "bg-danger-500", fg: "text-white", label: "Cancelled" },
};

type Props = {
  status: MatchStatusForDot;
  className?: string;
};

export function StatusDot({ status, className }: Props) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.OPEN;
  return (
    <span
      data-slot="status-dot"
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.1em]",
        tone.bg,
        tone.fg,
        className,
      )}
    >
      {tone.label}
    </span>
  );
}
