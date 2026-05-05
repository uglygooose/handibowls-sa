// Phase 13 / 13-8 / Batch A / Commit 2 — Demo seed tournaments + entries
// + teams + members + matches + match_ends.
//
// 5 tournaments at Demo Bowls Club covering every `tournament_status`
// value (draft / open / in_progress / completed / cancelled) + 1
// in_progress tournament at Pinelands BC for the cross-club isolation
// demo.
//
// Match coverage targets every `submission_status` value:
//   • pending             — match scheduled, no captain submitted yet
//   • captain_submitted   — one captain submitted scores; opposing
//                           captain to confirm
//   • opponent_confirmed  — both captains agreed; awaiting admin
//                           verification
//
// All 3 reachable on the Autumn Pairs Round-Robin (Demo BC). The
// Mixed Triples Final tournament has a completed match with full
// score history (drives the completed-match render path).
//
// match_status enum coverage: scheduled, in_progress, completed,
// walkover, cancelled — minimum-functional ≥1 each across the seeded
// matches.

import { logSection, type Admin } from "./_lib";
import type { ClubRow } from "./clubs";
import type { SeededFiller, SeededUser } from "./users";
import type { Database } from "../../types/database.types";

type TournamentInsert = Database["public"]["Tables"]["tournaments"]["Insert"];
type MatchInsert = Database["public"]["Tables"]["matches"]["Insert"];

const NOW = new Date();
const ONE_DAY = 24 * 60 * 60 * 1000;

function isoDate(daysFromNow: number): string {
  return new Date(NOW.getTime() + daysFromNow * ONE_DAY).toISOString();
}

