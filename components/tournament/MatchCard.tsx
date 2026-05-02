"use client";

import { cn } from "@/lib/utils";

import { StatusDot, type MatchStatusForDot } from "./StatusDot";

// Bracket-MatchCard primitive. Used by the admin Draw tab AND the
// (Phase 8) player-side bracket — same shape, same interactions, theme
// auto-tracks via ThemeApplier.
//
// Slot semantics — three states per home/away side:
//   1. Team set                → render `<seed> · <name>` + score
//   2. No team but has feeder  → italic "Winner of M##" placeholder
//   3. No team and no feeder   → BYE chip
//
// `isCurrent` highlights matches in the active round (any non-FINAL).
// `isFinal` swaps the card chrome to the dark-ink final variant.

export type MatchCardSlot = {
  /** Team display name. Null when slot is unfilled (BYE / waiting on feeder). */
  teamName: string | null;
  /** Team seed number for the eyebrow. Null for unfilled slots. */
  seed: number | null;
  /** Score for this side. Null until the match is scored. */
  score: number | null;
  /** Match-no of the feeder (e.g. 3 → "Winner of M03"). Null when teamName set. */
  feederMatchNo: number | null;
  /** "BYE" when this slot is a BYE; otherwise null. */
  isBye: boolean;
  /** True when this side won. Drives bold + success-tone. */
  isWinner: boolean;
};

export type MatchCardData = {
  id: string;
  matchNo: number;
  round: number;
  status: MatchStatusForDot;
  rink?: string | null;
  /** Home / away slots, both shapes identical. */
  home: MatchCardSlot;
  away: MatchCardSlot;
  /** When status === IN_PLAY: optional live foot strip with the current end. */
  liveLabel?: string | null;
};

type Props = {
  match: MatchCardData;
  isCurrent?: boolean;
  isFinal?: boolean;
  onClick?: (match: MatchCardData) => void;
  className?: string;
};

export function MatchCard({
  match,
  isCurrent,
  isFinal,
  onClick,
  className,
}: Props) {
  const interactive = typeof onClick === "function";
  return (
    <button
      type={interactive ? "button" : undefined}
      onClick={interactive ? () => onClick?.(match) : undefined}
      data-slot="match-card"
      data-match-no={match.matchNo}
      data-status={match.status}
      data-current={isCurrent ?? false}
      data-final={isFinal ?? false}
      className={cn(
        "flex w-[230px] flex-col overflow-hidden rounded-xl border text-left transition-all",
        isFinal
          ? "border-ink bg-ink text-ink-inverse"
          : "border-border bg-surface text-ink",
        isCurrent && !isFinal && "border-primary-500 ring-1 ring-primary-500/40",
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      {/* Head row — match no + final tag + rink badge + status */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-3 py-2 text-[11px]",
          isFinal ? "border-ink-inverse/15" : "border-border",
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className={cn("font-mono font-bold", isFinal ? "text-ink-inverse" : "text-ink")}>
            M{String(match.matchNo).padStart(2, "0")}
          </span>
          {isFinal && (
            <span className="font-display text-[10px] font-black uppercase tracking-[0.18em]">
              Final
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {match.rink && (
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-[10px] opacity-80",
                isFinal ? "border-ink-inverse/30" : "border-border",
              )}
            >
              R{match.rink}
            </span>
          )}
          <StatusDot status={match.status} />
        </div>
      </div>

      {/* Slots */}
      <Slot slot={match.home} isFinal={isFinal} />
      <Slot slot={match.away} isFinal={isFinal} />

      {/* Live foot — only when IN_PLAY + we have a live label */}
      {match.status === "IN_PLAY" && match.liveLabel && (
        <div className="flex items-center justify-between bg-warning-500/15 px-3 py-1.5 text-[11px] font-semibold text-warning-700">
          <span>{match.liveLabel}</span>
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-warning-500"
            />
            LIVE
          </span>
        </div>
      )}
    </button>
  );
}

function Slot({ slot, isFinal }: { slot: MatchCardSlot; isFinal?: boolean }) {
  if (slot.isBye) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 text-[12px]",
          isFinal ? "text-ink-inverse/65" : "text-ink-muted",
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="font-mono text-[11px] opacity-70">—</span>
          <span className="font-medium uppercase tracking-[0.06em]">Bye</span>
        </span>
        <span className="rounded-full bg-ink px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-[0.1em] text-ink-inverse">
          Bye
        </span>
      </div>
    );
  }

  if (!slot.teamName && slot.feederMatchNo != null) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 text-[12px] italic",
          isFinal ? "text-ink-inverse/65" : "text-ink-subtle",
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="font-mono text-[11px] opacity-70">·</span>
          <span className="truncate">
            Winner of M{String(slot.feederMatchNo).padStart(2, "0")}
          </span>
        </span>
        <span className="font-mono text-[12px] opacity-70">—</span>
      </div>
    );
  }

  if (!slot.teamName) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 text-[12px]",
          isFinal ? "text-ink-inverse/65" : "text-ink-subtle",
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="font-mono text-[11px] opacity-70">—</span>
          <span>TBD</span>
        </span>
        <span className="font-mono text-[12px] opacity-70">—</span>
      </div>
    );
  }

  return (
    <div
      data-winner={slot.isWinner}
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2 text-[12px]",
        slot.isWinner
          ? isFinal
            ? "text-success-700"
            : "bg-success-500/10 text-ink"
          : isFinal
            ? "text-ink-inverse"
            : "text-ink",
      )}
    >
      <span className="flex items-center gap-2 truncate">
        <span
          className={cn(
            "font-mono text-[11px]",
            isFinal ? "text-ink-inverse/65" : "text-ink-muted",
          )}
        >
          {slot.seed != null ? slot.seed : "—"}
        </span>
        <span
          className={cn(
            "truncate",
            slot.isWinner ? "font-bold" : "font-medium",
          )}
        >
          {slot.teamName}
        </span>
      </span>
      <span
        className={cn(
          "font-mono tabular-nums",
          slot.isWinner ? "font-bold" : "font-semibold",
        )}
      >
        {slot.score ?? "—"}
      </span>
    </div>
  );
}
