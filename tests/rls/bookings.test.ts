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

  // ------------------------------------------------------------------
  // Phase 8e-3 — cancel_own_booking RPC paths (migration 030)
  // ------------------------------------------------------------------
  // Mirrors the action layer's CancelBookingResult contract. Each
  // case targets exactly one error / success path so the SQLSTATE +
  // message-prefix routing stays honest end-to-end.

  // Each 8e-3 cancel_own_booking case needs a booking with a specific
  // window (e.g. <2h before now to trigger too_close_to_start). Multiple
  // tests using the same offsets on the same rink hit GIST exclusion
  // when an earlier test left a row in 'booked' (e.g. the non-owner
  // test fails its RPC — the seed booking stays alive). Allocate a
  // fresh dedicated rink per call so per-test windows can never
  // collide with each other or with earlier suites' rinkA writes.
  async function seedOwnBooking(opts: {
    user: { id: string; email: string };
    startsInMs: number;
    endsInMs: number;
  }): Promise<string> {
    const a = admin();
    const greenName = `8e3-${randomBookingTag()}`;
    const { data: green, error: greenErr } = await a
      .from("greens")
      .insert({ club_id: clubA, name: greenName, rink_count: 1 })
      .select("id")
      .single();
    if (greenErr || !green) {
      throw new Error(`seedOwnBooking: green insert ${greenErr?.message}`);
    }
    const { data: rink, error: rinkErr } = await a
      .from("rinks")
      .insert({ green_id: green.id, number: 1, active: true })
      .select("id")
      .single();
    if (rinkErr || !rink) {
      throw new Error(`seedOwnBooking: rink insert ${rinkErr?.message}`);
    }
    const { data, error } = await a
      .from("bookings")
      .insert({
        rink_id: rink.id,
        club_id: clubA,
        booked_by: opts.user.id,
        purpose: "practice",
        starts_at: new Date(Date.now() + opts.startsInMs).toISOString(),
        ends_at: new Date(Date.now() + opts.endsInMs).toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`seedOwnBooking: ${error?.message}`);
    return data.id;
  }
  function randomBookingTag(): string {
    return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }

  it("8e-3 · cancel_own_booking RPC: owner CAN cancel >2h before start (success)", async () => {
    const player = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(player.id);
    const FIVE_HOURS = 5 * 60 * 60 * 1000;
    const SEVEN_HOURS = 7 * 60 * 60 * 1000;
    const id = await seedOwnBooking({
      user: player,
      startsInMs: FIVE_HOURS,
      endsInMs: SEVEN_HOURS,
    });
    const { client } = await signIn(player);
    const { error } = await client.rpc("cancel_own_booking", {
      p_booking_id: id,
    });
    expect(error).toBeNull();
    const { data: after } = await admin()
      .from("bookings")
      .select("status")
      .eq("id", id)
      .single();
    expect(after?.status).toBe("cancelled");
  });

  it("8e-3 · cancel_own_booking RPC: owner CANNOT cancel <2h before start (too_close_to_start)", async () => {
    const player = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(player.id);
    const ONE_HOUR = 60 * 60 * 1000;
    const THREE_HOURS = 3 * 60 * 60 * 1000;
    const id = await seedOwnBooking({
      user: player,
      startsInMs: ONE_HOUR,
      endsInMs: THREE_HOURS,
    });
    const { client } = await signIn(player);
    const { error } = await client.rpc("cancel_own_booking", {
      p_booking_id: id,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("22023");
    expect(error?.message).toMatch(/too_close_to_start/);
  });

  it("8e-3 · cancel_own_booking RPC: non-owner CANNOT cancel another user's booking (not_owner)", async () => {
    const owner = await createTestUser({ role: "player", clubIds: [clubA] });
    const intruder = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(owner.id, intruder.id);
    const FIVE_HOURS = 5 * 60 * 60 * 1000;
    const SEVEN_HOURS = 7 * 60 * 60 * 1000;
    const id = await seedOwnBooking({
      user: owner,
      startsInMs: FIVE_HOURS,
      endsInMs: SEVEN_HOURS,
    });
    const { client } = await signIn(intruder);
    const { error } = await client.rpc("cancel_own_booking", {
      p_booking_id: id,
    });
    expect(error?.code).toBe("42501");
    expect(error?.message).toMatch(/not_owner/);
  });

  it("8e-3 · cancel_own_booking RPC: cancelling an already-cancelled booking returns wrong_state", async () => {
    const player = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(player.id);
    const FIVE_HOURS = 5 * 60 * 60 * 1000;
    const SEVEN_HOURS = 7 * 60 * 60 * 1000;
    const id = await seedOwnBooking({
      user: player,
      startsInMs: FIVE_HOURS,
      endsInMs: SEVEN_HOURS,
    });
    // First cancel succeeds.
    await admin()
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);
    // Second attempt by the owner via RPC raises wrong_state.
    const { client } = await signIn(player);
    const { error } = await client.rpc("cancel_own_booking", {
      p_booking_id: id,
    });
    expect(error?.code).toBe("22023");
    expect(error?.message).toMatch(/wrong_state/);
  });

  it("8e-3 · cancel_own_booking RPC: non-existent booking_id returns not_found", async () => {
    const player = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(player.id);
    const { client } = await signIn(player);
    const { error } = await client.rpc("cancel_own_booking", {
      p_booking_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error?.code).toBe("P0002");
    expect(error?.message).toMatch(/not_found/);
  });
});
