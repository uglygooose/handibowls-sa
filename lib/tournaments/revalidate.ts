import "server-only";

import { revalidatePath } from "next/cache";

// Phase 8d follow-up — Finding 13 fix.
//
// Match-mutating server actions historically revalidated only the
// admin tournament page. The player-facing surfaces (`/play`,
// `/tournaments`, `/tournaments/[id]`, `/tournaments/[id]/matches/[matchId]`,
// `/me`) kept serving the old RSC payload until the route happened to
// rebuild for some other reason — the captain submitted a score, the
// admin verified it, but the player who hit refresh on the scorecard
// kept seeing "pending submission" for minutes. That's the bug.
//
// This helper revalidates BOTH admin AND player surfaces in lock-step.
// Single shared utility so every match-mutating action gets the same
// invalidation set; future drift is one diff.
//
// Argument shape:
//   • tournamentId (required) — for the per-tournament admin and
//     player paths.
//   • matchId (optional) — when the action targets a specific match,
//     also revalidates the player scorecard route. Batch actions
//     (`generateBracket`, `advanceRound`, `bulkSaveMatchScores`,
//     `finalizeMatchesBatch`, `completeTournament`, `cancelTournament`)
//     touch many matches at once and don't pass a matchId; the per-
//     tournament paths already cover them.
//
// `/me` is included because it derives match counts + win-rate from
// completed matches. `verifyMatch` flips status='completed', so the
// stat surfaces have to invalidate.
export function revalidateMatchSurfaces(
  tournamentId: string,
  matchId?: string | null,
): void {
  // Admin
  revalidatePath(`/manage/tournaments/${tournamentId}`, "page");

  // Player surfaces — list + detail + home + profile.
  revalidatePath("/play", "page");
  revalidatePath("/tournaments", "page");
  revalidatePath(`/tournaments/${tournamentId}`, "page");
  if (matchId) {
    revalidatePath(`/tournaments/${tournamentId}/matches/${matchId}`, "page");
  }
  revalidatePath("/me", "page");
}
