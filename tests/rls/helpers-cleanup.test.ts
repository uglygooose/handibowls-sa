import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { admin, cleanup, createTestUser, seedClub } from "./helpers";

// Phase 13 / 13-2 / Batch B1a — DRIFT-L66 self-test.
//
// Pre-hardening, a test that inserted a booking / t20_assessment /
// tournament_team_member and then crashed left orphan rows in the
// cloud DB (Phase 8e Finding 18 diagnosis: 4 leftover bookings at
// 2 unique test-... clubs). The fix extends cleanup() to delete
// every documented ON DELETE RESTRICT child of the test users +
// clubs in the right order before issuing the final deleteUser /
// clubs.delete().
//
// This self-test asserts the post-cleanup state is empty for
// every RESTRICT child class. It is a regression-pin: future
// schema work that adds another RESTRICT FK will trip this if
// cleanup() doesn't extend to handle it.
//
// Failure mode pre-hardening: this test would surface 1 leftover
// booking + 1 leftover assessment + 1 leftover team_member after
// cleanup, and the club row would still be present (its delete
// blocked by the RESTRICT'd children).

describe("RLS helpers — cleanup() handles RESTRICT children", () => {
  // Track everything we create so we can run a final cleanup pass
  // even if the test asserts mid-run. Every ID here is test-scoped.
  const userIds: string[] = [];
  const clubIds: string[] = [];

  afterAll(async () => {
    // Best-effort safety net (the test itself exercises cleanup).
    await cleanup(userIds, clubIds);
  });

  it("deletes RESTRICT children of clubs (bookings, t20_assessments, tournaments) before clubs themselves", async () => {
    const a = admin();

    // Seed a fresh club + two users (one player, one club_admin who
    // will act as the assessor on a t20_assessment).
    const clubId = await seedClub(`Test Cleanup Club ${randomUUID()}`);
    clubIds.push(clubId);

    const player = await createTestUser({ role: "player", clubIds: [clubId] });
    const assessor = await createTestUser({ role: "club_admin", clubIds: [clubId] });
    userIds.push(player.id, assessor.id);

    // Seed the green + rink the booking will reference. (greens
    // cascades from clubs; rinks cascade from greens — neither
    // RESTRICTs cleanup, but bookings.rink_id RESTRICTs the rink so
    // the booking has to be cleaned before the rink would be
    // removed via the greens cascade.)
    const { data: green } = await a
      .from("greens")
      .insert({ club_id: clubId, name: "Test Green", rink_count: 6 })
      .select("id")
      .single()
      .throwOnError();
    const { data: rink } = await a
      .from("rinks")
      .insert({ green_id: green!.id, number: 1, active: true })
      .select("id")
      .single()
      .throwOnError();

    // RESTRICT child #1 — booking (club_id RESTRICT).
    const { data: booking } = await a
      .from("bookings")
      .insert({
        club_id: clubId,
        rink_id: rink!.id,
        booked_by: assessor.id,
        starts_at: new Date(Date.now() + 86400_000).toISOString(),
        ends_at: new Date(Date.now() + 90000_000).toISOString(),
        purpose: "practice",
        status: "booked",
      })
      .select("id")
      .single()
      .throwOnError();

    // RESTRICT child #2 — get the active rubric so we can create an
    // assessment (assessment.rubric_version_id is RESTRICT to rubrics).
    const { data: rubric } = await a
      .from("t20_rubric_versions")
      .select("id")
      .eq("is_active", true)
      .single()
      .throwOnError();

    // RESTRICT children #2/3/4 — t20_assessment hits THREE RESTRICTs
    // simultaneously: club_id, profile_id (player), assessor_id (admin).
    const { data: assessment } = await a
      .from("t20_assessments")
      .insert({
        club_id: clubId,
        profile_id: player.id,
        assessor_id: assessor.id,
        rubric_version_id: rubric!.id,
        assessed_on: new Date().toISOString().slice(0, 10),
        status: "draft",
      })
      .select("id")
      .single()
      .throwOnError();

    // RESTRICT child #5 — tournament + team_member (host_club_id
    // RESTRICT + tournament_team_members.profile_id RESTRICT).
    const { data: tournament } = await a
      .from("tournaments")
      .insert({
        host_club_id: clubId,
        name: "Test Cleanup Tournament",
        format: "singles",
        scope: "club",
        structure: "knockout",
        seeding_method: "random",
        handicap_rule: "scratch",
        category: "open",
        age_group: "open",
        starts_at: new Date(Date.now() + 86400_000).toISOString(),
        ends_at: new Date(Date.now() + 172800_000).toISOString(),
        status: "open",
      })
      .select("id")
      .single()
      .throwOnError();
    const { data: team } = await a
      .from("tournament_teams")
      .insert({
        tournament_id: tournament!.id,
        club_id: clubId,
        name: "Test Team 1",
        seed: 1,
      })
      .select("id")
      .single()
      .throwOnError();
    const { data: teamMember } = await a
      .from("tournament_team_members")
      .insert({
        team_id: team!.id,
        profile_id: player.id,
        position: "skip",
      })
      .select("id")
      .single()
      .throwOnError();

    // Pre-cleanup sanity: every dependency row is in the DB.
    const { data: preBookings } = await a
      .from("bookings")
      .select("id")
      .eq("id", booking!.id);
    expect(preBookings?.length).toBe(1);

    const { data: preAssessments } = await a
      .from("t20_assessments")
      .select("id")
      .eq("id", assessment!.id);
    expect(preAssessments?.length).toBe(1);

    const { data: preTeamMembers } = await a
      .from("tournament_team_members")
      .select("id")
      .eq("id", teamMember!.id);
    expect(preTeamMembers?.length).toBe(1);

    // The test under test. cleanup() should clear everything.
    await cleanup(userIds, clubIds);

    // Empty the tracking arrays so the afterAll safety net is a no-op.
    userIds.length = 0;
    clubIds.length = 0;

    // Post-cleanup: every RESTRICT child + the parent rows are gone.
    const { data: postBooking } = await a
      .from("bookings")
      .select("id")
      .eq("id", booking!.id);
    expect(postBooking?.length).toBe(0);

    const { data: postAssessment } = await a
      .from("t20_assessments")
      .select("id")
      .eq("id", assessment!.id);
    expect(postAssessment?.length).toBe(0);

    const { data: postTeamMember } = await a
      .from("tournament_team_members")
      .select("id")
      .eq("id", teamMember!.id);
    expect(postTeamMember?.length).toBe(0);

    const { data: postTournament } = await a
      .from("tournaments")
      .select("id")
      .eq("id", tournament!.id);
    expect(postTournament?.length).toBe(0);

    const { data: postClub } = await a
      .from("clubs")
      .select("id")
      .eq("id", clubId);
    expect(postClub?.length).toBe(0);
  }, 60_000);
});
