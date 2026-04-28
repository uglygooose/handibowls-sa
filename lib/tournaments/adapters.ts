// lib/tournaments/adapters.ts
//
// Pure DB-row ↔ primitive-shape converters. NO DB I/O.
//
// The primitives (`completion.ts`, `rounds.ts`, `seeding.ts`,
// `brackets/knockout.ts`, `brackets/matchHelpers.ts`, `handicap.ts`)
// were extracted from the pre-rebuild codebase, which used a different
// column-naming + status-vocabulary set than the current Phase 2 schema.
// This module is the bridge:
//   * column rename: home_team_id↔team_a_id, home_shots↔score_a,
//     round↔round_no, …
//   * status case-map: lowercase DB enum → uppercase domain string
//     (closes the 6a "lib/tournaments primitives use uppercase enum
//     vocab" drift entry)
//   * format / handicap_rule case-map: same lowercase→uppercase
//
// Reverse converters (insert specs → DB Insert shapes) are also here
// so the Phase 6d server actions can hand `INSERT INTO matches (…)`
// values straight from `rounds.advanceRound` / `knockout.generateKnockoutRound1`.

import type { Database } from "@/types/database.types";

import type { TournamentCompletionMatch } from "@/lib/tournaments/completion";
import type {
  RoundAdvanceInsert,
  RoundAdvanceMatch,
  RoundAdvanceTeam,
  SlotSourceType,
} from "@/lib/tournaments/rounds";
import type { SeedingTeam } from "@/lib/tournaments/seeding";
import type { KnockoutInsert } from "@/lib/tournaments/brackets/knockout";

// -------------------- DB row aliases --------------------

type Tables = Database["public"]["Tables"];
export type DbMatchRow = Tables["matches"]["Row"];
export type DbMatchInsert = Tables["matches"]["Insert"];
export type DbTournamentEntryRow = Tables["tournament_entries"]["Row"];
export type DbTournamentTeamRow = Tables["tournament_teams"]["Row"];

type Enums = Database["public"]["Enums"];
export type DbMatchStatus = Enums["match_status"];
export type DbTournamentFormat = Enums["tournament_format"];
export type DbHandicapRule = Enums["handicap_rule"];

// -------------------- status case-map --------------------
//
// DB enum values: scheduled | in_progress | completed | walkover | cancelled.
// Primitive uppercase values seen in the source: SCHEDULED | IN_PLAY |
// COMPLETED | FINAL | OPEN | BYE | CANCELLED.
//
// Mapping:
//   scheduled    → SCHEDULED
//   in_progress  → IN_PLAY
//   completed    → FINAL when finalized_by_admin else COMPLETED
//   walkover     → BYE
//   cancelled    → CANCELLED
//
// OPEN is a synthetic value for "match exists but no scores submitted yet"
// — primitives compute this from (status='scheduled' && !scores), it never
// comes from the DB. We don't synthesise it here; primitives that need it
// derive it themselves.

export type PrimitiveMatchStatus =
  | "SCHEDULED"
  | "IN_PLAY"
  | "COMPLETED"
  | "FINAL"
  | "BYE"
  | "CANCELLED";

export function dbStatusToPrimitive(
  status: DbMatchStatus,
  finalizedByAdmin: boolean,
): PrimitiveMatchStatus {
  switch (status) {
    case "scheduled":
      return "SCHEDULED";
    case "in_progress":
      return "IN_PLAY";
    case "completed":
      return finalizedByAdmin ? "FINAL" : "COMPLETED";
    case "walkover":
      return "BYE";
    case "cancelled":
      return "CANCELLED";
  }
}

/** Reverse map: primitive uppercase → DB enum value. Used when an action
 *  builds an INSERT/UPDATE from a primitive's status output. FINAL collapses
 *  back to 'completed' (the finalized_by_admin column carries the admin
 *  override semantics on the DB side). */
export function primitiveStatusToDb(
  status: PrimitiveMatchStatus | "OPEN",
): { status: DbMatchStatus; finalizedByAdmin: boolean } {
  switch (status) {
    case "SCHEDULED":
      return { status: "scheduled", finalizedByAdmin: false };
    case "IN_PLAY":
      return { status: "in_progress", finalizedByAdmin: false };
    case "COMPLETED":
      return { status: "completed", finalizedByAdmin: false };
    case "FINAL":
      return { status: "completed", finalizedByAdmin: true };
    case "BYE":
      return { status: "walkover", finalizedByAdmin: false };
    case "CANCELLED":
      return { status: "cancelled", finalizedByAdmin: false };
    case "OPEN":
      // OPEN is the "scheduled and accepting score submissions" variant of
      // SCHEDULED. The DB doesn't distinguish — collapse to scheduled.
      return { status: "scheduled", finalizedByAdmin: false };
  }
}

// -------------------- format + handicap_rule case-maps --------------------
//
// handicap.ts and labels.ts compare against uppercase variants like
// "SINGLES" / "SCRATCH" / "HANDICAP_START". DB enum is lowercase.

export type PrimitiveTournamentFormat =
  | "SINGLES"
  | "PAIRS"
  | "TRIPLES"
  | "FOURS"
  | "MIXED_PAIRS";

export function dbFormatToPrimitive(format: DbTournamentFormat): PrimitiveTournamentFormat {
  switch (format) {
    case "singles":     return "SINGLES";
    case "pairs":       return "PAIRS";
    case "triples":     return "TRIPLES";
    case "fours":       return "FOURS";
    case "mixed_pairs": return "MIXED_PAIRS";
  }
}

