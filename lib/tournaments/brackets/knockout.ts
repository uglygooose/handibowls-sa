// lib/tournaments/brackets/knockout.ts
//
// Knockout-bracket round-1 generator. Fresh implementation per Phase-6
// directive (B): the pre-rebuild logic lived in a PostgreSQL RPC
// (`tournament_generate_knockout_matches`) whose body is not in git.
// Round-2+ advancement is handled by `lib/tournaments/rounds.ts`.

import { largestPowerOfTwoLE } from "@/lib/tournaments/bracket";
import type { SeedingResult } from "@/lib/tournaments/seeding";

// -------------------- output shape --------------------
//
// Mirrors `RoundAdvanceInsert` from rounds.ts so the action layer can use
// one INSERT-shape across round-1 (this) and round-2+ (rounds.ts).

export type KnockoutInsert = {
  round_no: 1;
  match_no: number;
  team_a_id: string | null;
  team_b_id: string | null;
  slot_a_source_type: "TEAM" | null;
  slot_a_source_match_id: null;
  slot_b_source_type: "TEAM" | "BYE" | null;
  slot_b_source_match_id: null;
  status: "SCHEDULED" | "BYE";
};

// -------------------- public API --------------------

/**
 * Generate round-1 inserts from a `SeedingResult`. Two cases:
 *
 *   • N is a power of 2 — full round-1 bracket with N/2 matches.
 *     Pairings come from the seeding result (1-vs-N for `seeded`,
 *     adjacent for `random`).
 *
 *   • N is not a power of 2 — play-in round-1 with (N - p) matches.
 *     The bottom (2 * (N - p)) seeded teams play; the top (2p - N)
 *     teams are tracked as `byeTeamIds` and inserted into round 2 by
 *     `lib/tournaments/rounds.ts:advanceRound` once the play-ins
 *     complete.
 *
 * Returns `null` for `pairings: null` (sectional — fixtures come from
 * the round-robin generator, not this function).
 */
export function generateKnockoutRound1(
  seeding: SeedingResult,
): { inserts: KnockoutInsert[]; byeTeamIds: string[] } | null {
  if (seeding.pairings == null) return null;

  const N = seeding.ordered.length;
  if (N === 0) return { inserts: [], byeTeamIds: [] };
  if (N === 1) return { inserts: [], byeTeamIds: [seeding.ordered[0].id] };

  const p = largestPowerOfTwoLE(N);
  const playIn = N - p;

  if (playIn === 0) {
    // Full bracket — every pair becomes a round-1 match.
    const inserts: KnockoutInsert[] = [];
    let matchNo = 1;
    for (const [a, b] of seeding.pairings) {
      inserts.push(matchInsert(matchNo, a, b));
      matchNo += 1;
    }
    return { inserts, byeTeamIds: [] };
  }

  // Play-in: the LAST (2 * playIn) teams in the seeded ordered list
  // pair up; the first (2p - N) teams BYE to round 2.
  const byeCount = 2 * p - N;
  const byeTeamIds = seeding.ordered.slice(0, byeCount).map((t) => t.id);
  const playInTeams = seeding.ordered.slice(byeCount).map((t) => t.id);

  if (playInTeams.length !== 2 * playIn) {
    throw new Error(
      `knockout: play-in slice mismatch — expected ${2 * playIn} teams, got ${playInTeams.length}`,
    );
  }

  // Pair within the play-in slice using the same convention seeding.ts
  // uses for the full-bracket case: high-seed (first in slice) vs
  // low-seed (last in slice), folding inward.
  const inserts: KnockoutInsert[] = [];
  for (let i = 0; i < playIn; i++) {
    const a = playInTeams[i];
    const b = playInTeams[playInTeams.length - 1 - i] ?? null;
    inserts.push(matchInsert(i + 1, a, b));
  }

  return { inserts, byeTeamIds };
}

function matchInsert(matchNo: number, a: string | null, b: string | null): KnockoutInsert {
  if (!a && !b) {
    throw new Error("knockout: cannot create match with no teams");
  }
  if (a && b) {
    return {
      round_no: 1,
      match_no: matchNo,
      team_a_id: a,
      team_b_id: b,
      slot_a_source_type: "TEAM",
      slot_a_source_match_id: null,
      slot_b_source_type: "TEAM",
      slot_b_source_match_id: null,
      status: "SCHEDULED",
    };
  }
  // Single-team — BYE match.
  return {
    round_no: 1,
    match_no: matchNo,
    team_a_id: a ?? b!,
    team_b_id: null,
    slot_a_source_type: "TEAM",
    slot_a_source_match_id: null,
    slot_b_source_type: "BYE",
    slot_b_source_match_id: null,
    status: "BYE",
  };
}
