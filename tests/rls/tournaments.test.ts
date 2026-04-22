import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTestUser, seedClub, signIn } from "./helpers";

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("RLS · tournaments", () => {
  let clubA: string;
  let clubB: string;
  let tourA: string;

  beforeAll(async () => {
    clubA = await seedClub("Tour A");
    clubB = await seedClub("Tour B");
    clubs.push(clubA, clubB);

    const { data, error } = await admin()
      .from("tournaments")
      .insert({
        host_club_id: clubA,
        name: "Seed Classic",
        format: "singles",
        structure: "knockout",
        status: "open",
      })
      .select("id")
      .single();
    if (error || !data) throw error;
    tourA = data.id;
  });

  it("club_admin of host club can update their tournament", async () => {
    const u = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    users.push(u.id);
    const { client } = await signIn(u);
    const { error } = await client
      .from("tournaments")
      .update({ name: "Renamed" })
      .eq("id", tourA);
    expect(error).toBeNull();
  });

  it("club_admin of another club CANNOT update a tournament", async () => {
    const u = await createTestUser({ role: "club_admin", clubIds: [clubB] });
    users.push(u.id);
    const { client } = await signIn(u);
    const { data } = await client
      .from("tournaments")
      .update({ name: "Hacked" })
      .eq("id", tourA)
      .select();
    expect(data).toEqual([]);
  });

  it("player can READ a tournament in their club", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(u.id);
    const { client } = await signIn(u);
    const { data } = await client
      .from("tournaments")
      .select("id")
      .eq("id", tourA);
    expect(data?.length).toBe(1);
  });

  it("player CANNOT insert tournaments", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(u.id);
    const { client } = await signIn(u);
    const { error } = await client.from("tournaments").insert({
      host_club_id: clubA,
      name: "Rogue",
      format: "singles",
      structure: "knockout",
    });
    expect(error).not.toBeNull();
  });
});
