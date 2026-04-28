"use client";

import { AlertCircle, Check, Flag, X } from "lucide-react";

import { cn } from "@/lib/utils";

// Phase 8c — opposing captain confirmation card. Renders inside the
// scorecard when the player is the opponent of a captain-submitted
// match: the submitted-by-them score is shown alongside Confirm /
// Dispute affordances. The dispute path opens <DisputeForm /> in a
// bottom sheet; confirm flushes a confirmMatch action.
//
// Phase 8c: the card is built and wired to confirm/dispute callbacks,
// but the actual "captain_submitted" pipeline (distinct from the
// match_status enum's terminal `completed`) is a Phase 8d schema-gap
// item. The card surfaces today on `status='completed' AND
// finalized_by_admin=false` — i.e. one captain has posted a score
// and admin verification hasn't landed yet. Same UX shape, different
// state-machine wiring planned for Phase 8d.

type Props = {
  yourScore: number;
  opponentScore: number;
  yourLabel?: string;
  opponentLabel?: string;
  onConfirm: () => void;
  onDispute: () => void;
  /** True while a callback is in-flight; disables both buttons. */
  pending?: boolean;
  className?: string;
};

export function OpponentConfirmationCard({
  yourScore,
  opponentScore,
  yourLabel = "You",
  opponentLabel = "Opp",
  onConfirm,
  onDispute,
  pending = false,
  className,
}: Props) {
  return (
    <div
      data-slot="opponent-confirmation-card"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-warning-500/40 bg-warning-500/8 p-4",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-warning-500/20 text-warning-500">
          <AlertCircle className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-0.5">
          <strong className="text-[14px] font-extrabold leading-tight text-ink">
            Opponent submitted these scores
          </strong>
          <p className="text-[12.5px] text-ink-muted">
            Confirm to lock in the result, or dispute if the numbers don&apos;t
            match what you have.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-3">
        <ScoreBox label={yourLabel} value={yourScore} />
        <ScoreBox label={opponentLabel} value={opponentScore} />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDispute}
          disabled={pending}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-danger-500/40 bg-surface text-[13px] font-bold text-danger-500 transition-colors hover:bg-danger-500/8 disabled:opacity-60"
        >
          <Flag className="size-3.5" aria-hidden="true" />
          Dispute
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="inline-flex h-11 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-success-500 text-[13px] font-extrabold uppercase tracking-[0.04em] text-white transition-colors hover:opacity-90 disabled:opacity-60"
        >
          <Check className="size-4" aria-hidden="true" />
          Confirm result
        </button>
      </div>
    </div>
  );
}

function ScoreBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </span>
      <span className="font-display text-[36px] font-black italic leading-none tabular-nums">
        {value}
      </span>
    </div>
  );
}

// Re-export icons used by callers wanting to render their own header.
export { X };
