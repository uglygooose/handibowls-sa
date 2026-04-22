// lib/tournaments/match.ts
// Pure-function match helpers. Operate on the shared TournamentCompletionMatch shape.

import type { TournamentCompletionMatch } from "./deriveTournamentCompletion";

export { isTournamentByeMatch as isMatchBye, isTournamentMatchDone as isMatchDone } from "./deriveTournamentCompletion";
import { isTournamentByeMatch as isMatchBye, isTournamentMatchDone as isMatchDone } from "./deriveTournamentCompletion";

export function hasValue(v: unknown): boolean {
  return v != null && String(v) !== "";
}

export function bool(v: unknown): boolean {
  return v === true;
}

export function hasWinnerTeamId(m: TournamentCompletionMatch): boolean {
  return hasValue(m?.winner_team_id);
}

/**
 * Returns the winning team id for a finished match, or null if the winner
 * cannot yet be determined. BYE matches return team_a_id.
 */
export function winnerTeamIdFromMatch(m: TournamentCompletionMatch): string | null {
  if (hasWinnerTeamId(m)) return String(m.winner_team_id);
  if (!isMatchDone(m)) return null;

  // BYE finalisation can legitimately have no team_b_id.
  if (isMatchBye(m)) return m.team_a_id ? String(m.team_a_id) : null;

  if (!m.team_a_id || !m.team_b_id) return null;
  if (m.score_a == null || m.score_b == null) return null;

  const sa = Number(m.score_a);
  const sb = Number(m.score_b);
  if (!Number.isFinite(sa) || !Number.isFinite(sb)) return null;
  if (sa === sb) return null;

  return sa > sb ? String(m.team_a_id) : String(m.team_b_id);
}
