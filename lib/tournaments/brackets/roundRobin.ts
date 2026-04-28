// lib/tournaments/brackets/roundRobin.ts
//
// SKELETON. The public API mirrors `knockout.ts:generateKnockoutRound1`
// — a generator that consumes a `SeedingResult` and returns insert specs
// the action layer can hand to `lib/tournaments/adapters.ts:
// roundAdvanceInsertToMatchInsert`. Implementation deferred.
//
// Round-robin = every team plays every other team once. For N teams,
// the schedule has N-1 rounds (or N rounds with a BYE for odd N) and
// N*(N-1)/2 total matches. Standard rotation algorithm: fix team 1 at
// the head, rotate remaining teams clockwise across rounds.
//
// Throws on call so the round-trip stays type-checked but no caller can
// silently produce empty fixtures. Graduates to a real implementation
// when a Phase 7+ admin UI creates a round-robin tournament. Until then
// an action that hits this primitive must short-circuit before invoking.

import type { SeedingResult } from "@/lib/tournaments/seeding";

export type RoundRobinFixtures = never;

/**
 * Not yet implemented. Phase 12 cross-cutting picks this up unless an
 * earlier phase needs it (e.g., a Phase 7 admin creating a round-robin
 * event surfaces the need to graduate this skeleton).
 *
 * Search the throw message verbatim to find the upgrade point.
 */
export function generateRoundRobinFixtures(_seeding: SeedingResult): RoundRobinFixtures {
  throw new Error("Not implemented (Phase 12 cross-cutting)");
}
