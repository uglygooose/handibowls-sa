"use server";

// Phase 6d — Tournament server-action scaffolds (club-admin route group).
//
// 10 actions wiring auth gates → Zod validation → adapters → primitives →
// DB writes. The corresponding admin UI lands in Phase 7; until then, no
// caller exercises these (the (super-admin) mirror in
// `app/(super-admin)/platform/tournaments/_actions.ts` re-exports with
// super-admin-only auth gates).
//
// Conventions (mirroring existing lib/club/actions.ts + lib/invites/actions.ts):
//   • Result type: { ok: true; data: T } | { ok: false; error; fieldErrors? }
//   • Auth gate before Zod, since "Not authenticated" is cheaper to detect.
//   • Tournament-owner check: super_admin OR (club_admin AND host_club_id ∈ ctx.clubIds).
//   • Player-on-match check: ctx.userId is in either team's tournament_team_members.
//   • All field renames + status case-maps go through `lib/tournaments/adapters.ts`.

import { revalidatePath } from "next/cache";

import { getAuthContext, type AuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import {
  matchRowToRoundAdvanceMatch,
  teamRowToRoundAdvanceTeam,
  entryRowToSeedingTeam,
  roundAdvanceInsertToMatchInsert,
  knockoutInsertToMatchInsert,
} from "@/lib/tournaments/adapters";
import { generateKnockoutRound1 } from "@/lib/tournaments/brackets/knockout";
import { generateRoundRobinFixtures } from "@/lib/tournaments/brackets/roundRobin";
import { generateSectionalFixtures } from "@/lib/tournaments/brackets/sectional";
import { completeTournamentIfDone } from "@/lib/tournaments/completion";
import { revalidateMatchSurfaces } from "@/lib/tournaments/revalidate";
import { advanceRound as advanceRoundPrimitive } from "@/lib/tournaments/rounds";
import { seedEntries as seedEntriesPrimitive } from "@/lib/tournaments/seeding";
import {
  advanceRoundSchema,
  bulkSaveMatchScoresSchema,
  cancelTournamentSchema,
  confirmMatchSchema,
  createTournamentSchema,
  finalizeMatchesBatchSchema,
  generateBracketSchema,
  seedEntriesSchema,
  submitMatchSchema,
  tournamentIdSchema,
  verifyMatchSchema,
  type AdvanceRoundInput,
  type BulkSaveMatchScoresInput,
  type CancelTournamentInput,
  type ConfirmMatchInput,
  type CreateTournamentInput,
  type FinalizeMatchesBatchInput,
  type GenerateBracketInput,
  type SeedEntriesInput,
  type SubmitMatchInput,
  type TournamentIdInput,
  type VerifyMatchInput,
} from "@/lib/validation/tournaments";

// -------------------- result type --------------------

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const NOT_AUTHENTICATED = { ok: false as const, error: "Not authenticated." };
const NOT_AUTHORIZED = (msg = "Not authorized.") =>
  ({ ok: false as const, error: msg });

// -------------------- shared auth helper --------------------
//
// Loads a tournament row, returns it alongside the auth context. Used by
// every action that operates on an existing tournament. super_admin can
// touch any tournament; club_admin only those scoped to a club they admin.

type TournamentOwnerGate =
  | { ok: true; ctx: AuthContext; tournament: TournamentScopeRow }
  | { ok: false; error: string };

type TournamentScopeRow = {
  id: string;
  host_club_id: string;
  status: string;
  scope: string;
  format: string;
  structure: string;
  seeding_method: string;
  handicap_rule: string;
};

async function authForTournament(tournamentId: string): Promise<TournamentOwnerGate> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: NOT_AUTHENTICATED.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      "id, host_club_id, status, scope, format, structure, seeding_method, handicap_rule",
    )
    .eq("id", tournamentId)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Tournament not found." };
  }

  const allowed =
    ctx.role === "super_admin" ||
    (ctx.role === "club_admin" && ctx.clubIds.includes(data.host_club_id));
  if (!allowed) return { ok: false, error: "Not authorized for this tournament." };

  return { ok: true, ctx, tournament: data };
}

