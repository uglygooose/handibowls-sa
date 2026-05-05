// Phase 13 / 13-8 / Batch A — Demo seed reset.
//
// Deletes all demo-tagged rows so the seed orchestrator can re-create
// from a clean slate. Walks the FK chain explicitly because several
// referencing FKs are ON DELETE RESTRICT (tournaments.host_club_id,
// t20_assessments.club_id, tournament_entries.club_id, bookings.
// club_id, t20_assessments.profile_id, tournament_team_members.
// profile_id) — a naive `delete from clubs` would block on those.
//
// Order:
//   1. Compute demoClubIds (slug LIKE 'demo-%' OR slug = 'pinelands-bc').
//   2. Walk the tournament chain top-down: match_ends → matches →
//      tournament_team_members → tournament_teams → tournament_entries
//      → tournaments.
//   3. Walk the T20 chain: t20_deliveries → t20_assessments.
//   4. Delete bookings.
//   5. Delete clubs (cascades to greens, rinks, club_memberships,
//      club_admin_assignments, invites, messages, notifications,
//      booking_windows).
//   6. Delete demo auth users (cascades to profiles → consents +
//      anything CASCADE-FK'd from profile; SET NULL FKs become null
//      on remaining rows).
//
// Reference data NEVER touched: districts (migration 003 seed) and
// t20_rubric_versions (migration 013 seed).
//
// DEMO SUPABASE ONLY. Never run against a Supabase project that
// contains real pilot/customer data. There is no production-safety
// check.

import {
  admin,
  DEMO_CLUB_SLUG_PATTERNS,
  DEMO_EMAIL_PATTERNS,
  listAllAuthUsers,
  logSection,
  type Admin,
} from "./_lib";

export async function resetDemoData(): Promise<void> {
  const client = admin();

  logSection("Demo seed reset — wiping demo-tagged rows");

  const demoClubIds = await findDemoClubIds(client);
  console.log(`  found ${demoClubIds.length} demo club(s) to wipe`);

  if (demoClubIds.length > 0) {
    await deleteTournamentChain(client, demoClubIds);
    await deleteT20Chain(client, demoClubIds);
    await deleteBookings(client, demoClubIds);
    await deleteClubs(client, demoClubIds);
  }

  await deleteDemoAuthUsers(client);

  console.log("\nReset complete. Demo-tagged rows deleted; districts +");
  console.log("rubric versions (migration-seeded reference data) intact.");
}

async function findDemoClubIds(client: Admin): Promise<string[]> {
  const prefixOrFilter = DEMO_CLUB_SLUG_PATTERNS.prefixes
    .map((p) => `slug.like.${p}*`)
    .join(",");

  const { data: prefixMatches, error: prefixErr } = await client
    .from("clubs")
    .select("id")
    .or(prefixOrFilter);
  if (prefixErr) throw prefixErr;

  const { data: exactMatches, error: exactErr } = await client
    .from("clubs")
    .select("id")
    .in("slug", DEMO_CLUB_SLUG_PATTERNS.exact as readonly string[] as string[]);
  if (exactErr) throw exactErr;

  return [
    ...(prefixMatches ?? []).map((c) => c.id),
    ...(exactMatches ?? []).map((c) => c.id),
  ];
}

// Tournament cascade chain. tournaments.host_club_id is RESTRICT, so
// we walk top-down deleting dependents first.
async function deleteTournamentChain(client: Admin, clubIds: string[]) {
  const { data: tournaments, error: tErr } = await client
    .from("tournaments")
    .select("id")
    .in("host_club_id", clubIds);
  if (tErr) throw tErr;
  const tournamentIds = (tournaments ?? []).map((t) => t.id);

  if (tournamentIds.length === 0) {
    console.log("  tournaments — no demo tournaments");
    return;
  }

  // Resolve all match ids first (match_ends depends on matches.id).
  const { data: matches, error: mErr } = await client
    .from("matches")
    .select("id")
    .in("tournament_id", tournamentIds);
  if (mErr) throw mErr;
  const matchIds = (matches ?? []).map((m) => m.id);

  if (matchIds.length > 0) {
    await deleteIn(client, "match_ends", "match_id", matchIds);
  }
  await deleteIn(client, "matches", "tournament_id", tournamentIds);

  // tournament_team_members depend on tournament_teams.id; resolve
  // team ids first.
  const { data: teams, error: teamsErr } = await client
    .from("tournament_teams")
    .select("id")
    .in("tournament_id", tournamentIds);
  if (teamsErr) throw teamsErr;
  const teamIds = (teams ?? []).map((t) => t.id);

  if (teamIds.length > 0) {
    await deleteIn(client, "tournament_team_members", "team_id", teamIds);
  }
  await deleteIn(client, "tournament_teams", "tournament_id", tournamentIds);
  await deleteIn(client, "tournament_entries", "tournament_id", tournamentIds);
  await deleteIn(client, "tournaments", "id", tournamentIds);

  console.log(
    `  tournaments — wiped ${tournamentIds.length} tournament(s) ` +
      `(${matchIds.length} matches, ${teamIds.length} teams, dependents)`,
  );
}

