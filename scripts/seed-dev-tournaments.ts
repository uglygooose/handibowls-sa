// scripts/seed-dev-tournaments.ts
//
// Phase-8 dev seeding for the player surfaces. Idempotent. Creates 3
// tournaments hosted by Demo Bowls Club so player@demo.local has
// realistic data to walk on /play, /tournaments, /tournaments/[id],
// and the scorecard route (Phase 8c).
//
// Seeded tournaments
//   1. "Open Singles Cup"      — status=open, entries open, no entries
//                                yet. Drives the /tournaments Available
//                                tab + the empty-bracket detail page.
//   2. "Demo Singles Open 2026" — status=in_progress, player@demo.local
//                                vs Bot Opponent, 1 scheduled match.
//                                Drives the /play hero next-match card,
//                                /tournaments Entered tab, and the
//                                read-only detail's "in play" callout.
//   3. "Autumn Singles Final"  — status=completed, player won 21–14.
//                                Drives /play recent-results strip and
//                                the Final results read-only view.
//
// Bot Opponent
//   A bot.opponent@demo.local profile (role=player, member of Demo
//   Bowls Club) is upserted as a dependency so every tournament that
//   needs an opponent has someone to point at. Idempotent — re-running
//   updates the password + email_confirmed flags.
//
// Idempotency
//   Each tournament is keyed by (host_club_id, name). Existing rows
//   are detected and skipped. Pass `--reset` to wipe the 3 tournaments
//   (cascade clears entries / teams / matches) before reseeding.
//
// Auth path
//   Service-role client for setup — matches scripts/seed-dev-users.ts.
//   The seeding + bracket-generation logic uses the actual engine
//   primitives (lib/tournaments/seeding.ts +
//   lib/tournaments/brackets/knockout.ts +
//   lib/tournaments/adapters.ts) so the data shape lines up exactly
//   with what the production createTournament + seedEntries +
//   generateBracket actions produce. Direct DB inserts are limited to
//   the auth-user / profile / membership rows the auth system itself
//   creates by other means — not engine-domain logic.
//
// Usage
//   cp .env.local .env (or use existing env)
//   npm run seed:dev:tournaments              # seed (idempotent)
//   npm run seed:dev:tournaments -- --reset   # wipe + re-seed

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Database } from "../types/database.types";
import { generateKnockoutRound1 } from "../lib/tournaments/brackets/knockout";
import { knockoutInsertToMatchInsert } from "../lib/tournaments/adapters";
import { seedEntries as seedEntriesPrimitive } from "../lib/tournaments/seeding";

// ---- env ----
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  for (const p of [".env.local", ".env.test"]) {
    const f = resolve(__dirname, "..", p);
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Populate .env.local before running.",
  );
  process.exit(1);
}

const reset = process.argv.includes("--reset");

const DEV_PASSWORD = "dev-password-12345";
const DEMO_CLUB_SLUG = "demo-bowls-club";
const PLAYER_EMAIL = "player@demo.local";
const ADMIN_EMAIL = "admin@demo.local";
const BOT_EMAIL = "bot.opponent@demo.local";

const TOURNAMENT_NAMES = {
  open: "Open Singles Cup",
  inProgress: "Demo Singles Open 2026",
  completed: "Autumn Singles Final",
} as const;

const supabase = createClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- helpers ----
async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return (
    data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ??
    null
  );
}

async function ensureBotOpponent(demoClubId: string): Promise<string> {
  const existing = await findUserIdByEmail(BOT_EMAIL);
  let userId: string;
  if (existing) {
    await supabase.auth.admin.updateUserById(existing, {
      password: DEV_PASSWORD,
      email_confirm: true,
    });
    userId = existing;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: BOT_EMAIL,
      password: DEV_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw error ?? new Error("createUser returned no user");
    }
    userId = data.user.id;
  }
  // Profile shape — minimal for an opponent; the role + display name
  // are what the player UI surfaces in match cards.
  await supabase
    .from("profiles")
    .update({
      role: "player",
      first_name: "Bot",
      last_name: "Opponent",
      display_name: "Bot Opponent",
      email: BOT_EMAIL,
      profile_completed: true,
      gender: "other",
      dominant_hand: "right",
    })
    .eq("id", userId);
  await supabase
    .from("club_memberships")
    .upsert(
      {
        profile_id: userId,
        club_id: demoClubId,
        is_primary: true,
        status: "active",
      },
      { onConflict: "profile_id,club_id" },
    );
  return userId;
}

