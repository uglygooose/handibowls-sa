"use client";

import { Check, Pencil, Printer, RefreshCw, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import { FinalizedToggle } from "@/components/tournament/FinalizedToggle";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { verifyMatch } from "@/app/(club-admin)/manage/tournaments/_actions";
import { cn } from "@/lib/utils";

import type { MatchRow } from "../_data";

// Match-detail modal opened from the bracket. Score grid + submission
// timeline + finalized toggle + verify-save action.
//
// Submissions rows derive from the schema's two truthy markers
// (status === 'in_progress'/'completed' for captain/opponent, and
// finalized_by_admin for the admin row). Captain / opponent timestamps
// aren't tracked in the schema today; the design's "X submitted N at
// HH:MM" copy renders an em-dash until that data lands.

type Props = {
  match: MatchRow | null;
  decorPreset?: ThemePreset;
  onClose: () => void;
};

export function MatchModal({ match, decorPreset, onClose }: Props) {
  // Internal state is reset by the parent passing `key={match?.id}`,
  // which unmounts/remounts this component on match change. That keeps
  // initial state derivation in render (allowed) instead of in an
  // effect (a "you might not need an effect" anti-pattern).
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [finalized, setFinalized] = useState<boolean>(
    match?.finalized_by_admin ?? false,
  );

  // Esc to close — common modal expectation.
  useEffect(() => {
    if (!match) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [match, onClose]);

  if (!match) return null;

  const isFinal = match.status === "completed" && match.finalized_by_admin;
  const homeWinner =
    isFinal &&
    match.winner_team_id != null &&
    match.home_team?.id === match.winner_team_id;
  const awayWinner =
    isFinal &&
    match.winner_team_id != null &&
    match.away_team?.id === match.winner_team_id;

  function handleVerify() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await verifyMatch({ match_id: match!.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-modal-title"
      data-slot="match-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl"
      >
        {/* Header — dark ink with speckle + corner splatter */}
        <div className="relative h-20 overflow-hidden bg-ink px-6 text-ink-inverse">
          <SpeckleLayer
            seed={`match-modal-${match.id}`}
            density="high"
            opacity={0.12}
          />
          <div className="pointer-events-none absolute -right-5 -top-5 opacity-40">
            <SplatterAccent
              preset={decorPreset ?? "atomic-red"}
              variant={0}
              size={140}
              rotate={20}
            />
          </div>
          <div className="relative z-10 flex h-full items-center gap-3.5">
            <span className="font-mono text-[13px] font-bold opacity-70">MATCH</span>
            <span
              id="match-modal-title"
              className="font-display text-[36px] font-black leading-none tracking-tight"
            >
              M{String(match.match_no ?? 0).padStart(2, "0")}
            </span>
            <span className="font-display text-[14px] font-bold uppercase tracking-[0.16em] opacity-70">
              Round {match.round ?? "—"} · Rink {match.rink ?? "—"}
            </span>
            <button
              type="button"
              aria-label="Close match"
              onClick={onClose}
              className="ml-auto inline-flex size-9 items-center justify-center rounded-md bg-white/10 text-ink-inverse hover:bg-white/15"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-6">
          {/* Score grid */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl border border-border bg-surface-muted px-5 py-5">
            <ScoreSide
              align="left"
              eyebrow={`Home${homeWinner ? " · Winner" : ""}`}
              eyebrowAccent={homeWinner ? "text-success-700" : undefined}
              title={teamLabel(match.home_team) ?? feederLabel("a", match)}
              subtitle={subtitle(match.home_team)}
              winner={homeWinner}
            />
            <ScoreReadout
              home={match.home_shots}
              away={match.away_shots}
              winnerSide={homeWinner ? "home" : awayWinner ? "away" : null}
            />
            <ScoreSide
              align="right"
              eyebrow={`Away${awayWinner ? " · Winner" : ""}`}
              eyebrowAccent={awayWinner ? "text-success-700" : undefined}
              title={teamLabel(match.away_team) ?? feederLabel("b", match)}
              subtitle={subtitle(match.away_team)}
              winner={awayWinner}
            />
          </div>

          {/* Submissions */}
          <div className="flex flex-col gap-2">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Submissions
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              <SubmissionRow
                label="Captain submitted"
                done={match.status === "in_progress" || match.status === "completed" || isFinal}
                detail="—"
                score={`${match.home_shots} – ${match.away_shots}`}
              />
              <SubmissionRow
                label="Opponent confirmed"
                done={match.status === "completed" || isFinal}
                detail="—"
                score={`${match.away_shots} – ${match.home_shots}`}
                divider="top"
              />
              <SubmissionRow
                label={isFinal ? "Admin verified" : "Not verified"}
                done={isFinal}
                detail="—"
                action={
                  <button
                    type="button"
                    disabled
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[12px] font-medium text-ink-muted opacity-60"
                    title="Score override coming with the bulk-scoring grid (7c-iii)"
                  >
                    <Pencil className="size-3" aria-hidden="true" />
                    Override
                  </button>
                }
                divider="top"
              />
            </div>
          </div>

          {/* Action row */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted px-5 py-4">
            <FinalizedToggle
              finalized={finalized}
              onChange={setFinalized}
              disabled={pending || isFinal}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                title="Per-match scoresheet PDF lands in 7d"
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Printer className="size-3.5" aria-hidden="true" />
                Scoresheet
              </button>
              <button
                type="button"
                disabled
                title="Reset score wires up alongside the override action"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleVerify}
                disabled={pending || isFinal}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary-500 px-3 text-[13px] font-semibold text-[color:var(--color-on-primary)] hover:bg-primary-600",
                  (pending || isFinal) && "cursor-not-allowed opacity-60",
                )}
              >
                <Check className="size-3.5" aria-hidden="true" />
                {isFinal ? "Verified" : pending ? "Verifying…" : "Verify & save"}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-danger-500/10 px-3 py-2 text-[13px] text-ink">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------- helpers --------------------

function teamLabel(team: MatchRow["home_team"]): string | null {
  if (!team) return null;
  return team.name ?? `Team #${team.seed ?? "?"}`;
}

function feederLabel(side: "a" | "b", m: MatchRow): string {
  const sourceType = side === "a" ? m.slot_a_source_type : m.slot_b_source_type;
  const sourceMatch = side === "a" ? m.slot_a_source_match_id : m.slot_b_source_match_id;
  if (sourceType === "BYE") return "BYE";
  if (sourceMatch) return `Winner of M${sourceMatch.slice(-2).toUpperCase()}`;
  return "TBD";
}

function subtitle(team: MatchRow["home_team"]): string {
  if (!team) return "Pending";
  return `Skip · Seed ${team.seed ?? "—"}`;
}

function ScoreSide({
  align,
  eyebrow,
  eyebrowAccent,
  title,
  subtitle,
  winner,
}: {
  align: "left" | "right";
  eyebrow: string;
  eyebrowAccent?: string;
  title: string;
  subtitle: string;
  winner?: boolean;
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div
        className={cn(
          "font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted",
          eyebrowAccent,
        )}
      >
        {eyebrow}
      </div>
      <div
        className={cn(
          "mt-1 font-display text-[28px] font-black leading-tight tracking-tight",
          winner && "text-success-700",
        )}
      >
        {title}
      </div>
      <div className="text-[13px] text-ink-muted">{subtitle}</div>
    </div>
  );
}

function ScoreReadout({
  home,
  away,
  winnerSide,
}: {
  home: number;
  away: number;
  winnerSide: "home" | "away" | null;
}) {
  return (
    <div className="text-center">
      <span
        className={cn(
          "font-mono text-[54px] font-extrabold tabular-nums leading-none tracking-tight",
          winnerSide === "home" ? "text-success-700" : "text-ink",
        )}
      >
        {home}
      </span>
      <span className="mx-3 font-mono text-[32px] text-ink-subtle">:</span>
      <span
        className={cn(
          "font-mono text-[54px] font-extrabold tabular-nums leading-none tracking-tight",
          winnerSide === "away" ? "text-success-700" : "text-ink",
        )}
      >
        {away}
      </span>
    </div>
  );
}

function SubmissionRow({
  label,
  done,
  detail,
  score,
  action,
  divider,
}: {
  label: string;
  done: boolean;
  detail: string;
  score?: string;
  action?: React.ReactNode;
  divider?: "top";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3",
        divider === "top" && "border-t border-border",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ring-1 ring-inset",
            done
              ? "bg-success-500/10 text-ink ring-success-500/30"
              : "bg-surface-muted text-ink-muted ring-border",
          )}
        >
          {done && <Check className="size-3" aria-hidden="true" />}
          {label}
        </span>
        <span className="text-[13px] text-ink-muted">{detail}</span>
      </div>
      {score && (
        <span className="font-mono text-[13px] font-bold tabular-nums text-ink">
          {score}
        </span>
      )}
      {action}
    </div>
  );
}
