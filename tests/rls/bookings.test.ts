import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTestUser, seedClub, signIn } from "./helpers";

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("RLS · bookings", () => {
  let clubA: string;
  let clubB: string;
  let rinkA: string;

  beforeAll(async () => {
    clubA = await seedClub("Book A");
    clubB = await seedClub("Book B");
    clubs.push(clubA, clubB);

    const a = admin();
    const { data: green, error: ge } = await a
      .from("greens")
      .insert({ club_id: clubA, name: "G1" })
      .select("id")
      .single();
    if (ge || !green) throw ge;
    const { data: rink, error: re } = await a
      .from("rinks")
      .insert({ green_id: green.id, number: 1 })
      .select("id")
      .single();
    if (re || !rink) throw re;
    rinkA = rink.id;
  });

  it("club member can INSERT a booking on their club's rink", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(u.id);
    const { client } = await signIn(u);
    const now = new Date();
    const start = new Date(now.getTime() + 60_000).toISOString();
    const end = new Date(now.getTime() + 3_660_000).toISOString();
    const { error } = await client.from("bookings").insert({
      rink_id: rinkA,
      club_id: clubA,
      booked_by: u.id,
      starts_at: start,
      ends_at: end,
    });
    expect(error).toBeNull();
  });

  it("non-member CANNOT insert a booking on another club's rink", async () => {
    const outsider = await createTestUser({
      role: "player",
      clubIds: [clubB],
    });
    users.push(outsider.id);
    const { client } = await signIn(outsider);
    const start = new Date(Date.now() + 7_200_000).toISOString();
    const end = new Date(Date.now() + 10_800_000).toISOString();
    const { error } = await client.from("bookings").insert({
      rink_id: rinkA,
      club_id: clubA,
      booked_by: outsider.id,
      starts_at: start,
      ends_at: end,
    });
    expect(error).not.toBeNull();
  });

  it("GIST constraint prevents overlapping bookings on same rink", async () => {
    const start = new Date(Date.now() + 86_400_000).toISOString();
    const end = new Date(Date.now() + 90_000_000).toISOString();
    const a = admin();
    const { error: first } = await a.from("bookings").insert({
      rink_id: rinkA,
      club_id: clubA,
      starts_at: start,
      ends_at: end,
    });
    expect(first).toBeNull();
    const { error: second } = await a.from("bookings").insert({
      rink_id: rinkA,
      club_id: clubA,
      starts_at: start,
      ends_at: end,
    });
    expect(second).not.toBeNull();
    expect(second?.message).toMatch(/bookings_no_overlap|exclusion/i);
  });
});
