import { deriveTournamentCompletion, type TournamentCompletionMatch } from "@/lib/tournaments/deriveTournamentCompletion";

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
    .select("id, round_no, status, finalized_by_admin, winner_team_id, team_a_id, team_b_id, score_a, score_b, slot_b_source_type")
    .eq("tournament_id", tournamentId);

  if (mErr) return { attempted: false, completed: false, error: mErr.message ?? "Could not load matches" };

  const matches = (ms ?? []) as any[];

  // Best-effort: backfill missing winner_team_id on the final using stored scores.
  // (Older data may have status COMPLETED but no winner_team_id.)
  const stateBefore = deriveTournamentCompletion(matches as TournamentCompletionMatch[]);
  const maxRound = stateBefore.maxPlayableRound != null ? Number(stateBefore.maxPlayableRound) : null;
  if (maxRound && matches.length) {
    const finals = matches.filter((m: any) => Number(m?.round_no ?? 0) === maxRound);
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

  const state = deriveTournamentCompletion(matches as TournamentCompletionMatch[]);
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
