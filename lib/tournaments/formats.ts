// lib/tournaments/formats.ts
//
// BSA format defaults — the per-discipline `bowlsPerPlayer`, `scoringModel`,
// and target (shots-up for singles, fixed-ends for everything else). Used by
// server actions (Phase 6d) when materialising a draft tournament and by the
// admin UI (Phase 7) to auto-fill the Rules step.
//
// Exact contents per HANDIBOWLS_REBUILD_PLAN.md §9 step 3 (lines 594–603).
// Triples is FIRST-CLASS per Q9 — not aliased to pairs or fours.

import type { Database } from "@/types/database.types";

export type TournamentFormat = Database["public"]["Enums"]["tournament_format"];

export type ScoringModel = "shots_up" | "fixed_ends";

export type FormatDefault =
  | {
      bowlsPerPlayer: number;
      scoringModel: "shots_up";
      shotsTarget: number;
    }
  | {
      bowlsPerPlayer: number;
      scoringModel: "fixed_ends";
      endsTarget: number;
    };

export const FORMAT_DEFAULTS: Record<TournamentFormat, FormatDefault> = {
  singles:     { bowlsPerPlayer: 4, scoringModel: "shots_up",   shotsTarget: 21 },
  pairs:       { bowlsPerPlayer: 3, scoringModel: "fixed_ends", endsTarget: 18 },
  triples:     { bowlsPerPlayer: 3, scoringModel: "fixed_ends", endsTarget: 18 },
  fours:       { bowlsPerPlayer: 2, scoringModel: "fixed_ends", endsTarget: 15 },
  mixed_pairs: { bowlsPerPlayer: 3, scoringModel: "fixed_ends", endsTarget: 18 },
};
