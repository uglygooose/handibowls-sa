import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, createTestUser, seedClub, signIn } from "./helpers";

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("RLS · profiles", () => {
  let clubA: string;
  let clubB: string;

  beforeAll(async () => {
    clubA = await seedClub("Profiles RLS A");
    clubB = await seedClub("Profiles RLS B");
    clubs.push(clubA, clubB);
  });

  it("user can update their own profile", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(u.id);
    const { client } = await signIn(u);
    const { error } = await client
      .from("profiles")
      .update({ first_name: "Renamed" })
      .eq("id", u.id);
    expect(error).toBeNull();
  });

  it("user cannot update another user's profile", async () => {
    const victim = await createTestUser({ role: "player", clubIds: [clubA] });
    const attacker = await createTestUser({ role: "player", clubIds: [clubB] });
    users.push(victim.id, attacker.id);
    const { client } = await signIn(attacker);
    const { data } = await client
      .from("profiles")
      .update({ first_name: "Owned" })
      .eq("id", victim.id)
      .select();
    expect(data).toEqual([]);
  });

  it("same-club player can READ another member's profile", async () => {
    const p1 = await createTestUser({ role: "player", clubIds: [clubA] });
    const p2 = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(p1.id, p2.id);
    const { client } = await signIn(p1);
    const { data } = await client
      .from("profiles")
      .select("id, first_name")
      .eq("id", p2.id);
    expect(data?.length).toBe(1);
  });

  it("cross-club player CANNOT read another club's profile", async () => {
    const p1 = await createTestUser({ role: "player", clubIds: [clubA] });
    const p2 = await createTestUser({ role: "player", clubIds: [clubB] });
    users.push(p1.id, p2.id);
    const { client } = await signIn(p1);
    const { data } = await client
      .from("profiles")
      .select("id")
      .eq("id", p2.id);
    expect(data).toEqual([]);
  });

  it("club_admin can read their club members' profiles", async () => {
    const adminUser = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    const member = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(adminUser.id, member.id);
    const { client } = await signIn(adminUser);
    const { data } = await client
      .from("profiles")
      .select("id")
      .eq("id", member.id);
    expect(data?.length).toBe(1);
  });
});
