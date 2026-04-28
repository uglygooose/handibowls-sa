"use client";

import { ArrowRight, Printer } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { advanceRound } from "@/app/(club-admin)/manage/tournaments/_actions";
import {
  BracketCanvas,
  type BracketRound,
} from "@/components/tournament/BracketCanvas";
import type {
  MatchCardData,
  MatchCardSlot,
} from "@/components/tournament/MatchCard";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { dbStatusToPrimitive } from "@/lib/tournaments/adapters";
import { cn } from "@/lib/utils";

import type { MatchRow } from "../../_data";
import { MatchModal } from "../MatchModal";

type Props = {
  tournamentId: string;
  matches: MatchRow[];
  decorPreset?: ThemePreset;
  currentRound: number | null;
};

export function DrawTab({
  tournamentId,
  matches,
  decorPreset,
  currentRound,
}: Props) {
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  const [advancePending, startAdvance] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const rounds = useMemo<BracketRound[]>(() => buildRounds(matches, currentRound), [matches, currentRound]);
  const matchById = useMemo(
    () => new Map(matches.map((m) => [m.id, m])),
    [matches],
  );
  const totalRounds = rounds.length;
  const verifiedCount = matches.filter(
    (m) => m.status === "completed" && m.finalized_by_admin,
  ).length;

  const canAdvanceCurrent =
    currentRound != null &&
    currentRound > 0 &&
    matches
      .filter((m) => m.round === currentRound)
      .every((m) => m.status === "completed" || m.status === "walkover");

  function handleAdvance() {
    if (!canAdvanceCurrent || currentRound == null || advancePending) return;
    setActionError(null);
    startAdvance(async () => {
      const result = await advanceRound({
        tournament_id: tournamentId,
        round_no: currentRound,
      });
      if (!result.ok) setActionError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tab toolbar — Advance / Print + verified count */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <button
          type="button"
          onClick={handleAdvance}
          disabled={!canAdvanceCurrent || advancePending}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary-500 px-4 text-[13px] font-semibold text-[color:var(--color-on-primary)] hover:bg-primary-600",
            (!canAdvanceCurrent || advancePending) &&
              "cursor-not-allowed opacity-60",
          )}
        >
          <ArrowRight className="size-3.5" aria-hidden="true" />
          {nextRoundButtonLabel(currentRound, totalRounds, advancePending)}
        </button>
        <button
          type="button"
          disabled
          title="Bracket PDF lands in 7d"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-4 text-[13px] font-medium text-ink-muted opacity-60"
        >
          <Printer className="size-3.5" aria-hidden="true" />
          Print draw (PDF)
        </button>

        <div className="ml-auto text-[13px] text-ink-muted">
          {currentRound != null && (
            <>
              Round{" "}
              <strong className="text-ink">{currentRound}</strong>
              {" "}of {totalRounds || currentRound}
              {" · "}
            </>
          )}
          <strong className="font-mono text-ink">{verifiedCount}</strong> of{" "}
          <strong className="font-mono text-ink">{matches.length}</strong>{" "}
          matches verified
        </div>
      </div>

      {actionError && (
        <p className="rounded-md bg-danger-500/10 px-3 py-2 text-[13px] text-danger-500">
          {actionError}
        </p>
      )}

      <BracketCanvas
        rounds={rounds}
        decorPreset={decorPreset}
        onMatchClick={(m) => setOpenMatchId(m.id)}
      />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-bone px-4 py-3 text-[12.5px]">
        <Legend label="Verified by admin" tone="success" />
        <Legend label="Match underway" tone="warning" />
        <Legend label="Awaiting players or results" tone="neutral" />
        <Legend label="Free pass to next round" tone="ink" />
        <span className="ml-2 inline-flex items-center gap-2 border-l border-border pl-4 text-ink-muted">
          <span
            aria-hidden="true"
            className="inline-block size-3.5 rounded-sm border border-border bg-success-500/10"
          />
          Winner advances · highlighted slot
        </span>
      </div>

      <MatchModal
        match={openMatchId ? (matchById.get(openMatchId) ?? null) : null}
        decorPreset={decorPreset}
        onClose={() => setOpenMatchId(null)}
      />
    </div>
  );
}

