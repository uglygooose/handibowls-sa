// app/tournaments/[id]/utils/matchHelpers.ts
//
// Pure helpers used only by the public tournament detail page and its
// view components. These are separate from lib/tournaments/matchHelpers
// because they encode captain-workflow policy and public-page-specific
// display rules.
//
// None of these helpers import from ../page (to avoid a cyclic module
// dependency with the view components, which do import types from
// ../page). Each helper takes the narrow structural shape it needs.

import { bool, isMatchBye, isMatchDone, winnerTeamIdFromMatch } from "@/lib/tournaments/match";

// -------------------- captain identity --------------------

export type CaptainCtx = {
  playerId: string | null;
  captainByTeamId: Record<string, string>;
};

export function isCaptainOfTeam(teamId: string | null, ctx: CaptainCtx): boolean {
  const { playerId, captainByTeamId } = ctx;
  if (!teamId || !playerId) return false;
  return captainByTeamId[teamId] === playerId;
}

type CaptainMatchLike = {
  team_a_id: string | null;
  team_b_id: string | null;
  status?: string | null;
  finalized_by_admin?: boolean | null;
  score_a?: number | null;
  score_b?: number | null;
  submitted_by_player_id?: string | null;
  confirmed_by_a?: boolean | null;
  confirmed_by_b?: boolean | null;
};

export function sideForCaptain(match: CaptainMatchLike, ctx: CaptainCtx): "A" | "B" | null {
  const isA = isCaptainOfTeam(match.team_a_id, ctx);
  const isB = isCaptainOfTeam(match.team_b_id, ctx);
  if (isA) return "A";
  if (isB) return "B";
  return null;
}

export function canSubmitScore(match: CaptainMatchLike, ctx: CaptainCtx): boolean {
  if (String(match.status ?? "") !== "IN_PLAY") return false;
  if (bool(match.finalized_by_admin)) return false;
  return sideForCaptain(match, ctx) != null;
}

export function canConfirmScore(match: CaptainMatchLike, ctx: CaptainCtx): boolean {
  if (bool(match.finalized_by_admin)) return false;
  if (match.score_a == null || match.score_b == null) return false;
  if (!match.submitted_by_player_id) return false;

  const mySide = sideForCaptain(match, ctx);
  if (!mySide) return false;

  // The submitting captain auto-confirms their own side; only the other
  // side should confirm.
  if (match.submitted_by_player_id === ctx.playerId) return false;

  if (mySide === "A") return !bool(match.confirmed_by_a);
  if (mySide === "B") return !bool(match.confirmed_by_b);
  return false;
}

// -------------------- tournament winner / captain finish --------------------

type WinnerMatchLike = {
  round_no: number | null;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_team_id?: string | null;
  score_a?: number | null;
  score_b?: number | null;
  finalized_by_admin?: boolean | null;
  confirmed_by_a?: boolean | null;
  confirmed_by_b?: boolean | null;
  status?: string | null;
};

export type WinnerNameInput<M extends WinnerMatchLike> = {
  matchesForUi: M[];
  maxPlayableRound: number | null;
  slotLabel: (m: M, side: "A" | "B") => string;
};

export function winnerNameFromMatches<M extends WinnerMatchLike>(
  input: WinnerNameInput<M>
): string | null {
  const { matchesForUi, maxPlayableRound, slotLabel } = input;
  if (!matchesForUi.length) return null;
  const maxRound =
    (maxPlayableRound ?? null) ||
    Math.max(...matchesForUi.map((m) => Number(m.round_no ?? 0)).filter((r) => r > 0));
  if (!maxRound) return null;
  const finals = matchesForUi.filter(
    (m) => Number(m.round_no ?? 0) === maxRound && !isMatchBye(m)
  );
  const finalMatch = finals.find((m) => winnerTeamIdFromMatch(m)) ?? finals[0];
  if (!finalMatch) return null;

  const winnerId = winnerTeamIdFromMatch(finalMatch);
  if (!winnerId) return null;

  const side: "A" | "B" =
    finalMatch.team_a_id && String(finalMatch.team_a_id) === winnerId ? "A" : "B";
  return slotLabel(finalMatch, side);
}

type FinishMatchLike = {
  round_no: number | null;
  match_no?: number | null;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_team_id?: string | null;
  score_a?: number | null;
  score_b?: number | null;
  finalized_by_admin?: boolean | null;
  confirmed_by_a?: boolean | null;
  confirmed_by_b?: boolean | null;
  status?: string | null;
};

export type FinishSummary = { label: string; detail: string | null };

export type MyFinishSummaryInput<M extends FinishMatchLike> = {
  myTeamId: string | null;
  myMatches: M[];
  roundLabel: (roundNo: number | null | undefined) => string;
  finishPlacementLabel: (roundNo: number | null | undefined) => string | null;
};

export function myFinishSummary<M extends FinishMatchLike>(
  input: MyFinishSummaryInput<M>
): FinishSummary | null {
  const { myTeamId, myMatches, roundLabel, finishPlacementLabel } = input;
  if (!myTeamId) return null;
  const done = myMatches.filter((m) => isMatchDone(m));
  if (!done.length) return null;
  const sorted = done.slice().sort(
    (a, b) =>
      Number(b.round_no ?? 0) - Number(a.round_no ?? 0) ||
      Number(b.match_no ?? 0) - Number(a.match_no ?? 0)
  );
  const last = sorted[0];
  const winnerId = last ? winnerTeamIdFromMatch(last) : null;
  if (winnerId && winnerId === myTeamId) {
    return { label: "Champion", detail: null };
  }
  const round = roundLabel(last?.round_no ?? null);
  const place = finishPlacementLabel(last?.round_no ?? null);
  return { label: `Knocked out: ${round}`, detail: place ? `Finish: ${place}` : null };
}
