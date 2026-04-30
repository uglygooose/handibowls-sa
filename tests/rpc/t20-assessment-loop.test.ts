import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  admin,
  cleanup,
  createTestUser,
  seedClub,
  signIn,
  type TestUser,
} from "../rls/helpers";

// Phase 12 / 12-1 followup — request_t20_assessment +
// admin_schedule_t20_assessment RPCs (migration 037).
//
// Hits the local Supabase stack via npm run test:integration. Mirrors
// the send_message integration suite's pattern: seed clubs/users/rinks
// via service role, sign in via supabase-js, exercise the RPC under
// the player or admin's JWT.
//
// Coverage targets the discriminated result kinds, not exhaustive
// branch enumeration. Each `it` asserts the .kind value + the
// downstream side effect (message / booking / notification rows).

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

async function seedRink(clubId: string): Promise<{ greenId: string; rinkId: string }> {
  const a = admin();
  const greenName = `t20rpc-${randomUUID().slice(0, 8)}`;
  const { data: green, error: gErr } = await a
    .from("greens")
    .insert({ club_id: clubId, name: greenName, rink_count: 1 })
    .select("id")
    .single();
  if (gErr || !green) throw new Error(`green insert: ${gErr?.message}`);
  const { data: rink, error: rErr } = await a
    .from("rinks")
    .insert({ green_id: green.id, number: 1, active: true })
    .select("id")
    .single();
  if (rErr || !rink) throw new Error(`rink insert: ${rErr?.message}`);
  return { greenId: green.id, rinkId: rink.id };
}

describe("RPC · public.request_t20_assessment", () => {
  let clubA: string;
  let clubB: string;
  let admin1: TestUser;
  let admin2: TestUser;

  beforeAll(async () => {
    clubA = await seedClub("RPC T20Req A");
    clubB = await seedClub("RPC T20Req B");
    clubs.push(clubA, clubB);

    admin1 = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    admin2 = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    users.push(admin1.id, admin2.id);
  });

  it("ok → message + 2 recipients + 2 notifications, recipient_count = 2", async () => {
    const player = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(player.id);

    const { client } = await signIn(player);
    const { data, error } = await client.rpc("request_t20_assessment", {
      p_club_id: clubA,
    });
    expect(error).toBeNull();
    expect(data?.[0]?.kind).toBe("ok");
    expect(data?.[0]?.recipient_count).toBe(2);
    const messageId = data?.[0]?.message_id;
    expect(messageId).toBeTruthy();

    // Side-effect verification via service role.
    const a = admin();
    const { data: msg } = await a
      .from("messages")
      .select("subject, status, audience_kind, recipient_count, sender_id")
      .eq("id", messageId!)
      .single();
    expect(msg?.subject.startsWith("Twenty 20 assessment request — ")).toBe(true);
    expect(msg?.status).toBe("sent");
    expect(msg?.audience_kind).toBe("custom");
    expect(msg?.recipient_count).toBe(2);
    expect(msg?.sender_id).toBe(player.id);

    const { data: recips } = await a
      .from("message_recipients")
      .select("profile_id")
      .eq("message_id", messageId!);
    expect(recips?.length).toBe(2);
    const recipIds = (recips ?? []).map((r) => r.profile_id).sort();
    expect(recipIds).toEqual([admin1.id, admin2.id].sort());

    const { data: notifs } = await a
      .from("notifications")
      .select("kind, profile_id, related_id")
      .eq("kind", "t20_assessment_request")
      .eq("related_id", messageId!);
    expect(notifs?.length).toBe(2);
  });

  it("throttled → second request inside 24h returns kind='throttled'", async () => {
    const player = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(player.id);

    const { client } = await signIn(player);
    const first = await client.rpc("request_t20_assessment", { p_club_id: clubA });
    expect(first.data?.[0]?.kind).toBe("ok");

    const second = await client.rpc("request_t20_assessment", { p_club_id: clubA });
    expect(second.data?.[0]?.kind).toBe("throttled");
    expect(second.data?.[0]?.message_id).toBe(first.data?.[0]?.message_id);
  });

  it("wrong_club → player not a member of target club", async () => {
    const player = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(player.id);
    const { client } = await signIn(player);
    const { data } = await client.rpc("request_t20_assessment", { p_club_id: clubB });
    expect(data?.[0]?.kind).toBe("wrong_club");
  });

  it("no_admins → club has no club_admin_assignments rows", async () => {
    const lonelyClub = await seedClub("RPC T20Req lonely");
    clubs.push(lonelyClub);
    const player = await createTestUser({ role: "player", clubIds: [lonelyClub] });
    users.push(player.id);
    const { client } = await signIn(player);
    const { data } = await client.rpc("request_t20_assessment", {
      p_club_id: lonelyClub,
    });
    expect(data?.[0]?.kind).toBe("no_admins");
  });
});

