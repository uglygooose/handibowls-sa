import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTestUser, seedClub, signIn } from "./helpers";

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("RLS · matches + match_ends", () => {
  let clubA: string;
  let clubB: string;
  let tournamentId: string;
  let matchId: string;
  let homeTeamId: string;
  let participantId: string;

  beforeAll(async () => {
    clubA = await seedClub("Match A");
    clubB = await seedClub("Match B");
    clubs.push(clubA, clubB);

    const a = admin();
    const participant = await createTestUser({
      role: "player",
      clubIds: [clubA],
    });
    users.push(participant.id);
    participantId = participant.id;

    const { data: tour } = await a
      .from("tournaments")
      .insert({
        host_club_id: clubA,
        name: "Match Cup",
        format: "singles",
        structure: "knockout",
      })
      .select("id")
      .single();
    tournamentId = tour!.id;

    const { data: home } = await a
      .from("tournament_teams")
      .insert({ tournament_id: tournamentId, name: "Home" })
      .select("id")
      .single();
    homeTeamId = home!.id;
    const { data: away } = await a
      .from("tournament_teams")
      .insert({ tournament_id: tournamentId, name: "Away" })
      .select("id")
      .single();

    await a.from("tournament_team_members").insert({
      team_id: homeTeamId,
      profile_id: participantId,
      position: "skip",
    });

    const { data: match } = await a
      .from("matches")
      .insert({
        tournament_id: tournamentId,
        home_team_id: homeTeamId,
        away_team_id: away!.id,
      })
      .select("id")
      .single();
    matchId = match!.id;
  });

  it("participant can READ a match they play in", async () => {
    const p = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(p.id);
    await admin().from("tournament_team_members").insert({
      team_id: homeTeamId,
      profile_id: p.id,
      position: "second",
    });
    const { client } = await signIn(p);
    const { data } = await client
      .from("matches")
      .select("id")
      .eq("id", matchId);
    expect(data?.length).toBe(1);
  });

  it("non-participant from another club CANNOT read the match", async () => {
    const outsider = await createTestUser({ role: "player", clubIds: [clubB] });
    users.push(outsider.id);
    const { client } = await signIn(outsider);
    const { data } = await client
      .from("matches")
      .select("id")
      .eq("id", matchId);
    expect(data).toEqual([]);
  });

  it("host club_admin can update match score", async () => {
    const u = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    users.push(u.id);
    const { client } = await signIn(u);
    const { error } = await client
      .from("matches")
      .update({ home_shots: 21, away_shots: 10 })
      .eq("id", matchId);
    expect(error).toBeNull();
  });

  it("participant can submit their own end", async () => {
    const p = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(p.id);
    await admin().from("tournament_team_members").insert({
      team_id: homeTeamId,
      profile_id: p.id,
      position: "lead",
    });
    const { client } = await signIn(p);
    const { error } = await client.from("match_ends").insert({
      match_id: matchId,
      end_number: 1,
      home_shots: 2,
      away_shots: 0,
      submitted_by: p.id,
    });
    expect(error).toBeNull();
  });

  it("non-participant CANNOT insert a match_end", async () => {
    const outsider = await createTestUser({ role: "player", clubIds: [clubB] });
    users.push(outsider.id);
    const { client } = await signIn(outsider);
    const { error } = await client.from("match_ends").insert({
      match_id: matchId,
      end_number: 99,
      home_shots: 0,
      away_shots: 9,
      submitted_by: outsider.id,
    });
    expect(error).not.toBeNull();
  });

  // ------------------------------------------------------------------
  // Migration 028 — matches participant UPDATE + state-machine guard
  // ------------------------------------------------------------------
  // Real-RLS coverage of the policy + trigger interplay. Closes the
  // class-of-bug from Phase 8d Diagnostic 1 where mocked-Supabase tests
  // bypassed RLS evaluation and silently no-opped UPDATEs against the
  // real DB.

  // Provision a participant tied to a fresh team for each test so cases
  // don't sequence-leak via shared state.
  async function provisionParticipant(opts: { finalized?: boolean } = {}) {
    const a = admin();
    const { data: home } = await a
      .from("tournament_teams")
      .insert({ tournament_id: tournamentId, name: "P-Home" })
      .select("id")
      .single();
    const { data: away } = await a
      .from("tournament_teams")
      .insert({ tournament_id: tournamentId, name: "P-Away" })
      .select("id")
      .single();
    const player = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(player.id);
    await a.from("tournament_team_members").insert({
      team_id: home!.id,
      profile_id: player.id,
      position: "skip",
    });
    const { data: m } = await a
      .from("matches")
      .insert({
        tournament_id: tournamentId,
        home_team_id: home!.id,
        away_team_id: away!.id,
        finalized_by_admin: opts.finalized ?? false,
      })
      .select("id")
      .single();
    const { client } = await signIn(player);
    return {
      matchId: m!.id,
      homeTeamId: home!.id,
      awayTeamId: away!.id,
      client,
      player,
    };
  }

  it("participant CAN UPDATE own match — pending → captain_submitted", async () => {
    const { matchId: mid, homeTeamId: ht, client } = await provisionParticipant();
    const { error, data } = await client
      .from("matches")
      .update({
        home_shots: 21,
        away_shots: 14,
        status: "in_progress",
        submission_status: "captain_submitted",
        captain_submitted_at: new Date().toISOString(),
        submitted_by_team_id: ht,
      })
      .eq("id", mid)
      .select("submission_status, home_shots, away_shots, submitted_by_team_id")
      .single();
    expect(error).toBeNull();
    expect(data?.submission_status).toBe("captain_submitted");
    expect(data?.submitted_by_team_id).toBe(ht);
    expect(data?.home_shots).toBe(21);
    expect(data?.away_shots).toBe(14);
  });

  it("non-participant CANNOT UPDATE someone else's match (RLS denies, zero rows affected)", async () => {
    const { matchId: mid } = await provisionParticipant();
    const outsider = await createTestUser({ role: "player", clubIds: [clubB] });
    users.push(outsider.id);
    const { client } = await signIn(outsider);
    const { data, error } = await client
      .from("matches")
      .update({ home_shots: 99, submission_status: "captain_submitted" })
      .eq("id", mid)
      .select("id");
    // RLS denial → empty representation, no error string. Row unchanged.
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const { data: after } = await admin()
      .from("matches")
      .select("home_shots, submission_status")
      .eq("id", mid)
      .single();
    expect(after?.home_shots).toBe(0);
    expect(after?.submission_status).toBe("pending");
  });

  it("participant CANNOT UPDATE a finalized match (finalized_by_admin = true blocks via RLS)", async () => {
    const { matchId: mid, client } = await provisionParticipant({ finalized: true });
    const { data } = await client
      .from("matches")
      .update({ home_shots: 21 })
      .eq("id", mid)
      .select("id");
    expect(data).toEqual([]);
  });

  it("participant CANNOT change immutable columns (home_team_id) — trigger raises", async () => {
    const { matchId: mid, client } = await provisionParticipant();
    const { error } = await client
      .from("matches")
      .update({ home_team_id: homeTeamId })
      .eq("id", mid);
    expect(error?.message).toMatch(/scheduling.*immutable for participants/);
  });

  it("participant CANNOT flip finalized_by_admin — trigger raises", async () => {
    const { matchId: mid, client } = await provisionParticipant();
    const { error } = await client
      .from("matches")
      .update({ finalized_by_admin: true })
      .eq("id", mid);
    expect(error?.message).toMatch(/finalized_by_admin is admin-only/);
  });

  it("participant CANNOT skip captain_submitted (pending → opponent_confirmed direct)", async () => {
    const { matchId: mid, client } = await provisionParticipant();
    const { error } = await client
      .from("matches")
      .update({ submission_status: "opponent_confirmed" })
      .eq("id", mid);
    expect(error?.message).toMatch(/illegal submission_status transition/);
  });

  it("participant CANNOT advance status to completed (admin-only)", async () => {
    const { matchId: mid, client } = await provisionParticipant();
    const { error } = await client
      .from("matches")
      .update({ status: "completed" })
      .eq("id", mid);
    expect(error?.message).toMatch(/illegal status transition/);
  });

  it("participant re-submit preserves captain_submitted_at (audit timestamp frozen)", async () => {
    const { matchId: mid, homeTeamId: ht, client } = await provisionParticipant();
    const t1 = new Date().toISOString();
    await client
      .from("matches")
      .update({
        submission_status: "captain_submitted",
        captain_submitted_at: t1,
        submitted_by_team_id: ht,
        status: "in_progress",
        home_shots: 10,
        away_shots: 5,
      })
      .eq("id", mid);
    await new Promise((r) => setTimeout(r, 50));
    const t2 = new Date().toISOString();
    expect(t2).not.toBe(t1);
    await client
      .from("matches")
      .update({
        submission_status: "captain_submitted",
        captain_submitted_at: t2,
        home_shots: 12,
        away_shots: 7,
      })
      .eq("id", mid);
    const { data: after } = await admin()
      .from("matches")
      .select("captain_submitted_at, home_shots, away_shots")
      .eq("id", mid)
      .single();
    // Trigger silently restored OLD's value despite the action's refresh
    // attempt. Scores updated; timestamp frozen at first submission.
    // Compare instants — Postgres returns `+00:00` form, JS sends `Z`;
    // same Date but different string spelling.
    expect(new Date(after!.captain_submitted_at!).getTime()).toBe(
      new Date(t1).getTime(),
    );
    expect(new Date(after!.captain_submitted_at!).getTime()).not.toBe(
      new Date(t2).getTime(),
    );
    expect(after?.home_shots).toBe(12);
    expect(after?.away_shots).toBe(7);
  });

  // ------------------------------------------------------------------
  // Migration 029 — matches.submitted_by_team_id audit + guard
  // ------------------------------------------------------------------
  // Closes Phase 8d Diagnostic 14 (captain self-confirmed because the
  // post-submit UI couldn't tell the two captains apart). The new
  // column is the audit signal; trigger guarantees layered defence.

  it("first submission writes submitted_by_team_id to the caller's team", async () => {
    const { matchId: mid, homeTeamId: ht, client } = await provisionParticipant();
    const { error } = await client
      .from("matches")
      .update({
        home_shots: 21,
        away_shots: 14,
        status: "in_progress",
        submission_status: "captain_submitted",
        captain_submitted_at: new Date().toISOString(),
        submitted_by_team_id: ht,
      })
      .eq("id", mid);
    expect(error).toBeNull();
    const { data: after } = await admin()
      .from("matches")
      .select("submitted_by_team_id")
      .eq("id", mid)
      .single();
    expect(after?.submitted_by_team_id).toBe(ht);
  });

  it("first submission with submitted_by_team_id null is rejected (DB-pin)", async () => {
    const { matchId: mid, client } = await provisionParticipant();
    const { error } = await client
      .from("matches")
      .update({
        home_shots: 21,
        away_shots: 14,
        status: "in_progress",
        submission_status: "captain_submitted",
        captain_submitted_at: new Date().toISOString(),
      })
      .eq("id", mid);
    expect(error?.message).toMatch(
      /submitted_by_team_id required on first submission/,
    );
  });

  it("participant CANNOT claim opponent's team_id as submitter (trigger raises)", async () => {
    const { matchId: mid, awayTeamId: at, client } = await provisionParticipant();
    const { error } = await client
      .from("matches")
      .update({
        home_shots: 21,
        away_shots: 14,
        status: "in_progress",
        submission_status: "captain_submitted",
        captain_submitted_at: new Date().toISOString(),
        submitted_by_team_id: at,
      })
      .eq("id", mid);
    expect(error?.message).toMatch(
      /caller is not a member of submitted_by_team_id/,
    );
  });

  it("submitted_by_team_id frozen on re-submit (mirrors captain_submitted_at)", async () => {
    const { matchId: mid, homeTeamId: ht, awayTeamId: at, client } =
      await provisionParticipant();
    await client
      .from("matches")
      .update({
        submission_status: "captain_submitted",
        captain_submitted_at: new Date().toISOString(),
        submitted_by_team_id: ht,
        status: "in_progress",
        home_shots: 10,
        away_shots: 5,
      })
      .eq("id", mid);
    // Try to flip submitter on re-submit — trigger silently restores OLD.
    await client
      .from("matches")
      .update({
        submission_status: "captain_submitted",
        submitted_by_team_id: at,
        home_shots: 12,
        away_shots: 7,
      })
      .eq("id", mid);
    const { data: after } = await admin()
      .from("matches")
      .select("submitted_by_team_id, home_shots, away_shots")
      .eq("id", mid)
      .single();
    expect(after?.submitted_by_team_id).toBe(ht);
    expect(after?.home_shots).toBe(12);
    expect(after?.away_shots).toBe(7);
  });

  it("CHECK constraint rejects submitted_by_team_id pointing outside the match", async () => {
    const a = admin();
    const { matchId: mid } = await provisionParticipant();
    // Create a third team on the same tournament that's NOT in this
    // match. Trigger gate (caller-membership) doesn't fire because we
    // run as service-role; the CHECK constraint should still raise.
    const { data: foreign } = await a
      .from("tournament_teams")
      .insert({ tournament_id: tournamentId, name: "Foreign" })
      .select("id")
      .single();
    const { error } = await a
      .from("matches")
      .update({ submitted_by_team_id: foreign!.id })
      .eq("id", mid);
    expect(error?.message).toMatch(/matches_submitter_is_participant/);
  });
});
