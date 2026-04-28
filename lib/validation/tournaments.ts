// lib/validation/tournaments.ts
//
// Zod schemas for the 10 server-action scaffolds in
// `app/(club-admin)/manage/tournaments/_actions.ts` +
// `app/(super-admin)/platform/tournaments/_actions.ts`.
//
// Enum string sets line up with Phase 2 schema (lowercase). Adapter
// case-mapping (`lib/tournaments/adapters.ts`) handles the lowercase ↔
// uppercase translation for the primitives.

import { z } from "zod";

// -------------------- enum aliases --------------------

export const TOURNAMENT_FORMATS = [
  "singles",
  "pairs",
  "triples",
  "fours",
  "mixed_pairs",
] as const;
export const TOURNAMENT_STRUCTURES = [
  "knockout",
  "round_robin",
  "sectional",
  "drawn_social",
] as const;
export const TOURNAMENT_SCOPES = ["club", "district", "provincial", "national"] as const;
export const CATEGORIES = ["men", "women", "mixed", "open"] as const;
export const AGE_GROUPS = ["open", "veteran", "junior", "u35"] as const;
export const HANDICAP_RULES = ["scratch", "handicap_start"] as const;
export const SEEDING_METHODS = ["random", "seeded", "sectional"] as const;

// -------------------- shared building blocks --------------------

const uuid = z.string().uuid();
const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().nonnegative();
const tournamentName = z.string().trim().min(2).max(120);

// -------------------- createTournament --------------------

export const createTournamentSchema = z
  .object({
    host_club_id: uuid,
    name: tournamentName,
    scope: z.enum(TOURNAMENT_SCOPES).default("club"),
    format: z.enum(TOURNAMENT_FORMATS),
    structure: z.enum(TOURNAMENT_STRUCTURES),
    category: z.enum(CATEGORIES).default("open"),
    age_group: z.enum(AGE_GROUPS).default("open"),
    handicap_rule: z.enum(HANDICAP_RULES).default("scratch"),
    seeding_method: z.enum(SEEDING_METHODS).default("random"),
    starts_at: z.string().datetime().nullable().optional(),
    ends_at: z.string().datetime().nullable().optional(),
    entries_close_at: z.string().datetime().nullable().optional(),
    max_entries: positiveInt.nullable().optional(),
    ends_per_match: positiveInt.nullable().optional(),
    shots_up_target: positiveInt.nullable().optional(),
  })
  .refine(
    (v) =>
      !v.starts_at || !v.ends_at || new Date(v.ends_at) >= new Date(v.starts_at),
    { message: "ends_at must be on or after starts_at", path: ["ends_at"] },
  );

// `z.input` (not `z.infer`) so callers can omit fields with `.default()`.
// The defaulted fields are optional from the caller's POV and required
// in the parsed output — Zod 4's `infer` returns the output type by
// default, hence the explicit `input` here.
export type CreateTournamentInput = z.input<typeof createTournamentSchema>;

// -------------------- closeEntries / completeTournament / cancelTournament --------------------

export const tournamentIdSchema = z.object({ tournament_id: uuid });
export type TournamentIdInput = z.infer<typeof tournamentIdSchema>;

export const cancelTournamentSchema = z.object({
  tournament_id: uuid,
  reason: z.string().trim().max(500).optional(),
});
export type CancelTournamentInput = z.infer<typeof cancelTournamentSchema>;

// -------------------- seedEntries / generateBracket --------------------

// Both consume just the tournament id; the seeding method + structure are
// read off the tournament row server-side.
export const seedEntriesSchema = tournamentIdSchema;
export type SeedEntriesInput = TournamentIdInput;

export const generateBracketSchema = tournamentIdSchema;
export type GenerateBracketInput = TournamentIdInput;

// -------------------- advanceRound --------------------

export const advanceRoundSchema = z.object({
  tournament_id: uuid,
  round_no: positiveInt,
});
export type AdvanceRoundInput = z.infer<typeof advanceRoundSchema>;

// -------------------- match score actions --------------------

const matchScores = z.object({
  home_shots: nonNegativeInt,
  away_shots: nonNegativeInt,
});

export const submitMatchSchema = matchScores.extend({
  match_id: uuid,
});
export type SubmitMatchInput = z.infer<typeof submitMatchSchema>;

export const confirmMatchSchema = z.object({ match_id: uuid });
export type ConfirmMatchInput = z.infer<typeof confirmMatchSchema>;

// Admin verification — optionally lets the admin override the submitted
// scores. When override fields are absent, the existing scores are preserved.
export const verifyMatchSchema = z.object({
  match_id: uuid,
  override_home_shots: nonNegativeInt.optional(),
  override_away_shots: nonNegativeInt.optional(),
});
export type VerifyMatchInput = z.infer<typeof verifyMatchSchema>;

// -------------------- bulk scoring --------------------

const matchScorePatch = z.object({
  match_id: uuid,
  home_shots: nonNegativeInt,
  away_shots: nonNegativeInt,
});

export const bulkSaveMatchScoresSchema = z.object({
  tournament_id: uuid,
  matches: z.array(matchScorePatch).min(1).max(200),
});
export type BulkSaveMatchScoresInput = z.infer<typeof bulkSaveMatchScoresSchema>;

export const finalizeMatchesBatchSchema = z.object({
  tournament_id: uuid,
  matches: z.array(matchScorePatch).min(1).max(200),
});
export type FinalizeMatchesBatchInput = z.infer<typeof finalizeMatchesBatchSchema>;