// T20 cascade chain. t20_assessments.club_id is RESTRICT.
async function deleteT20Chain(client: Admin, clubIds: string[]) {
  const { data: assessments, error: aErr } = await client
    .from("t20_assessments")
    .select("id")
    .in("club_id", clubIds);
  if (aErr) throw aErr;
  const assessmentIds = (assessments ?? []).map((a) => a.id);

  if (assessmentIds.length === 0) {
    console.log("  t20_assessments — no demo assessments");
    return;
  }

  await deleteIn(client, "t20_deliveries", "assessment_id", assessmentIds);
  await deleteIn(client, "t20_assessments", "id", assessmentIds);

  console.log(
    `  t20_assessments — wiped ${assessmentIds.length} assessment(s) + deliveries`,
  );
}

// bookings.club_id is RESTRICT.
async function deleteBookings(client: Admin, clubIds: string[]) {
  const { count, error: countErr } = await client
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .in("club_id", clubIds);
  if (countErr) throw countErr;

  if (!count) {
    console.log("  bookings — no demo bookings");
    return;
  }

  const { error } = await client
    .from("bookings")
    .delete()
    .in("club_id", clubIds);
  if (error) throw error;
  console.log(`  bookings — wiped ${count} booking(s)`);
}

// Clubs cascade to: greens (→ rinks), club_memberships,
// club_admin_assignments, invites, messages (→ message_recipients
// via separate cascade), notifications, booking_windows.
async function deleteClubs(client: Admin, clubIds: string[]) {
  const { error } = await client.from("clubs").delete().in("id", clubIds);
  if (error) throw error;
  console.log(`  clubs — wiped ${clubIds.length} club(s) (cascades chain)`);
}

async function deleteDemoAuthUsers(client: Admin): Promise<void> {
  // Paginate through ALL auth users (local Supabase accumulates RLS-
  // test users + prior dev-seed runs). DEFAULT listUsers page is too
  // small for that pile.
  const all = await listAllAuthUsers(client);

  const matches = all.filter((u) => {
    const email = u.email?.toLowerCase() ?? "";
    return DEMO_EMAIL_PATTERNS.some((pattern) =>
      pattern.startsWith("@") ? email.endsWith(pattern) : email === pattern,
    );
  });

  if (matches.length === 0) {
    console.log("  auth.users — no demo users to delete");
    return;
  }

  for (const user of matches) {
    const { error: delErr } = await client.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error(
        `  auth.users — failed to delete ${user.email}:`,
        delErr.message,
      );
      throw delErr;
    }
  }
  console.log(`  auth.users — deleted ${matches.length} demo user(s)`);
}

// Generic batched-delete helper. Useful for the in() case where the
// id list can be large; PostgREST may reject very long IN clauses.
// Demo dataset is bounded but the chunking is cheap insurance.
async function deleteIn(
  client: Admin,
  table:
    | "match_ends"
    | "matches"
    | "tournament_team_members"
    | "tournament_teams"
    | "tournament_entries"
    | "tournaments"
    | "t20_deliveries"
    | "t20_assessments",
  column: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { error } = await client.from(table).delete().in(column, slice);
    if (error) {
      throw new Error(
        `delete ${table} where ${column} IN (${slice.length} ids) failed: ${error.message}`,
      );
    }
  }
}
