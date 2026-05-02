"use client";

import { AlertCircle } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import {
  bulkSaveMatchScores,
  finalizeMatchesBatch,
} from "@/app/(club-admin)/manage/tournaments/_actions";
import {
  BulkScoringGrid,
  type BulkScoringMatch,
} from "@/components/tournament/BulkScoringGrid";
import { dbStatusToPrimitive } from "@/lib/tournaments/adapters";

import type { MatchRow } from "../../_data";

type Props = {
  tournamentId: string;
  matches: MatchRow[];
  shotsTarget: number | null;
  endsTarget: number | null;
};

export function ScoringTab({
  tournamentId,
  matches,
  shotsTarget,
  endsTarget,
}: Props) {
  const rounds = useMemo(() => {
    const set = new Set<number>();
    for (const m of matches) if (m.round != null) set.add(m.round);
    return Array.from(set).sort((a, b) => a - b);
  }, [matches]);

  const defaultRound =
    matches.find((m) => m.status !== "completed")?.round ??
    rounds[rounds.length - 1] ??
    1;

  const [round, setRound] = useState(defaultRound);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roundMatches: BulkScoringMatch[] = useMemo(
    () =>
      matches
        .filter((m) => m.round === round)
        .map((m) => ({
          id: m.id,
          match_no: m.match_no ?? 0,
          round: m.round ?? round,
          rink: m.rink,
          status: dbStatusToPrimitive(m.status, m.finalized_by_admin),
          finalized_by_admin: m.finalized_by_admin,
          home_shots: m.home_shots,
          away_shots: m.away_shots,
          home: {
            name:
              m.home_team?.name ??
              (m.slot_a_source_type === "BYE"
                ? "BYE"
                : m.slot_a_source_match_id
                  ? "Winner of feeder"
                  : "TBD"),
            subtitle: m.home_team?.seed != null ? `Seed ${m.home_team.seed}` : null,
            isBye: !m.home_team && m.slot_a_source_type === "BYE",
          },
          away: {
            name:
              m.away_team?.name ??
              (m.slot_b_source_type === "BYE"
                ? "BYE"
                : m.slot_b_source_match_id
                  ? "Winner of feeder"
                  : "TBD"),
            subtitle: m.away_team?.seed != null ? `Seed ${m.away_team.seed}` : null,
            isBye: !m.away_team && m.slot_b_source_type === "BYE",
          },
        })),
    [matches, round],
  );

  const totalCount = matches.length;
  const finalCount = matches.filter(
    (m) => m.status === "completed" && m.finalized_by_admin,
  ).length;
  const progressPct =
    totalCount > 0 ? Math.round((finalCount / totalCount) * 100) : 0;

  function handleSave(
    patches: Array<{ match_id: string; home_shots: number; away_shots: number }>,
  ) {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const result = await bulkSaveMatchScores({
        tournament_id: tournamentId,
        matches: patches,
      });
      if (!result.ok) setError(result.error);
      else setFeedback(`Saved ${result.data.updated_count} match score(s).`);
    });
  }

  function handleFinalize(
    patches: Array<{ match_id: string; home_shots: number; away_shots: number }>,
  ) {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const result = await finalizeMatchesBatch({
        tournament_id: tournamentId,
        matches: patches,
      });
      if (!result.ok) setError(result.error);
      else
        setFeedback(
          `Finalised ${result.data.updated_count} match(es); winners propagated.`,
        );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Engine note — explains the RPC that lands in migrations 024+025 */}
      <div className="flex items-start gap-2 rounded-xl border border-warning-500/30 bg-warning-500/10 px-4 py-2.5 text-[13px] text-warning-700">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <strong>Engine note:</strong> Save batch uses{" "}
          <code className="rounded bg-warning-500/20 px-1 py-0.5 font-mono text-[11.5px]">
            bulk_save_match_scores_batch
          </code>{" "}
          (migration 024) and Finalize uses{" "}
          <code className="rounded bg-warning-500/20 px-1 py-0.5 font-mono text-[11.5px]">
            admin_finalize_matches_batch
          </code>{" "}
          (migration 025). Winner propagation + OPEN→SCHEDULED transitions
          fire on finalize.
        </div>
      </div>

      {/* Round selector + progress */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {rounds.map((r) => {
            const count = matches.filter((m) => m.round === r).length;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRound(r)}
                className={`inline-flex h-9 items-center gap-1 rounded-full border px-3 text-[12px] font-medium transition-colors ${
                  r === round
                    ? "border-primary-500 bg-primary-500 text-[color:var(--color-on-primary)]"
                    : "border-border bg-surface text-ink hover:bg-surface-muted"
                }`}
              >
                Round {r}
                <span
                  className={`ml-1 font-mono text-[11px] opacity-60 ${
                    r === round ? "opacity-90" : ""
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 text-[13px] text-ink-muted">
          <span>
            <strong className="font-mono text-ink">{finalCount}</strong> of{" "}
            <strong className="font-mono text-ink">{totalCount}</strong> matches
            verified
          </span>
          <div className="h-1.5 w-[200px] overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full bg-success-500 transition-[width]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {feedback && (
        <p className="rounded-md bg-success-500/10 px-3 py-2 text-[13px] text-success-700">
          {feedback}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-danger-500/10 px-3 py-2 text-[13px] text-danger-500">
          {error}
        </p>
      )}

      <BulkScoringGrid
        matches={roundMatches}
        onSaveBatch={handleSave}
        onFinalizeBatch={handleFinalize}
        shotsTarget={shotsTarget}
        endsTarget={endsTarget}
        pending={pending}
      />
    </div>
  );
}