export type PrimitiveHandicapRule = "SCRATCH" | "HANDICAP_START";

export function dbHandicapRuleToPrimitive(rule: DbHandicapRule): PrimitiveHandicapRule {
  switch (rule) {
    case "scratch":        return "SCRATCH";
    case "handicap_start": return "HANDICAP_START";
  }
}

// -------------------- match row → primitive shape --------------------
//
// Returns the "fat" intersection-compatible shape that satisfies all of
// TournamentCompletionMatch, RoundAdvanceMatch, and the BracketTree /
// matchHelpers structural types. Callers narrow via TypeScript structural
// typing; one adapter keeps the conversion canonical.

export type PrimitiveMatch = {
  id: string;
  round_no: number | null;
  match_no: number | null;
  status: PrimitiveMatchStatus;
  finalized_by_admin: boolean;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
  winner_team_id: string | null;
  slot_a_source_type: string | null;
  slot_a_source_match_id: string | null;
  slot_b_source_type: string | null;
  slot_b_source_match_id: string | null;
};

export function matchRowToPrimitive(row: DbMatchRow): PrimitiveMatch {
  return {
    id: row.id,
    round_no: row.round,
    match_no: row.match_no,
    status: dbStatusToPrimitive(row.status, row.finalized_by_admin),
    finalized_by_admin: row.finalized_by_admin,
    team_a_id: row.home_team_id,
    team_b_id: row.away_team_id,
    score_a: row.home_shots,
    score_b: row.away_shots,
    winner_team_id: row.winner_team_id,
    slot_a_source_type: row.slot_a_source_type,
    slot_a_source_match_id: row.slot_a_source_match_id,
    slot_b_source_type: row.slot_b_source_type,
    slot_b_source_match_id: row.slot_b_source_match_id,
  };
}

// Type-narrowed re-exports per primitive consumer. PrimitiveMatch is
// structurally compatible with each — these just tighten the public
// signature so callers don't accidentally pass a partial.
export const matchRowToCompletionMatch: (row: DbMatchRow) => TournamentCompletionMatch =
  matchRowToPrimitive;
export const matchRowToRoundAdvanceMatch: (row: DbMatchRow) => RoundAdvanceMatch =
  matchRowToPrimitive;

// -------------------- team / entry row → primitive --------------------
//
// `RoundAdvanceTeam` needs `id + team_no`. The new schema has `seed integer`
// on tournament_teams, which serves the same purpose (stable bracket ordering).
// Treat `seed` as the source of truth; null seeds collapse to a sentinel
// large value so unseeded teams sort to the bottom — matching rounds.ts'
// existing 999_999 fallback for `Number.isFinite(slot)` failure.

const UNSEEDED_FALLBACK = 999_999;

export function teamRowToRoundAdvanceTeam(row: DbTournamentTeamRow): RoundAdvanceTeam {
  return {
    id: row.id,
    team_no: row.seed ?? UNSEEDED_FALLBACK,
  };
}

/** Pre-draw seeding works on `tournament_entries`; team-formation happens
 *  at draw time. seedEntries returns SeedingTeam shapes, the action layer
 *  then materialises tournament_teams from the result. */
export function entryRowToSeedingTeam(row: DbTournamentEntryRow): SeedingTeam {
  return {
    id: row.id,
    seed: row.seed,
  };
}

/** Post-draw, when round-2+ advancement reads team identity from
 *  tournament_teams, this is what seeding consumes. */
export function teamRowToSeedingTeam(row: DbTournamentTeamRow): SeedingTeam {
  return {
    id: row.id,
    seed: row.seed,
  };
}

// -------------------- primitive insert spec → DB Insert --------------------
//
// rounds.advanceRound and brackets.generateKnockoutRound1 emit insert specs
// that don't carry a tournament_id (the action layer attaches it). These
// reverse adapters do the column rename + status case-map back to the DB
// vocabulary so an action can call .insert(...) directly.

export function roundAdvanceInsertToMatchInsert(
  insert: RoundAdvanceInsert,
  tournamentId: string,
): DbMatchInsert {
  const { status, finalizedByAdmin } = primitiveStatusToDb(insert.status);
  return {
    tournament_id: tournamentId,
    round: insert.round_no,
    match_no: insert.match_no,
    home_team_id: insert.team_a_id,
    away_team_id: insert.team_b_id,
    slot_a_source_type: nullableSlotSource(insert.slot_a_source_type),
    slot_a_source_match_id: insert.slot_a_source_match_id,
    slot_b_source_type: nullableSlotSource(insert.slot_b_source_type),
    slot_b_source_match_id: insert.slot_b_source_match_id,
    status,
    finalized_by_admin: finalizedByAdmin,
  };
}

export function knockoutInsertToMatchInsert(
  insert: KnockoutInsert,
  tournamentId: string,
): DbMatchInsert {
  const { status, finalizedByAdmin } = primitiveStatusToDb(insert.status);
  return {
    tournament_id: tournamentId,
    round: insert.round_no,
    match_no: insert.match_no,
    home_team_id: insert.team_a_id,
    away_team_id: insert.team_b_id,
    slot_a_source_type: nullableSlotSource(insert.slot_a_source_type),
    slot_a_source_match_id: insert.slot_a_source_match_id,
    slot_b_source_type: nullableSlotSource(insert.slot_b_source_type),
    slot_b_source_match_id: insert.slot_b_source_match_id,
    status,
    finalized_by_admin: finalizedByAdmin,
  };
}

function nullableSlotSource(
  value: SlotSourceType | "BYE" | null,
): string | null {
  return value === null ? null : value;
}
