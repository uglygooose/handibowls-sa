// Phase 13 / 13-8 / Batch A — Demo seed reset (two-stage).
//
// Stage 1: nuke ALL non-demo, non-reference data.
//   Catches integration-test orphans (tests/rls/* fixtures use slugs
//   like `test-<uuid>` and emails like `test-<uuid>@example.test` that
//   accumulated 383+ club rows + 1033+ memberships + 176+ tournaments
//   + 728+ bookings + 213+ t20_assessments on the cloud Supabase
//   between 2026-04-28 and 2026-05-01) plus any developer-created
//   accounts from prior phase work that aren't part of the canonical 7.
//
//   See DRIFT entry `integration-test-cleanup-not-firing-on-cloud-supabase`
//   for the underlying test-helper bug; this Stage 1 cleanup masks the
//   symptom on the demo project but the cleanup-failure root cause stays
//   open for Phase 13.5 / Phase 14 investigation.
//
// Stage 2: nuke prior demo seed outputs.
//   Re-creates from scratch on the next seed run.
//
// Both stages walk the FK chain explicitly because tournaments.host_club_id,
// t20_assessments.club_id, bookings.club_id, t20_assessments.profile_id,
// and tournament_team_members.profile_id are ON DELETE RESTRICT — a
// naive `delete from clubs / auth.users` would block.
//
// Reference data NEVER touched: districts (migration 003 seed) and
// t20_rubric_versions (migration 013 seed for v1-final-2026 + any
// future demo-relevant rubric versions).
//
// DEMO SUPABASE ONLY. Never run against a Supabase project that
// contains real pilot/customer data. There is no production-safety
// check.

import {
  admin,
  DEMO_CLUB_SLUG_PATTERNS,
  isDemoEmail,
  listAllAuthUsers,
  logSection,
  type Admin,
} from "./_lib";

export async function resetDemoData(): Promise<void> {
  const client = admin();

  logSection("Demo seed reset — Stage 1: wipe non-demo + non-reference data");
  await wipeNonDemoCloudData(client);

  logSection("Demo seed reset — Stage 2: wipe prior demo seed outputs");
  await wipeDemoSeedOutputs(client);

  console.log(
    "\nReset complete. Districts (20 BSA seed) + t20_rubric_versions intact.",
  );
}

// ---------------------------------------------------------------------
// Stage 1 — non-demo cleanup
// ---------------------------------------------------------------------

async function wipeNonDemoCloudData(client: Admin): Promise<void> {
  const nonDemoClubIds = await findNonDemoClubIds(client);
  console.log(`  found ${nonDemoClubIds.length} non-demo club(s) to wipe`);

  if (nonDemoClubIds.length > 0) {
    await deleteTournamentChain(client, nonDemoClubIds);
    await deleteT20Chain(client, nonDemoClubIds);
    await deleteBookings(client, nonDemoClubIds);
    await deleteClubs(client, nonDemoClubIds);
  }

  await deleteNonDemoAuthUsers(client);
}

async function findNonDemoClubIds(client: Admin): Promise<string[]> {
  // Page through clubs (cloud may have hundreds of test orphans).
  // PostgREST default limit is 1000; we paginate to be safe.
  const all: Array<{ id: string; slug: string }> = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await client
      .from("clubs")
      .select("id, slug")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
    if (from > 100_000) {
      throw new Error("findNonDemoClubIds: pagination guard tripped");
    }
  }

  return all
    .filter((c) => !isDemoSlug(c.slug))
    .map((c) => c.id);
}

function isDemoSlug(slug: string): boolean {
  if (DEMO_CLUB_SLUG_PATTERNS.exact.includes(slug as never)) return true;
  return DEMO_CLUB_SLUG_PATTERNS.prefixes.some((p) => slug.startsWith(p));
}