export async function seedTournaments(
  client: Admin,
  clubs: { demo: ClubRow; pinelands: ClubRow },
  users: SeededUser[],
  fillers: SeededFiller[],
): Promise<void> {
  logSection("Demo seed — tournaments + teams + matches + ends");

  const adminUser = required(users, "admin@demo.local");
  const captainUser = required(users, "captain@demo.local");
  const playerUser = required(users, "player@demo.local");
  const player2User = required(users, "player2@demo.local");

  const veeFiller = requiredFiller(fillers, "vee@demo.local");
  const teeFiller = requiredFiller(fillers, "tee@demo.local");
  const essFiller = requiredFiller(fillers, "ess@demo.local");
  const leeFiller = requiredFiller(fillers, "lee@demo.local");
  const renFiller = requiredFiller(fillers, "ren@demo.local");

  const pin1Filler = requiredFiller(fillers, "pinplay1@demo.local");
  const pin2Filler = requiredFiller(fillers, "pinplay2@demo.local");

  // Pre-wipe the demo tournaments to keep this idempotent (Stage 2
  // reset already does this, but a `--skip-reset` re-run would
  // duplicate without the explicit clean). Cascade clears entries +
  // teams + members + matches + ends.
  await client.from("tournaments").delete().eq("host_club_id", clubs.demo.id);
  await client.from("tournaments").delete().eq("host_club_id", clubs.pinelands.id);

  // ---- Demo Bowls Club tournaments ------------------------------

  // 1. draft — Spring Singles Draft (no entries / teams / matches —
  // status='draft' is the iconic empty-tournament shape).
  await insertTournament(client, {
    host_club_id: clubs.demo.id,
    name: "Spring Singles Draft",
    format: "singles",
    structure: "knockout",
    status: "draft",
    starts_at: isoDate(28),
    ends_at: isoDate(29),
    entries_close_at: isoDate(21),
    shots_up_target: 21,
    created_by: adminUser.id,
  });

  // 2. open — Demo Pairs Open 2026 (with a few entries, no teams)
  const openT = await insertTournament(client, {
    host_club_id: clubs.demo.id,
    name: "Demo Pairs Open 2026",
    format: "pairs",
    structure: "round_robin",
    status: "open",
    starts_at: isoDate(14),
    ends_at: isoDate(15),
    entries_close_at: isoDate(7),
    ends_per_match: 18,
    created_by: adminUser.id,
  });
  // 3 entries to show the entries tab populated.
  const { error: openEntriesErr } = await client.from("tournament_entries").insert([
    { tournament_id: openT.id, club_id: clubs.demo.id, profile_id: playerUser.id, team_name: "Player Pair", seed: 1 },
    { tournament_id: openT.id, club_id: clubs.demo.id, profile_id: captainUser.id, team_name: "Captain's Crew", seed: 2 },
    { tournament_id: openT.id, club_id: clubs.demo.id, profile_id: veeFiller.id, team_name: "Veteran's Choice", seed: 3 },
  ]);
  if (openEntriesErr) throw openEntriesErr;

  // 3. in_progress — Autumn Pairs Round-Robin (the meaty one)
  const ipT = await insertTournament(client, {
    host_club_id: clubs.demo.id,
    name: "Autumn Pairs Round-Robin",
    format: "pairs",
    structure: "round_robin",
    status: "in_progress",
    starts_at: isoDate(-1),
    ends_at: isoDate(2),
    entries_close_at: isoDate(-7),
    ends_per_match: 18,
    created_by: adminUser.id,
  });

  // 4 teams of 2 players each.
  const teamA = await insertTeam(client, ipT.id, clubs.demo.id, "Team A", 1);
  const teamB = await insertTeam(client, ipT.id, clubs.demo.id, "Team B", 2);
  const teamC = await insertTeam(client, ipT.id, clubs.demo.id, "Team C", 3);
  const teamD = await insertTeam(client, ipT.id, clubs.demo.id, "Team D", 4);

  await insertTeamMembers(client, [
    { team_id: teamA.id, profile_id: captainUser.id, position: "skip" },
    { team_id: teamA.id, profile_id: playerUser.id, position: "lead" },
    { team_id: teamB.id, profile_id: player2User.id, position: "skip" },
    { team_id: teamB.id, profile_id: essFiller.id, position: "lead" },
    { team_id: teamC.id, profile_id: veeFiller.id, position: "skip" },
    { team_id: teamC.id, profile_id: teeFiller.id, position: "lead" },
    { team_id: teamD.id, profile_id: leeFiller.id, position: "skip" },
    { team_id: teamD.id, profile_id: renFiller.id, position: "lead" },
  ]);

  // Resolve a rink at Demo BC for matches.
  const demoRinkId = await firstRinkId(client, clubs.demo.id);

  // Round-robin = 6 matches. Cover all 3 submission_status values
  // + match_status diversity.
  // Match 1: A vs B — captain_submitted (captain@ submitted).
  const m1 = await insertMatch(client, {
    tournament_id: ipT.id,
    home_team_id: teamA.id,
    away_team_id: teamB.id,
    rink_id: demoRinkId,
    round: 1,
    status: "in_progress",
    submission_status: "captain_submitted",
    submitted_by_team_id: teamA.id,
    captain_submitted_at: new Date(NOW.getTime() - 30 * 60_000).toISOString(),
    home_shots: 8,
    away_shots: 5,
    home_ends_won: 4,
    away_ends_won: 2,
    starts_at: isoDate(0),
  });
  await insertMatchEnds(client, m1.id, captainUser.id, [
    [3, 0],
    [0, 2],
    [2, 1],
    [0, 2],
    [1, 0],
    [2, 0],
  ]);

  // Match 2: C vs D — opponent_confirmed (both captains agreed).
  const m2 = await insertMatch(client, {
    tournament_id: ipT.id,
    home_team_id: teamC.id,
    away_team_id: teamD.id,
    rink_id: demoRinkId,
    round: 1,
    status: "in_progress",
    submission_status: "opponent_confirmed",
    submitted_by_team_id: teamC.id,
    captain_submitted_at: new Date(NOW.getTime() - 90 * 60_000).toISOString(),
    opponent_confirmed_at: new Date(NOW.getTime() - 60 * 60_000).toISOString(),
    home_shots: 14,
    away_shots: 10,
    home_ends_won: 8,
    away_ends_won: 5,
    starts_at: isoDate(0),
  });
  await insertMatchEnds(client, m2.id, veeFiller.id, [
    [2, 0],
    [0, 1],
    [3, 0],
    [0, 2],
    [2, 0],
    [1, 1],
    [4, 0],
    [0, 3],
    [1, 0],
    [0, 2],
    [1, 1],
    [0, 1],
    [0, 0],
  ]);

  // Match 3: A vs C — pending (scheduled, no scores).
  await insertMatch(client, {
    tournament_id: ipT.id,
    home_team_id: teamA.id,
    away_team_id: teamC.id,
    rink_id: demoRinkId,
    round: 1,
    status: "scheduled",
    submission_status: "pending",
    starts_at: isoDate(1),
  });
  // Match 4-6: more pending matches to round out the 6-match round-robin.
  await insertMatch(client, {
    tournament_id: ipT.id,
    home_team_id: teamA.id,
    away_team_id: teamD.id,
    rink_id: demoRinkId,
    round: 1,
    status: "scheduled",
    submission_status: "pending",
    starts_at: isoDate(1),
  });
  await insertMatch(client, {
    tournament_id: ipT.id,
    home_team_id: teamB.id,
    away_team_id: teamC.id,
    rink_id: demoRinkId,
    round: 1,
    status: "scheduled",
    submission_status: "pending",
    starts_at: isoDate(2),
  });
  // 6th match: walkover (one team didn't show — covers match_status='walkover')
  await insertMatch(client, {
    tournament_id: ipT.id,
    home_team_id: teamB.id,
    away_team_id: teamD.id,
    rink_id: demoRinkId,
    round: 1,
    status: "walkover",
    submission_status: "pending",
    home_shots: 0,
    away_shots: 0,
    starts_at: isoDate(0),
    notes: "Team D walkover — no-show.",
  });

  // 4. completed — Mixed Triples Final
  const completedT = await insertTournament(client, {
    host_club_id: clubs.demo.id,
    name: "Mixed Triples Final",
    format: "mixed_pairs",
    structure: "knockout",
    status: "completed",
    starts_at: isoDate(-14),
    ends_at: isoDate(-13),
    entries_close_at: isoDate(-21),
    ends_per_match: 18,
    created_by: adminUser.id,
  });
  const compTeamA = await insertTeam(client, completedT.id, clubs.demo.id, "Champions", 1);
  const compTeamB = await insertTeam(client, completedT.id, clubs.demo.id, "Runners-up", 2);
  await insertTeamMembers(client, [
    { team_id: compTeamA.id, profile_id: captainUser.id, position: "skip" },
    { team_id: compTeamA.id, profile_id: playerUser.id, position: "lead" },
    { team_id: compTeamB.id, profile_id: player2User.id, position: "skip" },
    { team_id: compTeamB.id, profile_id: veeFiller.id, position: "lead" },
  ]);
  const compMatch = await insertMatch(client, {
    tournament_id: completedT.id,
    home_team_id: compTeamA.id,
    away_team_id: compTeamB.id,
    rink_id: demoRinkId,
    round: 1,
    status: "completed",
    submission_status: "opponent_confirmed",
    submitted_by_team_id: compTeamA.id,
    captain_submitted_at: isoDate(-13),
    opponent_confirmed_at: isoDate(-13),
    finalized_by_admin: true,
    home_shots: 21,
    away_shots: 14,
    home_ends_won: 12,
    away_ends_won: 6,
    winner_team_id: compTeamA.id,
    starts_at: isoDate(-13),
    ends_at: isoDate(-13),
  });
  await insertMatchEnds(client, compMatch.id, captainUser.id, [
    [2, 0], [0, 1], [3, 0], [0, 2], [2, 0], [1, 1], [4, 0], [0, 3], [1, 0],
    [0, 2], [1, 1], [0, 1], [3, 0], [0, 2], [1, 0], [0, 1], [2, 0], [2, 0],
  ]);

  // 5. cancelled — Cancelled Cup 2025
  await insertTournament(client, {
    host_club_id: clubs.demo.id,
    name: "Cancelled Cup 2025",
    format: "singles",
    structure: "knockout",
    status: "cancelled",
    starts_at: isoDate(-30),
    ends_at: isoDate(-29),
    entries_close_at: isoDate(-37),
    shots_up_target: 21,
    created_by: adminUser.id,
  });

  console.log("  tournaments — Demo BC: 5 (draft / open / in_progress / completed / cancelled)");

  // ---- Pinelands BC cross-club isolation tournament -------------

  const pinT = await insertTournament(client, {
    host_club_id: clubs.pinelands.id,
    name: "Pinelands Singles 2026",
    format: "singles",
    structure: "knockout",
    status: "in_progress",
    starts_at: isoDate(0),
    ends_at: isoDate(1),
    entries_close_at: isoDate(-3),
    shots_up_target: 21,
    created_by: required(users, "admin2@demo.local").id,
  });
  const pinTeamA = await insertTeam(client, pinT.id, clubs.pinelands.id, "Pines One", 1);
  const pinTeamB = await insertTeam(client, pinT.id, clubs.pinelands.id, "Pines Two", 2);
  await insertTeamMembers(client, [
    { team_id: pinTeamA.id, profile_id: pin1Filler.id, position: "skip" },
    { team_id: pinTeamB.id, profile_id: pin2Filler.id, position: "skip" },
  ]);
  const pinRinkId = await firstRinkId(client, clubs.pinelands.id);
  await insertMatch(client, {
    tournament_id: pinT.id,
    home_team_id: pinTeamA.id,
    away_team_id: pinTeamB.id,
    rink_id: pinRinkId,
    round: 1,
    status: "in_progress",
    submission_status: "pending",
    starts_at: isoDate(0),
  });

  console.log("  tournaments — Pinelands BC: 1 (in_progress, cross-club isolation demo)");
}

