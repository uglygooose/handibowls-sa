// lib/tournaments/brackets/sectional.ts
//
// SKELETON. The sectional structure splits the field into groups,
// runs a round-robin within each group, then advances the top M
// (typically 1 or 2) from each section into a knockout bracket. Common
// in BSA Pro10 Pairs and similar inter-club opens.
//
// The seeding primitive (`lib/tournaments/seeding.ts:seedEntries` with
// method='sectional') already emits `section_label` per ordered team.
// This module's job is to take that and emit:
//   1. round-robin fixtures within each section (delegating to
//      `roundRobin.ts` once implemented),
//   2. a knockout cutoff that produces round-1 inserts feeding off
//      "winner-of-section-A" / "runner-up-of-section-B" pseudo-teams.
//
// Throws on call. Phase 12 (or later, depending on demand) graduates
// this to a real implementation.

import type { SeedingResult } from "@/lib/tournaments/seeding";

export type SectionalFixtures = never;

/**
 * Not yet implemented. Phase 12 or later picks this up depending on
 * whether a real tournament asks for sectional structure first.
 *
 * Search the throw message verbatim to find the upgrade point.
 */
export function generateSectionalFixtures(_seeding: SeedingResult): SectionalFixtures {
  throw new Error("Not implemented (Phase 12 or later)");
}