// -------------------- 1. createTournament --------------------

export async function createTournament(
  input: CreateTournamentInput,
): Promise<ActionResult<{ tournament_id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_AUTHENTICATED;

  const parsed = createTournamentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const v = parsed.data;

  const allowed =
    ctx.role === "super_admin" ||
    (ctx.role === "club_admin" && ctx.clubIds.includes(v.host_club_id));
  if (!allowed) return NOT_AUTHORIZED("Not authorized to create on this club.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      host_club_id: v.host_club_id,
      name: v.name,
      scope: v.scope,
      format: v.format,
      structure: v.structure,
      category: v.category,
      age_group: v.age_group,
      handicap_rule: v.handicap_rule,
      seeding_method: v.seeding_method,
      starts_at: v.starts_at ?? null,
      ends_at: v.ends_at ?? null,
      entries_close_at: v.entries_close_at ?? null,
      max_entries: v.max_entries ?? null,
      ends_per_match: v.ends_per_match ?? null,
      shots_up_target: v.shots_up_target ?? null,
      created_by: ctx.userId,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create tournament." };
  }

  revalidatePath("/manage/tournaments", "page");
  return { ok: true, data: { tournament_id: data.id } };
}

// -------------------- 2. closeEntries --------------------

export async function closeEntries(
  input: TournamentIdInput,
): Promise<ActionResult<{ entries_close_at: string }>> {
  const parsed = tournamentIdSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const gate = await authForTournament(parsed.data.tournament_id);
  if (!gate.ok) return gate;

  if (gate.tournament.status !== "open" && gate.tournament.status !== "draft") {
    return { ok: false, error: `Tournament is ${gate.tournament.status}; cannot close entries.` };
  }

  const closedAt = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ entries_close_at: closedAt })
    .eq("id", parsed.data.tournament_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/manage/tournaments/${parsed.data.tournament_id}`, "page");
  return { ok: true, data: { entries_close_at: closedAt } };
}

// -------------------- 3. seedEntries --------------------

export async function seedEntries(
  input: SeedEntriesInput,
): Promise<ActionResult<{ teams_created: number }>> {
  const parsed = seedEntriesSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const gate = await authForTournament(parsed.data.tournament_id);
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const { data: entries, error: entriesErr } = await supabase
    .from("tournament_entries")
    .select("id, tournament_id, club_id, profile_id, team_name, seed, withdrawn, notes, created_at, updated_at")
    .eq("tournament_id", parsed.data.tournament_id)
    .eq("withdrawn", false);

  if (entriesErr) return { ok: false, error: entriesErr.message };
  if (!entries || entries.length === 0) {
    return { ok: false, error: "No active entries to seed." };
  }

  const seedingTeams = entries.map(entryRowToSeedingTeam);
  const result = seedEntriesPrimitive({
    method: gate.tournament.seeding_method as "random" | "seeded" | "sectional",
    teams: seedingTeams,
  });

  // Materialise tournament_teams from the seeding ordered list. One row per
  // ordered entry; section_label carries through from sectional method;
  // `seed` is the primitive's 1..N ordering position.
  const inserts = result.ordered.map((t) => ({
    tournament_id: parsed.data.tournament_id,
    club_id: entries.find((e) => e.id === t.id)?.club_id ?? null,
    seed: t.seed,
    section_label: t.section_label,
  }));

  const { data: created, error: insertErr } = await supabase
    .from("tournament_teams")
    .insert(inserts)
    .select("id");

  if (insertErr) return { ok: false, error: insertErr.message };

  revalidatePath(`/manage/tournaments/${parsed.data.tournament_id}`, "page");
  return { ok: true, data: { teams_created: (created ?? []).length } };
}

// -------------------- 4. generateBracket --------------------

export async function generateBracket(
  input: GenerateBracketInput,
): Promise<ActionResult<{ matches_created: number; bye_team_count: number }>> {
  const parsed = generateBracketSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const gate = await authForTournament(parsed.data.tournament_id);
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const { data: teams, error: teamsErr } = await supabase
    .from("tournament_teams")
    .select("id, tournament_id, club_id, name, seed, section_label, handicap_shots, withdrawn, created_at, updated_at")
    .eq("tournament_id", parsed.data.tournament_id)
    .eq("withdrawn", false)
    .order("seed", { ascending: true, nullsFirst: false });

  if (teamsErr) return { ok: false, error: teamsErr.message };
  if (!teams || teams.length === 0) {
    return { ok: false, error: "No teams to bracket. Run seedEntries first." };
  }

  // Pre-build the seeding result shape that knockout/roundRobin/sectional
  // primitives expect. Method 'seeded' here means "use existing seed values
  // as-is" — the seedEntries action already sorted them.
  const seedingResult = {
    ordered: teams.map((t) => ({
      id: t.id,
      seed: t.seed ?? 0,
      section_label: t.section_label,
    })),
    pairings: pairAdjacent(teams.map((t) => t.id)),
  };

  switch (gate.tournament.structure) {
    case "knockout": {
      const out = generateKnockoutRound1(seedingResult);
      if (!out) return { ok: false, error: "Knockout generator returned null." };

      if (out.inserts.length === 0) {
        return { ok: true, data: { matches_created: 0, bye_team_count: out.byeTeamIds.length } };
      }

      const dbInserts = out.inserts.map((i) =>
        knockoutInsertToMatchInsert(i, parsed.data.tournament_id),
      );
      const { data: created, error: insErr } = await supabase
        .from("matches")
        .insert(dbInserts)
        .select("id");
      if (insErr) return { ok: false, error: insErr.message };

      // Move tournament status to 'in_progress' now that fixtures exist.
      await supabase
        .from("tournaments")
        .update({ status: "in_progress" })
        .eq("id", parsed.data.tournament_id)
        .eq("status", "open");

      revalidateMatchSurfaces(parsed.data.tournament_id);
      return {
        ok: true,
        data: { matches_created: (created ?? []).length, bye_team_count: out.byeTeamIds.length },
      };
    }
    case "round_robin": {
      // Skeleton — throws "Not implemented (Phase 12 cross-cutting)".
      generateRoundRobinFixtures(seedingResult);
      return { ok: false, error: "Round-robin not implemented yet." };
    }
    case "sectional": {
      // Skeleton — throws "Not implemented (Phase 12 or later)".
      generateSectionalFixtures(seedingResult);
      return { ok: false, error: "Sectional not implemented yet." };
    }
    case "drawn_social": {
      return { ok: false, error: "Drawn/social tournaments don't generate brackets." };
    }
    default:
      return { ok: false, error: `Unknown structure: ${gate.tournament.structure}` };
  }
}

// -------------------- 5. advanceRound --------------------

export async function advanceRound(
  input: AdvanceRoundInput,
): Promise<
  ActionResult<
    | { kind: "tournamentComplete"; champion_team_id: string | null }
    | { kind: "nextRound"; matches_created: number; next_round: number }
  >
> {
  const parsed = advanceRoundSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const gate = await authForTournament(parsed.data.tournament_id);
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const { data: matches, error: mErr } = await supabase
    .from("matches")
    .select(
      "id, tournament_id, home_team_id, away_team_id, home_shots, away_shots, home_ends_won, away_ends_won, rink_id, round, bracket_slot, section_label, status, starts_at, ends_at, winner_team_id, notes, match_no, finalized_by_admin, slot_a_source_type, slot_a_source_match_id, slot_b_source_type, slot_b_source_match_id, submission_status, captain_submitted_at, opponent_confirmed_at, created_at, updated_at",
    )
    .eq("tournament_id", parsed.data.tournament_id)
    .eq("round", parsed.data.round_no);

  if (mErr) return { ok: false, error: mErr.message };
  if (!matches || matches.length === 0) {
    return { ok: false, error: `No matches found in round ${parsed.data.round_no}.` };
  }

  const { data: teams, error: tErr } = await supabase
    .from("tournament_teams")
    .select("id, tournament_id, club_id, name, seed, section_label, handicap_shots, withdrawn, created_at, updated_at")
    .eq("tournament_id", parsed.data.tournament_id)
    .eq("withdrawn", false);

  if (tErr) return { ok: false, error: tErr.message };

  const result = advanceRoundPrimitive({
    roundNo: parsed.data.round_no,
    roundMatches: (matches ?? []).map(matchRowToRoundAdvanceMatch),
    teams: (teams ?? []).map(teamRowToRoundAdvanceTeam),
  });

  if (result.kind === "incomplete") {
    return { ok: false, error: result.reason };
  }

  if (result.kind === "tournamentComplete") {
    await completeTournamentIfDone({ supabase, tournamentId: parsed.data.tournament_id });
    revalidateMatchSurfaces(parsed.data.tournament_id);
    return {
      ok: true,
      data: { kind: "tournamentComplete", champion_team_id: result.championTeamId },
    };
  }

  // result.kind === "nextRound"
  const dbInserts = result.inserts.map((i) =>
    roundAdvanceInsertToMatchInsert(i, parsed.data.tournament_id),
  );
  const { data: created, error: insErr } = await supabase
    .from("matches")
    .insert(dbInserts)
    .select("id");
  if (insErr) return { ok: false, error: insErr.message };

  revalidateMatchSurfaces(parsed.data.tournament_id);
  return {
    ok: true,
    data: {
      kind: "nextRound",
      matches_created: (created ?? []).length,
      next_round: result.nextRoundNo,
    },
  };
}

// -------------------- 6. submitMatch --------------------

export async function submitMatch(
  input: SubmitMatchInput,
): Promise<ActionResult<{ match_id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_AUTHENTICATED;

  const parsed = submitMatchSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const v = parsed.data;

  const supabase = await createClient();
  const { data: match, error } = await supabase
    .from("matches")
    .select("id, tournament_id, home_team_id, away_team_id, status, submission_status")
    .eq("id", v.match_id)
    .single();
  if (error || !match) {
    return { ok: false, error: error?.message ?? "Match not found." };
  }

  // Auth: super_admin / club_admin owning the host club / a player on either team.
  const allowed = await isPlayerOnMatchOrAdmin(ctx, match);
  if (!allowed) return NOT_AUTHORIZED();

  // Phase 8d-prep: submission lifecycle. submitMatch is the captain's
  // post-game score post. It moves the match to in_progress (if it
  // wasn't already) and pins submission_status to 'captain_submitted'.
  // Re-submission while still 'captain_submitted' is allowed (captain
  // edits before opponent confirms) — scores update on each call but
  // captain_submitted_at is FROZEN to first-submission time per the
  // Phase 8d audit-trail contract. Migration 028's
  // matches_participant_update_guard trigger preserves OLD.captain_submitted_at
  // on re-submit; this action only seeds the timestamp on the first
  // transition (pending → captain_submitted) so action and trigger
  // agree explicitly. Re-submission after 'opponent_confirmed' is
  // rejected; admin override via verifyMatch is the escape hatch.
  if (match.submission_status === "opponent_confirmed") {
    return {
      ok: false,
      error:
        "Match already confirmed by opponent — captain can't resubmit. Ask the admin to verify with override values if scores need correcting.",
    };
  }

  const isFirstSubmission = match.submission_status === "pending";
  const { error: upErr } = await supabase
    .from("matches")
    .update({
      home_shots: v.home_shots,
      away_shots: v.away_shots,
      status: "in_progress",
      submission_status: "captain_submitted",
      // Only seed the audit timestamp on the first transition. On
      // re-submit (submission_status already 'captain_submitted'), the
      // trigger would silently restore OLD anyway — making the action
      // explicit avoids a misleading write that gets discarded.
      ...(isFirstSubmission
        ? { captain_submitted_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", v.match_id);

  if (upErr) return { ok: false, error: upErr.message };

  revalidateMatchSurfaces(match.tournament_id, v.match_id);
  return { ok: true, data: { match_id: v.match_id } };
}

// -------------------- 7. confirmMatch --------------------

export async function confirmMatch(
  input: ConfirmMatchInput,
): Promise<ActionResult<{ match_id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_AUTHENTICATED;

  const parsed = confirmMatchSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data: match, error } = await supabase
    .from("matches")
    .select("id, tournament_id, home_team_id, away_team_id, home_shots, away_shots, status, submission_status")
    .eq("id", parsed.data.match_id)
    .single();
  if (error || !match) {
    return { ok: false, error: error?.message ?? "Match not found." };
  }

  const allowed = await isPlayerOnMatchOrAdmin(ctx, match);
  if (!allowed) return NOT_AUTHORIZED();

  // Phase 8d-prep contract change: confirmMatch no longer collapses to
  // status='completed'. It transitions submission_status from
  // 'captain_submitted' to 'opponent_confirmed' — the intermediate
  // state is meaningful: the players agree but admin verification is
  // still required before the match is final. verifyMatch is the only
  // path that sets status='completed' + finalized_by_admin=true.
  //
  // Precondition: the match must be in 'captain_submitted'. If still
  // 'pending' nobody has submitted yet; if already 'opponent_confirmed'
  // it's a no-op duplicate confirm.
  if (match.submission_status !== "captain_submitted") {
    return {
      ok: false,
      error:
        match.submission_status === "pending"
          ? "Captain hasn't submitted scores yet — nothing to confirm."
          : "Match already confirmed; awaiting admin verification.",
    };
  }

  // Pre-compute the winner so the DB row already reflects the
  // captains' agreed result. verifyMatch may overwrite this if the
  // admin uses override scores.
  //
  // Migration 028's matches_participant_update_guard trigger:
  //   • Allows winner_team_id writes ONLY on this exact
  //     captain_submitted → opponent_confirmed transition (carve-out)
  //   • Preserves opponent_confirmed_at if it's already set — but the
  //     precondition above guarantees OLD is null when this UPDATE
  //     runs, so the now() seed is the first-transition value (correct).
  const winnerTeamId = inferWinnerFromScores(match);

  const { error: upErr } = await supabase
    .from("matches")
    .update({
      submission_status: "opponent_confirmed",
      opponent_confirmed_at: new Date().toISOString(),
      winner_team_id: winnerTeamId,
    })
    .eq("id", parsed.data.match_id);

  if (upErr) return { ok: false, error: upErr.message };

  revalidateMatchSurfaces(match.tournament_id, parsed.data.match_id);
  return { ok: true, data: { match_id: parsed.data.match_id } };
}

// -------------------- 8. verifyMatch (admin-final) --------------------

export async function verifyMatch(
  input: VerifyMatchInput,
): Promise<ActionResult<{ match_id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx) return NOT_AUTHENTICATED;

  const parsed = verifyMatchSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const v = parsed.data;

  const supabase = await createClient();
  const { data: match, error } = await supabase
    .from("matches")
    .select(
      "id, tournament_id, home_team_id, away_team_id, home_shots, away_shots, status, submission_status",
    )
    .eq("id", v.match_id)
    .single();
  if (error || !match) {
    return { ok: false, error: error?.message ?? "Match not found." };
  }

  // Admin-only — verifyMatch is the FINAL signoff. Player-confirm goes
  // through confirmMatch; this is one tier up.
  const adminAllowed =
    ctx.role === "super_admin" ||
    (ctx.role === "club_admin" &&
      (await tournamentBelongsToAdminClubs(supabase, match.tournament_id, ctx)));
  if (!adminAllowed) return NOT_AUTHORIZED("Admin verification only.");

  // Phase 8d-prep submission lifecycle precondition.
  //
  // Default path — no override scores:
  //   submission_status MUST be 'opponent_confirmed'. Captains have
  //   agreed; admin is the final signoff before the match is locked.
  //
  // Override path — override_home_shots / override_away_shots provided:
  //   The admin is resolving a dispute. Precondition relaxes — admin
  //   may verify even if submission_status is 'pending' (no captain
  //   ever submitted) or 'captain_submitted' (opponent never confirmed).
  //   This is the explicit dispute-resolution / abandoned-match
  //   workflow. The CHECK constraint on the matches table is satisfied
  //   by setting both timestamps to now() when they're not already
  //   populated, so submission_status can move to 'opponent_confirmed'
  //   in lock-step.
  const hasOverride =
    v.override_home_shots != null || v.override_away_shots != null;

  if (!hasOverride && match.submission_status !== "opponent_confirmed") {
    return {
      ok: false,
      error:
        match.submission_status === "pending"
          ? "Match isn't yet submitted by either captain. Use override scores to verify directly."
          : "Opponent hasn't confirmed yet. Wait for confirmation, or use override scores to resolve a dispute.",
    };
  }

  const finalShots = {
    home: v.override_home_shots ?? match.home_shots,
    away: v.override_away_shots ?? match.away_shots,
  };

  // When the override path is used and the lifecycle wasn't fully
  // walked, force submission_status forward + populate any missing
  // audit timestamps so the CHECK constraint is satisfied. Existing
  // 'opponent_confirmed' rows keep their original timestamps.
  const nowIso = new Date().toISOString();
  const baseUpdates = {
    home_shots: finalShots.home,
    away_shots: finalShots.away,
    status: "completed" as const,
    finalized_by_admin: true,
    winner_team_id: inferWinnerFromScores({
      home_team_id: match.home_team_id,
      away_team_id: match.away_team_id,
      home_shots: finalShots.home,
      away_shots: finalShots.away,
    }),
  };
  const updates: Database["public"]["Tables"]["matches"]["Update"] =
    match.submission_status !== "opponent_confirmed"
      ? {
          ...baseUpdates,
          submission_status: "opponent_confirmed",
          // Both timestamps must be set per the matches_submission_consistent
          // CHECK constraint. Use now() — for legacy/override paths this is
          // the admin's verdict timestamp.
          captain_submitted_at: nowIso,
          opponent_confirmed_at: nowIso,
        }
      : baseUpdates;

  const { error: upErr } = await supabase
    .from("matches")
    .update(updates)
    .eq("id", v.match_id);

  if (upErr) return { ok: false, error: upErr.message };

  // Verifying the final match may complete the tournament.
  await completeTournamentIfDone({ supabase, tournamentId: match.tournament_id });

  revalidateMatchSurfaces(match.tournament_id, v.match_id);
  return { ok: true, data: { match_id: v.match_id } };
}

// -------------------- 9. completeTournament --------------------

export async function completeTournament(
  input: TournamentIdInput,
): Promise<ActionResult<{ completed: boolean; already_completed: boolean }>> {
  const parsed = tournamentIdSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const gate = await authForTournament(parsed.data.tournament_id);
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const alreadyCompleted = gate.tournament.status === "completed";

  const result = await completeTournamentIfDone({
    supabase,
    tournamentId: parsed.data.tournament_id,
  });

  if (!result.attempted && !alreadyCompleted) {
    return { ok: false, error: "Final not complete (winner required before completing)." };
  }
  if (!result.completed && !alreadyCompleted) {
    return { ok: false, error: result.error ?? "Could not complete tournament." };
  }

  revalidateMatchSurfaces(parsed.data.tournament_id);
  return {
    ok: true,
    data: {
      completed: alreadyCompleted ? true : result.completed,
      already_completed: alreadyCompleted,
    },
  };
}

// -------------------- 11. bulkSaveMatchScores --------------------

export async function bulkSaveMatchScores(
  input: BulkSaveMatchScoresInput,
): Promise<ActionResult<{ updated_count: number }>> {
  const parsed = bulkSaveMatchScoresSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const gate = await authForTournament(parsed.data.tournament_id);
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bulk_save_match_scores_batch", {
    p_tournament_id: parsed.data.tournament_id,
    p_matches: parsed.data.matches.map((m) => ({
      match_id: m.match_id,
      score_a: m.home_shots,
      score_b: m.away_shots,
    })),
  });

  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; updated_count: number } | null;
  if (!result?.ok) return { ok: false, error: "RPC returned no result." };

  revalidateMatchSurfaces(parsed.data.tournament_id);
  return { ok: true, data: { updated_count: result.updated_count } };
}

// -------------------- 12. finalizeMatchesBatch --------------------

export async function finalizeMatchesBatch(
  input: FinalizeMatchesBatchInput,
): Promise<ActionResult<{ updated_count: number }>> {
  const parsed = finalizeMatchesBatchSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const gate = await authForTournament(parsed.data.tournament_id);
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_finalize_matches_batch", {
    p_tournament_id: parsed.data.tournament_id,
    p_matches: parsed.data.matches.map((m) => ({
      match_id: m.match_id,
      score_a: m.home_shots,
      score_b: m.away_shots,
    })),
  });

  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; updated_count: number } | null;
  if (!result?.ok) return { ok: false, error: "RPC returned no result." };

  // Winner propagation may have completed the tournament.
  await completeTournamentIfDone({
    supabase,
    tournamentId: parsed.data.tournament_id,
  });

  revalidateMatchSurfaces(parsed.data.tournament_id);
  return { ok: true, data: { updated_count: result.updated_count } };
}

// -------------------- 10. cancelTournament --------------------

export async function cancelTournament(
  input: CancelTournamentInput,
): Promise<ActionResult<{ cancelled: true }>> {
  const parsed = cancelTournamentSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const gate = await authForTournament(parsed.data.tournament_id);
  if (!gate.ok) return gate;

  if (gate.tournament.status === "completed") {
    return { ok: false, error: "Tournament is already completed; cannot cancel." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.tournament_id);

  if (error) return { ok: false, error: error.message };

  revalidateMatchSurfaces(parsed.data.tournament_id);
  return { ok: true, data: { cancelled: true } };
}

// -------------------- internal helpers --------------------

function invalidInput(err: import("zod").ZodError): {
  ok: false;
  error: string;
  fieldErrors: Record<string, string[]>;
} {
  return {
    ok: false,
    error: "Invalid input.",
    fieldErrors: err.flatten().fieldErrors as Record<string, string[]>,
  };
}

function pairAdjacent(ids: string[]): Array<readonly [string, string | null]> {
  const out: Array<readonly [string, string | null]> = [];
  for (let i = 0; i < ids.length; i += 2) {
    out.push([ids[i], ids[i + 1] ?? null] as const);
  }
  return out;
}

function inferWinnerFromScores(m: {
  home_team_id: string | null;
  away_team_id: string | null;
  home_shots: number;
  away_shots: number;
}): string | null {
  if (!m.home_team_id || !m.away_team_id) {
    return m.home_team_id ?? m.away_team_id ?? null;
  }
  if (m.home_shots === m.away_shots) return null;
  return m.home_shots > m.away_shots ? m.home_team_id : m.away_team_id;
}

async function isPlayerOnMatchOrAdmin(
  ctx: AuthContext,
  match: { tournament_id: string; home_team_id: string | null; away_team_id: string | null },
): Promise<boolean> {
  if (ctx.role === "super_admin") return true;
  const supabase = await createClient();

  if (ctx.role === "club_admin") {
    return tournamentBelongsToAdminClubs(supabase, match.tournament_id, ctx);
  }

  // Player path — must be a member of either team.
  if (!match.home_team_id && !match.away_team_id) return false;
  const teamIds = [match.home_team_id, match.away_team_id].filter(
    (x): x is string => typeof x === "string",
  );
  const { data, error } = await supabase
    .from("tournament_team_members")
    .select("id")
    .eq("profile_id", ctx.userId)
    .in("team_id", teamIds)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

async function tournamentBelongsToAdminClubs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tournamentId: string,
  ctx: AuthContext,
): Promise<boolean> {
  const { data } = await supabase
    .from("tournaments")
    .select("host_club_id")
    .eq("id", tournamentId)
    .single();
  return data ? ctx.clubIds.includes(data.host_club_id) : false;
}