// -------------------- helpers --------------------

function nextRoundButtonLabel(
  current: number | null,
  total: number,
  pending: boolean,
): string {
  if (pending) return "Advancing…";
  if (current == null) return "Generate round 1";
  if (total > 0 && current >= total) return "Tournament complete";
  if (total - current === 1) return "Advance to Final";
  if (total - current === 2) return "Advance to Semis";
  return `Advance to round ${current + 1}`;
}

function buildRounds(
  matches: MatchRow[],
  currentRound: number | null,
): BracketRound[] {
  if (matches.length === 0) return [];
  const byRound = new Map<number, MatchRow[]>();
  for (const m of matches) {
    if (m.round == null) continue;
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }
  const sortedRounds = Array.from(byRound.keys()).sort((a, b) => a - b);
  const total = sortedRounds.length;

  return sortedRounds.map((round) => {
    const list = (byRound.get(round) ?? []).sort(
      (a, b) => (a.match_no ?? 0) - (b.match_no ?? 0),
    );
    return {
      round,
      label: roundLabel(round, total),
      isCurrent: currentRound != null && round === currentRound,
      matches: list.map(matchToCardData),
    };
  });
}

function roundLabel(round: number, total: number): string {
  if (round === total) return "Final";
  if (round === total - 1) return "Semi-finals";
  if (round === total - 2) return "Quarter-finals";
  return `Round ${round}`;
}

function matchToCardData(m: MatchRow): MatchCardData {
  const status = dbStatusToPrimitive(m.status, m.finalized_by_admin);
  const winnerHome =
    m.winner_team_id != null && m.home_team?.id === m.winner_team_id;
  const winnerAway =
    m.winner_team_id != null && m.away_team?.id === m.winner_team_id;

  return {
    id: m.id,
    matchNo: m.match_no ?? 0,
    round: m.round ?? 0,
    status,
    rink: m.rink ?? null,
    home: toSlot(m.home_team, m.home_shots, winnerHome, m.slot_a_source_type, m.slot_a_source_match_id),
    away: toSlot(m.away_team, m.away_shots, winnerAway, m.slot_b_source_type, m.slot_b_source_match_id),
    liveLabel: status === "IN_PLAY" ? "Match in progress" : null,
  };
}

function toSlot(
  team: MatchRow["home_team"],
  score: number,
  isWinner: boolean,
  sourceType: string | null,
  sourceMatchId: string | null,
): MatchCardSlot {
  if (sourceType === "BYE" && !team) {
    return {
      teamName: null,
      seed: null,
      score: null,
      feederMatchNo: null,
      isBye: true,
      isWinner: false,
    };
  }
  if (!team) {
    return {
      teamName: null,
      seed: null,
      score: null,
      // Render the last UUID block as the feeder hint until the match is
      // populated. The bracket's match_no isn't on the joined feeder row.
      feederMatchNo: parseFeederTail(sourceMatchId),
      isBye: false,
      isWinner: false,
    };
  }
  return {
    teamName: team.name ?? `Team ${team.seed ?? "?"}`,
    seed: team.seed,
    score: score === 0 && !isWinner ? null : score,
    feederMatchNo: null,
    isBye: false,
    isWinner,
  };
}

function parseFeederTail(uuid: string | null): number | null {
  if (!uuid) return null;
  // Last hex block is 12 chars; we don't have the human match_no here,
  // so render a stable 2-digit derived from a hash of the suffix. Better
  // than "—" for visual continuity with the design.
  const tail = uuid.slice(-3);
  const n = parseInt(tail, 16);
  if (!Number.isFinite(n)) return null;
  return (n % 99) + 1;
}

function Legend({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "neutral" | "ink";
}) {
  const cls = {
    success: "bg-success-500 text-white",
    warning: "bg-warning-500 text-white",
    neutral: "bg-surface-muted text-ink-muted",
    ink: "bg-ink text-ink-inverse",
  }[tone];
  return (
    <span className="inline-flex items-center gap-2 text-ink-muted">
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-4 items-center rounded-full px-1.5 font-display text-[9px] font-bold uppercase tracking-[0.1em]",
          cls,
        )}
      >
        ●
      </span>
      {label}
    </span>
  );
}