async function deleteNonDemoAuthUsers(client: Admin): Promise<void> {
  const all = await listAllAuthUsers(client);
  const matches = all.filter((u) => !isDemoEmail(u.email));

  if (matches.length === 0) {
    console.log("  auth.users — no non-demo users to delete");
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
  console.log(`  auth.users — deleted ${matches.length} non-demo user(s)`);
}

// ---------------------------------------------------------------------
// Stage 2 — demo seed outputs
// ---------------------------------------------------------------------

async function wipeDemoSeedOutputs(client: Admin): Promise<void> {
  const demoClubIds = await findDemoClubIds(client);
  console.log(`  found ${demoClubIds.length} demo club(s) to wipe`);

  if (demoClubIds.length > 0) {
    await deleteTournamentChain(client, demoClubIds);
    await deleteT20Chain(client, demoClubIds);
    await deleteBookings(client, demoClubIds);
    await deleteClubs(client, demoClubIds);
  }

  await deleteDemoAuthUsers(client);
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

async function deleteDemoAuthUsers(client: Admin): Promise<void> {
  const all = await listAllAuthUsers(client);
  const matches = all.filter((u) => isDemoEmail(u.email));

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

// ---------------------------------------------------------------------
// Shared FK-chain teardowns (used by both stages)
// ---------------------------------------------------------------------

async function deleteTournamentChain(client: Admin, clubIds: string[]) {
  const { data: tournaments, error: tErr } = await client
    .from("tournaments")
    .select("id")
    .in("host_club_id", clubIds);
  if (tErr) throw tErr;
  const tournamentIds = (tournaments ?? []).map((t) => t.id);

  if (tournamentIds.length === 0) {
    console.log("  tournaments — no tournaments to wipe");
    return;
  }

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

async function deleteT20Chain(client: Admin, clubIds: string[]) {
  // Page through t20_assessments — orphan counts can be high (cloud
  // had 213 from RLS test orphans; PostgREST IN clauses with hundreds
  // of clubIds can be unwieldy, so chunk the lookup).
  const assessmentIds: string[] = [];
  const CHUNK_CLUBS = 100;
  for (let i = 0; i < clubIds.length; i += CHUNK_CLUBS) {
    const slice = clubIds.slice(i, i + CHUNK_CLUBS);
    const { data, error } = await client
      .from("t20_assessments")
      .select("id")
      .in("club_id", slice);
    if (error) throw error;
    assessmentIds.push(...(data ?? []).map((a) => a.id));
  }

  if (assessmentIds.length === 0) {
    console.log("  t20_assessments — no assessments to wipe");
    return;
  }

  await deleteIn(client, "t20_deliveries", "assessment_id", assessmentIds);
  await deleteIn(client, "t20_assessments", "id", assessmentIds);

  console.log(
    `  t20_assessments — wiped ${assessmentIds.length} assessment(s) + deliveries`,
  );
}

async function deleteBookings(client: Admin, clubIds: string[]) {
  // Chunk by clubIds for the same reason as t20.
  let total = 0;
  const CHUNK_CLUBS = 100;
  for (let i = 0; i < clubIds.length; i += CHUNK_CLUBS) {
    const slice = clubIds.slice(i, i + CHUNK_CLUBS);
    const { count, error: countErr } = await client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("club_id", slice);
    if (countErr) throw countErr;

    if (!count) continue;

    const { error } = await client
      .from("bookings")
      .delete()
      .in("club_id", slice);
    if (error) throw error;
    total += count;
  }

  if (total === 0) {
    console.log("  bookings — no bookings to wipe");
    return;
  }
  console.log(`  bookings — wiped ${total} booking(s)`);
}

async function deleteClubs(client: Admin, clubIds: string[]) {
  // Chunk for safety on large-id-list deletes.
  const CHUNK = 200;
  let total = 0;
  for (let i = 0; i < clubIds.length; i += CHUNK) {
    const slice = clubIds.slice(i, i + CHUNK);
    const { error } = await client.from("clubs").delete().in("id", slice);
    if (error) throw error;
    total += slice.length;
  }
  console.log(`  clubs — wiped ${total} club(s) (cascades chain)`);
}

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
