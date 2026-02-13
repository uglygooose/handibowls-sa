import {
  deriveTournamentCompletion,
  isTournamentByeMatch,
  type TournamentCompletionMatch,
} from "@/lib/tournaments/deriveTournamentCompletion";

function hasValue(v: any) {
  return v != null && String(v) !== "";
}

function inferWinnerTeamIdFromScores(m: any) {
  const a = hasValue(m?.team_a_id) ? String(m.team_a_id) : "";
  const b = hasValue(m?.team_b_id) ? String(m.team_b_id) : "";
  if (!a || !b) return null;

  const sa = m?.score_a == null ? null : Number(m.score_a);
  const sb = m?.score_b == null ? null : Number(m.score_b);
  if (sa == null || sb == null) return null;
  if (!Number.isFinite(sa) || !Number.isFinite(sb)) return null;
  if (!Number.isInteger(sa) || !Number.isInteger(sb)) return null;
  if (sa === sb) return null;

  return sa > sb ? a : b;
}

export async function completeTournamentIfDone(opts: { supabase: any; tournamentId: string }) {
  const tournamentId = String(opts?.tournamentId ?? "");
  if (!tournamentId) return { attempted: false, completed: false, error: null as string | null };

  const { data: ms, error: mErr } = await opts.supabase
    .from("matches")
    .select(
      "id, round_no, status, finalized_by_admin, winner_team_id, team_a_id, team_b_id, score_a, score_b, slot_a_source_type, slot_a_source_match_id, slot_b_source_type, slot_b_source_match_id"
    )
    .eq("tournament_id", tournamentId);

  if (mErr) return { attempted: false, completed: false, error: mErr.message ?? "Could not load matches" };

  const matches = (ms ?? []) as any[];

  // Cleanup: remove any stray rounds created past the real final (e.g. 1-team placeholder round).
  // Best-effort: do not delete legitimate placeholders that use source dependencies.
  try {
    const fullRounds = matches
      .filter((m: any) => {
        const rn = Number(m?.round_no ?? 0);
        if (!rn) return false;
        if (isTournamentByeMatch(m as TournamentCompletionMatch)) return false;
        const a = hasValue(m?.team_a_id);
        const b = hasValue(m?.team_b_id);
        return a && b;
      })
      .map((m: any) => Number(m?.round_no ?? 0))
      .filter((n: number) => n > 0 && !Number.isNaN(n));

    const maxFullRound = fullRounds.length ? Math.max(...fullRounds) : null;
    if (maxFullRound != null) {
      const extraIds = matches
        .filter((m: any) => Number(m?.round_no ?? 0) > maxFullRound)
        .filter((m: any) => {
          const hasWinner = hasValue(m?.winner_team_id);
          const adminFinal = m?.finalized_by_admin === true;
          const hasAnyScore = m?.score_a != null || m?.score_b != null;
          if (hasWinner || adminFinal || hasAnyScore) return false;

          const a = hasValue(m?.team_a_id);
          const b = hasValue(m?.team_b_id);
          const hasExactlyOneTeam = (a && !b) || (!a && b);

          const sa = hasValue(m?.slot_a_source_type) || hasValue(m?.slot_a_source_match_id);
          const sb = hasValue(m?.slot_b_source_type) || hasValue(m?.slot_b_source_match_id);
          const hasDependencies = sa || sb;

          // Extra final round is typically a single-team match; allow deleting that even if it has a dependency.
          if (hasExactlyOneTeam) return true;

          // Avoid deleting dependency-based placeholders (in case a future bracket strategy pre-creates rounds).
          if (hasDependencies) return false;

          // Otherwise, delete only if it's an empty placeholder with no teams.
          return !a && !b;
        })
        .map((m: any) => String(m?.id ?? ""))
        .filter(Boolean);

      if (extraIds.length) {
        await opts.supabase.from("matches").delete().in("id", extraIds);
        for (const id of extraIds) {
          const idx = matches.findIndex((m: any) => String(m?.id ?? "") === id);
          if (idx >= 0) matches.splice(idx, 1);
        }
      }
    }
  } catch {
    // ignore
  }

  // Ignore any stray rounds beyond the last "full" round when deriving completion state.
  const fullRoundsForDerive = matches
    .filter((m: any) => {
      const rn = Number(m?.round_no ?? 0);
      if (!rn) return false;
      if (isTournamentByeMatch(m as TournamentCompletionMatch)) return false;
      return hasValue(m?.team_a_id) && hasValue(m?.team_b_id);
    })
    .map((m: any) => Number(m?.round_no ?? 0))
    .filter((n: number) => n > 0 && !Number.isNaN(n));

  const maxFullRoundForDerive = fullRoundsForDerive.length ? Math.max(...fullRoundsForDerive) : null;
  const deriveMatches =
    maxFullRoundForDerive != null ? matches.filter((m: any) => Number(m?.round_no ?? 0) <= maxFullRoundForDerive) : matches;

  // Best-effort: backfill missing winner_team_id on the final using stored scores.
  // (Older data may have status COMPLETED but no winner_team_id.)
  const stateBefore = deriveTournamentCompletion(deriveMatches as TournamentCompletionMatch[]);
  const maxRound = stateBefore.maxPlayableRound != null ? Number(stateBefore.maxPlayableRound) : null;
  if (maxRound && deriveMatches.length) {
    const finals = deriveMatches.filter((m: any) => Number(m?.round_no ?? 0) === maxRound);
    for (const m of finals) {
      if (hasValue((m as any)?.winner_team_id)) continue;
      const winnerId = inferWinnerTeamIdFromScores(m);
      if (!winnerId || !hasValue((m as any)?.id)) continue;
      try {
        await opts.supabase.from("matches").update({ winner_team_id: winnerId }).eq("id", String((m as any).id));
        (m as any).winner_team_id = winnerId;
      } catch {
        // ignore
      }
    }
  }

  const state = deriveTournamentCompletion(deriveMatches as TournamentCompletionMatch[]);
  if (!state.completed) return { attempted: false, completed: false, error: null as string | null };

  const nowIso = new Date().toISOString();
  const { error: upErr } = await opts.supabase
    .from("tournaments")
    .update({ status: "COMPLETED", ends_at: nowIso })
    .eq("id", tournamentId)
    .neq("status", "COMPLETED");

  if (upErr) return { attempted: true, completed: false, error: upErr.message ?? "Could not complete tournament" };

  return { attempted: true, completed: true, error: null as string | null };
}
