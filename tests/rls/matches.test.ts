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
});