// ---- helpers -----------------------------------------------------

function required<T extends { email: string }>(arr: T[], email: string): T {
  const u = arr.find((x) => x.email === email);
  if (!u) throw new Error(`required user not found: ${email}`);
  return u;
}

function requiredFiller(arr: SeededFiller[], email: string): SeededFiller {
  return required(arr, email);
}

async function insertTournament(
  client: Admin,
  row: TournamentInsert,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("tournaments")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    console.error("  insertTournament FAILED for row:", JSON.stringify(row, null, 2));
    throw error;
  }
  return { id: data.id };
}

async function insertTeam(
  client: Admin,
  tournamentId: string,
  clubId: string,
  name: string,
  seed: number,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("tournament_teams")
    .insert({
      tournament_id: tournamentId,
      club_id: clubId,
      name,
      seed,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

async function insertTeamMembers(
  client: Admin,
  rows: Array<{
    team_id: string;
    profile_id: string;
    position: "skip" | "third" | "second" | "lead";
  }>,
) {
  const { error } = await client.from("tournament_team_members").insert(rows);
  if (error) throw error;
}

async function insertMatch(
  client: Admin,
  row: MatchInsert,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("matches")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    console.error("  insertMatch FAILED for row:", JSON.stringify(row, null, 2));
    throw error;
  }
  return { id: data.id };
}

async function insertMatchEnds(
  client: Admin,
  matchId: string,
  submittedBy: string,
  ends: Array<[number, number]>,
) {
  const rows = ends.map(([home, away], i) => ({
    match_id: matchId,
    end_number: i + 1,
    home_shots: home,
    away_shots: away,
    submitted_by: submittedBy,
  }));
  const { error } = await client.from("match_ends").insert(rows);
  if (error) throw error;
}

async function firstRinkId(client: Admin, clubId: string): Promise<string> {
  const { data, error } = await client
    .from("rinks")
    .select("id, greens!inner(club_id)")
    .eq("greens.club_id", clubId)
    .eq("active", true)
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(`No active rink at club ${clubId}`);
  }
  return data[0].id;
}
