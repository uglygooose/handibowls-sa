import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anon,
  cleanup,
  createTestUser,
  seedClub,
  signIn,
} from "./helpers";

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("RLS · clubs", () => {
  let clubA: string;
  let clubB: string;

  beforeAll(async () => {
    clubA = await seedClub("Clubs RLS A");
    clubB = await seedClub("Clubs RLS B");
    clubs.push(clubA, clubB);
  });

  it("anon cannot read any club", async () => {
    const { data, error } = await anon().from("clubs").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("player can read their own club but not others", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(u.id);
    const { client } = await signIn(u);
    const { data } = await client.from("clubs").select("id, name");
    const ids = (data ?? []).map((c) => c.id);
    expect(ids).toContain(clubA);
    expect(ids).not.toContain(clubB);
  });

  it("club_admin can UPDATE their club", async () => {
    const u = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    users.push(u.id);
    const { client } = await signIn(u);
    const { error } = await client
      .from("clubs")
      .update({ city: "New City A" })
      .eq("id", clubA);
    expect(error).toBeNull();
  });

  it("club_admin CANNOT update a club they don't admin", async () => {
    const u = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    users.push(u.id);
    const { client } = await signIn(u);
    const { data, error } = await client
      .from("clubs")
      .update({ city: "Hack" })
      .eq("id", clubB)
      .select();
    // RLS silently filters UPDATE — no error, zero rows affected.
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const { data: check } = await admin()
      .from("clubs")
      .select("city")
      .eq("id", clubB)
      .single();
    expect(check?.city).not.toBe("Hack");
  });

  it("super_admin can update any club", async () => {
    const u = await createTestUser({ role: "super_admin" });
    users.push(u.id);
    const { client } = await signIn(u);
    const { error } = await client
      .from("clubs")
      .update({ city: "Sudo" })
      .eq("id", clubB);
    expect(error).toBeNull();
  });
});