async function findExistingTournament(
  hostClubId: string,
  name: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("tournaments")
    .select("id")
    .eq("host_club_id", hostClubId)
    .eq("name", name)
    .maybeSingle();
  return data?.id ?? null;
}

async function deleteTournamentByName(hostClubId: string, name: string) {
  const id = await findExistingTournament(hostClubId, name);
  if (!id) return;
  // ON DELETE CASCADE on entries / teams / matches handles the rest.
  await supabase.from("tournaments").delete().eq("id", id);
}

async function createTournamentRow(
  hostClubId: string,
  fields: {
    name: string;
    status: "open" | "in_progress" | "completed";
    starts_at: string;
    ends_at: string;
    entries_close_at: string | null;
  },
  createdBy: string,
): Promise<string> {
  // Always insert as 'open' first to satisfy any future RLS WITH CHECK
  // that gates terminal statuses on a transition path. Then UPDATE to
  // the target status. For 'open' tournaments we leave it.
  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      host_club_id: hostClubId,
      name: fields.name,
      scope: "club",
      format: "singles",
      structure: "knockout",
      category: "open",
      age_group: "open",
      handicap_rule: "scratch",
      seeding_method: "seeded",
      starts_at: fields.starts_at,
      ends_at: fields.ends_at,
      entries_close_at: fields.entries_close_at,
      max_entries: 16,
      shots_up_target: 21,
      created_by: createdBy,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "tournament insert returned no row");
  }
  if (fields.status !== "open") {
    await supabase
      .from("tournaments")
      .update({ status: fields.status })
      .eq("id", data.id);
  }
  return data.id;
}

async function insertEntries(
  tournamentId: string,
  clubId: string,
  profileIds: string[],
): Promise<string[]> {
  const inserts = profileIds.map((pid, i) => ({
    tournament_id: tournamentId,
    club_id: clubId,
    profile_id: pid,
    seed: i + 1,
    withdrawn: false,
  }));
  const { data, error } = await supabase
    .from("tournament_entries")
    .insert(inserts)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id);
}

async function insertTeams(
  tournamentId: string,
  clubId: string,
  entryIds: string[],
): Promise<string[]> {
  const seedingTeams = entryIds.map((id, i) => ({ id, seed: i + 1 }));
  const seeding = seedEntriesPrimitive({
    method: "seeded",
    teams: seedingTeams,
  });
  const teamInserts = seeding.ordered.map((t) => ({
    tournament_id: tournamentId,
    club_id: clubId,
    seed: t.seed,
    section_label: t.section_label,
  }));
  const { data, error } = await supabase
    .from("tournament_teams")
    .insert(teamInserts)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id);
}

async function insertTeamMembers(teamIds: string[], profileIds: string[]) {
  // Singles → one member per team, position 'skip', bowl_order 1.
  const inserts = teamIds.map((teamId, i) => ({
    team_id: teamId,
    profile_id: profileIds[i],
    position: "skip" as const,
    bowl_order: 1,
  }));
  const { error } = await supabase
    .from("tournament_team_members")
    .insert(inserts);
  if (error) throw new Error(error.message);
}

async function generateRound1(
  tournamentId: string,
  teamIds: string[],
): Promise<string[]> {
  if (teamIds.length < 2) return [];
  const seedingResult = {
    ordered: teamIds.map((id, i) => ({
      id,
      seed: i + 1,
      section_label: null,
    })),
    pairings: [[teamIds[0], teamIds[1]] as const] as const,
  };
  const out = generateKnockoutRound1(seedingResult);
  if (!out || out.inserts.length === 0) return [];
  const dbInserts = out.inserts.map((i) =>
    knockoutInsertToMatchInsert(i, tournamentId),
  );
  const { data, error } = await supabase
    .from("matches")
    .insert(dbInserts)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id);
}

