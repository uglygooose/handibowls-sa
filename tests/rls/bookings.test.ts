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

  // ------------------------------------------------------------------
  // Phase 8e-2 — createBooking action contract coverage
  // ------------------------------------------------------------------
  // The action server-derives booked_by + club_id and only INSERTs
  // through the cookie-bound supabase client (never service-role), so
  // the RLS policy IS the authorization. These cases pin the policy
  // surface so a future refactor that relaxes `bookings_self_insert`
  // gets caught.

  it("8e-2 · player CANNOT stamp booked_by with another user's id (with check denial)", async () => {
    const me = await createTestUser({ role: "player", clubIds: [clubA] });
    const other = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(me.id, other.id);
    const { client } = await signIn(me);
    const start = new Date(Date.now() + 200_000_000).toISOString();
    const end = new Date(Date.now() + 203_600_000).toISOString();
    const { data, error } = await client
      .from("bookings")
      .insert({
        rink_id: rinkA,
        club_id: clubA,
        booked_by: other.id, // hostile — claim someone else's identity
        starts_at: start,
        ends_at: end,
      })
      .select("id");
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("8e-2 · GIST is rink-scoped — alternate rink in same slot succeeds", async () => {
    const a = admin();
    const { data: g } = await a
      .from("greens")
      .insert({ club_id: clubA, name: "Alt Green", rink_count: 1 })
      .select("id")
      .single();
    const { data: r2 } = await a
      .from("rinks")
      .insert({ green_id: g!.id, number: 1, active: true })
      .select("id")
      .single();
    const start = new Date(Date.now() + 250_000_000).toISOString();
    const end = new Date(Date.now() + 253_600_000).toISOString();

    const { error: firstErr } = await a.from("bookings").insert({
      rink_id: rinkA,
      club_id: clubA,
      starts_at: start,
      ends_at: end,
    });
    expect(firstErr).toBeNull();
    // Same time window, DIFFERENT rink — GIST is per-rink so no conflict.
    const { error: altErr } = await a.from("bookings").insert({
      rink_id: r2!.id,
      club_id: clubA,
      starts_at: start,
      ends_at: end,
    });
    expect(altErr).toBeNull();
  });

  it("8e-2 · GIST releases the slot when the prior booking is cancelled", async () => {
    const a = admin();
    const start = new Date(Date.now() + 300_000_000).toISOString();
    const end = new Date(Date.now() + 303_600_000).toISOString();
    const { data: original, error: insErr } = await a
      .from("bookings")
      .insert({
        rink_id: rinkA,
        club_id: clubA,
        starts_at: start,
        ends_at: end,
      })
      .select("id")
      .single();
    expect(insErr).toBeNull();
    expect(original?.id).toBeTruthy();

    // Cancellation flips status — GIST WHERE clause `status='booked'`
    // releases the row from the exclusion set.
    await a
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", original!.id);

    // Same slot now bookable again.
    const { error: rebookErr } = await a.from("bookings").insert({
      rink_id: rinkA,
      club_id: clubA,
      starts_at: start,
      ends_at: end,
    });
    expect(rebookErr).toBeNull();
  });
});