describe("RPC · public.admin_schedule_t20_assessment", () => {
  let clubA: string;
  let clubB: string;
  let rinkA: string;
  let rinkAlt: string;
  let admin1: TestUser;
  let admin2: TestUser;
  let player1: TestUser;

  beforeAll(async () => {
    clubA = await seedClub("RPC T20Sched A");
    clubB = await seedClub("RPC T20Sched B");
    clubs.push(clubA, clubB);

    const a = await seedRink(clubA);
    rinkA = a.rinkId;
    const alt = await seedRink(clubA);
    rinkAlt = alt.rinkId;

    admin1 = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    admin2 = await createTestUser({ role: "club_admin", clubIds: [clubB] });
    player1 = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(admin1.id, admin2.id, player1.id);
  });

  it("ok → booking inserted with purpose=t20_assessment + for_profile_id + player notification", async () => {
    const { client } = await signIn(admin1);
    const startsAt = new Date(Date.now() + 24 * 3600_000).toISOString();
    const endsAt = new Date(Date.now() + 24 * 3600_000 + 90 * 60_000).toISOString();
    const { data, error } = await client.rpc("admin_schedule_t20_assessment", {
      p_player_id: player1.id,
      p_rink_id: rinkA,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
      p_notes: "Gold-tier assessment",
    });
    expect(error).toBeNull();
    expect(data?.[0]?.kind).toBe("ok");
    const bookingId = data?.[0]?.booking_id;

    const a = admin();
    const { data: bk } = await a
      .from("bookings")
      .select("purpose, for_profile_id, booked_by, club_id, notes, status")
      .eq("id", bookingId!)
      .single();
    expect(bk?.purpose).toBe("t20_assessment");
    expect(bk?.for_profile_id).toBe(player1.id);
    expect(bk?.booked_by).toBe(admin1.id);
    expect(bk?.club_id).toBe(clubA);
    expect(bk?.status).toBe("booked");
    expect(bk?.notes).toBe("Gold-tier assessment");

    const { data: notif } = await a
      .from("notifications")
      .select("kind, profile_id, related_id")
      .eq("related_id", bookingId!)
      .eq("kind", "t20_assessment_scheduled")
      .single();
    expect(notif?.profile_id).toBe(player1.id);
  });

  it("slot_taken → second booking on same rink+overlap returns kind='slot_taken'", async () => {
    const { client } = await signIn(admin1);
    const startsAt = new Date(Date.now() + 48 * 3600_000).toISOString();
    const endsAt = new Date(Date.now() + 48 * 3600_000 + 90 * 60_000).toISOString();
    const first = await client.rpc("admin_schedule_t20_assessment", {
      p_player_id: player1.id,
      p_rink_id: rinkAlt,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
    });
    expect(first.data?.[0]?.kind).toBe("ok");

    const second = await client.rpc("admin_schedule_t20_assessment", {
      p_player_id: player1.id,
      p_rink_id: rinkAlt,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
    });
    expect(second.data?.[0]?.kind).toBe("slot_taken");
    expect(second.data?.[0]?.booking_id).toBeNull();
  });

  it("wrong_club → admin not assigned to rink's club", async () => {
    const { client } = await signIn(admin2);
    const { data } = await client.rpc("admin_schedule_t20_assessment", {
      p_player_id: player1.id,
      p_rink_id: rinkA,
      p_starts_at: new Date(Date.now() + 72 * 3600_000).toISOString(),
      p_ends_at: new Date(Date.now() + 72 * 3600_000 + 90 * 60_000).toISOString(),
    });
    expect(data?.[0]?.kind).toBe("wrong_club");
  });

  it("wrong_player → player not an active member of the rink's club", async () => {
    const stranger = await createTestUser({ role: "player", clubIds: [clubB] });
    users.push(stranger.id);
    const { client } = await signIn(admin1);
    const { data } = await client.rpc("admin_schedule_t20_assessment", {
      p_player_id: stranger.id,
      p_rink_id: rinkA,
      p_starts_at: new Date(Date.now() + 96 * 3600_000).toISOString(),
      p_ends_at: new Date(Date.now() + 96 * 3600_000 + 90 * 60_000).toISOString(),
    });
    expect(data?.[0]?.kind).toBe("wrong_player");
  });

  it("bad_input → ends_at <= starts_at returns kind='bad_input'", async () => {
    const { client } = await signIn(admin1);
    const sameTs = new Date(Date.now() + 120 * 3600_000).toISOString();
    const { data } = await client.rpc("admin_schedule_t20_assessment", {
      p_player_id: player1.id,
      p_rink_id: rinkA,
      p_starts_at: sameTs,
      p_ends_at: sameTs,
    });
    expect(data?.[0]?.kind).toBe("bad_input");
  });

  it("wrong_role → player caller is rejected", async () => {
    const { client } = await signIn(player1);
    const { data } = await client.rpc("admin_schedule_t20_assessment", {
      p_player_id: player1.id,
      p_rink_id: rinkA,
      p_starts_at: new Date(Date.now() + 144 * 3600_000).toISOString(),
      p_ends_at: new Date(Date.now() + 144 * 3600_000 + 90 * 60_000).toISOString(),
    });
    expect(data?.[0]?.kind).toBe("wrong_role");
  });
});
