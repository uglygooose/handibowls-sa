export type TournamentCompletionMatch = {
  id?: string | null;
  round_no: number | null;
  status?: string | null;
  finalized_by_admin?: boolean | null;
  winner_team_id?: string | null;
  team_a_id?: string | null;
  team_b_id?: string | null;
  score_a?: number | string | null;
  score_b?: number | string | null;
  slot_b_source_type?: string | null;
};

function hasValue(v: unknown) {
  return v != null && String(v) !== "";
}

export function isTournamentByeMatch(m: TournamentCompletionMatch) {
  const st = String(m?.status ?? "");
  const slotB = String(m?.slot_b_source_type ?? "");
  const hasTeamB = hasValue(m?.team_b_id);

  if (st === "BYE") return true;
  if (slotB === "BYE") return true;

  // Legacy "bye" encoding: no opponent + no dependency.
  return !hasTeamB && !slotB;
}

export function isTournamentMatchDone(m: TournamentCompletionMatch) {
  const st = String(m?.status ?? "");
  const hasWinner = hasValue(m?.winner_team_id);
  return st === "COMPLETED" || m?.finalized_by_admin === true || hasWinner;
}

function hasInferableWinner(m: TournamentCompletionMatch) {
  if (hasValue(m?.winner_team_id)) return true;

  const a = hasValue(m?.team_a_id) ? String(m.team_a_id) : "";
  const b = hasValue(m?.team_b_id) ? String(m.team_b_id) : "";
  if (!a || !b) return false;

  const sa = m?.score_a == null ? null : Number(m.score_a);
  const sb = m?.score_b == null ? null : Number(m.score_b);
  if (!Number.isFinite(sa) || !Number.isFinite(sb)) return false;
  if (!Number.isInteger(sa) || !Number.isInteger(sb)) return false;
  if (sa === sb) return false;

  return true;
}

export function deriveTournamentCompletion(matches: TournamentCompletionMatch[]) {
  const playable = (matches ?? []).filter((m) => {
    const rn = Number(m?.round_no ?? 0);
    if (!rn) return false;
    return !isTournamentByeMatch(m);
  });

  if (!playable.length) return { completed: false, maxPlayableRound: null as number | null };

  const maxPlayableRound = Math.max(
    ...playable.map((m) => Number(m?.round_no ?? 0)).filter((r) => r > 0)
  );

  if (!maxPlayableRound) return { completed: false, maxPlayableRound: null as number | null };

  if (playable.some((m) => !isTournamentMatchDone(m))) {
    return { completed: false, maxPlayableRound };
  }

  const finals = playable.filter((m) => Number(m?.round_no ?? 0) === maxPlayableRound);
  const hasFinalWinner = finals.some((m) => hasInferableWinner(m));

  return { completed: hasFinalWinner, maxPlayableRound };
}