async function completeMatch(
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
  homeShots: number,
  awayShots: number,
) {
  const winner =
    homeShots > awayShots
      ? homeTeamId
      : awayShots > homeShots
        ? awayTeamId
        : null;
  const { error } = await supabase
    .from("matches")
    .update({
      status: "completed",
      home_shots: homeShots,
      away_shots: awayShots,
      winner_team_id: winner,
      finalized_by_admin: true,
      ends_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

// ---- run ----
async function run() {
  const { data: club, error: clubErr } = await supabase
    .from("clubs")
    .select("id")
    .eq("slug", DEMO_CLUB_SLUG)
    .maybeSingle();
  if (clubErr) throw clubErr;
  if (!club) throw new Error(`Club not found: ${DEMO_CLUB_SLUG}`);
  const demoClubId = club.id;

  const adminId = await findUserIdByEmail(ADMIN_EMAIL);
  const playerId = await findUserIdByEmail(PLAYER_EMAIL);
  if (!adminId)
    throw new Error(`${ADMIN_EMAIL} missing — run npm run seed:dev first`);
  if (!playerId)
    throw new Error(`${PLAYER_EMAIL} missing — run npm run seed:dev first`);

  const botId = await ensureBotOpponent(demoClubId);
  console.log(`✓ bot opponent ${BOT_EMAIL}`);

  if (reset) {
    for (const name of Object.values(TOURNAMENT_NAMES)) {
      await deleteTournamentByName(demoClubId, name);
      console.log(`  reset ${name}`);
    }
  }

  // 1. Open
  const openId = await findExistingTournament(demoClubId, TOURNAMENT_NAMES.open);
  if (openId) {
    console.log(`= ${TOURNAMENT_NAMES.open} already exists (${openId})`);
  } else {
    const id = await createTournamentRow(
      demoClubId,
      {
        name: TOURNAMENT_NAMES.open,
        status: "open",
        starts_at: addDays(new Date(), 14).toISOString(),
        ends_at: addDays(new Date(), 15).toISOString(),
        entries_close_at: addDays(new Date(), 10).toISOString(),
      },
      adminId,
    );
    console.log(`✓ open: ${TOURNAMENT_NAMES.open} (${id})`);
  }

  // 2. In-progress
  const ipId = await findExistingTournament(
    demoClubId,
    TOURNAMENT_NAMES.inProgress,
  );
  if (ipId) {
    console.log(`= ${TOURNAMENT_NAMES.inProgress} already exists (${ipId})`);
  } else {
    const id = await createTournamentRow(
      demoClubId,
      {
        name: TOURNAMENT_NAMES.inProgress,
        status: "in_progress",
        starts_at: addDays(new Date(), -1).toISOString(),
        ends_at: addDays(new Date(), 1).toISOString(),
        entries_close_at: addDays(new Date(), -1).toISOString(),
      },
      adminId,
    );
    const entryIds = await insertEntries(id, demoClubId, [playerId, botId]);
    const teamIds = await insertTeams(id, demoClubId, entryIds);
    await insertTeamMembers(teamIds, [playerId, botId]);
    await generateRound1(id, teamIds);
    console.log(`✓ in-progress: ${TOURNAMENT_NAMES.inProgress} (${id})`);
  }

  // 3. Completed
  const compId = await findExistingTournament(
    demoClubId,
    TOURNAMENT_NAMES.completed,
  );
  if (compId) {
    console.log(`= ${TOURNAMENT_NAMES.completed} already exists (${compId})`);
  } else {
    const id = await createTournamentRow(
      demoClubId,
      {
        name: TOURNAMENT_NAMES.completed,
        status: "completed",
        starts_at: addDays(new Date(), -8).toISOString(),
        ends_at: addDays(new Date(), -7).toISOString(),
        entries_close_at: addDays(new Date(), -10).toISOString(),
      },
      adminId,
    );
    const entryIds = await insertEntries(id, demoClubId, [playerId, botId]);
    const teamIds = await insertTeams(id, demoClubId, entryIds);
    await insertTeamMembers(teamIds, [playerId, botId]);
    const matchIds = await generateRound1(id, teamIds);
    if (matchIds.length > 0) {
      await completeMatch(matchIds[0], teamIds[0], teamIds[1], 21, 14);
    }
    console.log(`✓ completed: ${TOURNAMENT_NAMES.completed} (${id})`);
  }

  console.log("\nDone. Run with --reset to wipe and re-seed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
