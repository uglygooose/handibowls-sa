import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createClient as createSbClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { AuthContext } from "@/lib/auth/role";

// Phase 13 / 13-2 / Batch B1b — DRIFT-L269 closure.
//
// Real-database integration test for adminScheduleT20Assessment —
// the action wrapper around the admin_schedule_t20_assessment RPC
// (migration 037). The RPC itself has RLS-mode coverage at
// tests/rpc/t20-assessment-loop.test.ts; this test pins the action
// wrapper's full call shape end-to-end (auth → Zod → RPC → result
// mapping → revalidatePath).
//
// Pattern lifted from tests/integration/actions/t20-finalize.test.ts
// (vi.mock of next/headers + next/cache + auth/role + supabase/server
// to inject a JWT-bound supabase-js client and a per-test
// AuthContext).

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    setAll: () => {},
  }),
  headers: async () => new Map(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const e = new Error(`NEXT_REDIRECT;${url}`);
    (e as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw e;
  },
}));

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ctxHolder: {
  ctx: AuthContext | null;
  client: ReturnType<typeof createSbClient<Database>> | null;
} = { ctx: null, client: null };

vi.mock("@/lib/auth/role", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/role")>();
  return {
    ...actual,
    getAuthContext: async () => ctxHolder.ctx,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ctxHolder.client,
}));

import { admin, cleanup, createTestUser, seedClub, signIn } from "../../rls/helpers";

const { adminScheduleT20Assessment } = await import(
  "@/app/(club-admin)/manage/bookings/new/_actions"
);

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("adminScheduleT20Assessment · live RPC path (DRIFT-L269)", () => {
  let clubA: string;
  let clubB: string;

  beforeAll(async () => {
    clubA = await seedClub("Schedule T20 A");
    clubB = await seedClub("Schedule T20 B");
    clubs.push(clubA, clubB);
  });

  // Seed a green + rink at the given club so the schedule RPC has
  // somewhere to point. Returns the rink id.
  async function seedRink(clubId: string): Promise<string> {
    const a = admin();
    // greens (club_id, name) is unique-constrained — randomise the
    // name suffix so multiple test cases per file don't collide.
    const { data: green } = await a
      .from("greens")
      .insert({
        club_id: clubId,
        name: `Schedule Green ${randomUUID().slice(0, 8)}`,
        rink_count: 6,
      })
      .select("id")
      .single()
      .throwOnError();
    const { data: rink } = await a
      .from("rinks")
      .insert({ green_id: green!.id, number: 1, active: true })
      .select("id")
      .single()
      .throwOnError();
    return rink!.id;
  }

  function bindClientFor(token: string) {
    return createSbClient<Database>(URL, ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });
  }

  it("schedules an assessment when called by a club_admin for a member of their club (kind='ok')", async () => {
    const adminUser = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    const player = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(adminUser.id, player.id);
    const rinkId = await seedRink(clubA);

    const session = await signIn(adminUser);
    ctxHolder.ctx = {
      userId: adminUser.id,
      role: "club_admin",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubA],
      email: adminUser.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const startsAt = new Date(Date.now() + 86_400_000).toISOString();
    const result = await adminScheduleT20Assessment({
      player_id: player.id,
      rink_id: rinkId,
      starts_at: startsAt,
      duration_minutes: 60,
      notes: "Morning slot",
    });

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.bookingId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }

    if (result.kind === "ok") {
      const { data: row } = await admin()
        .from("bookings")
        .select("club_id, rink_id, for_profile_id, purpose, notes, status")
        .eq("id", result.bookingId)
        .single();
      expect(row?.club_id).toBe(clubA);
      expect(row?.rink_id).toBe(rinkId);
      expect(row?.for_profile_id).toBe(player.id);
      expect(row?.purpose).toBe("t20_assessment");
      expect(row?.notes).toBe("Morning slot");
      expect(row?.status).toBe("booked");
    }
  }, 30_000);

  it("returns kind='wrong_role' when called by a player", async () => {
    const player = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(player.id);
    const rinkId = await seedRink(clubA);

    const session = await signIn(player);
    ctxHolder.ctx = {
      userId: player.id,
      role: "player",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubA],
      email: player.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await adminScheduleT20Assessment({
      player_id: player.id,
      rink_id: rinkId,
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      duration_minutes: 60,
      notes: null,
    });

    expect(result.kind).toBe("wrong_role");
  }, 30_000);

  it("returns kind='wrong_player' when admin schedules for a player NOT in their club (cross-club RLS)", async () => {
    const adminA = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    const playerB = await createTestUser({ role: "player", clubIds: [clubB] });
    users.push(adminA.id, playerB.id);
    const rinkA = await seedRink(clubA);

    const session = await signIn(adminA);
    ctxHolder.ctx = {
      userId: adminA.id,
      role: "club_admin",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubA],
      email: adminA.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await adminScheduleT20Assessment({
      player_id: playerB.id,
      rink_id: rinkA,
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      duration_minutes: 60,
      notes: null,
    });

    // The RPC's wrong_player guard fires because playerB is not a
    // member of clubA, so the SECURITY DEFINER routine refuses.
    expect(result.kind).toBe("wrong_player");
  }, 30_000);

  it("returns kind='validation' for malformed input (non-UUID player_id)", async () => {
    const adminUser = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminUser.id);
    const rinkId = await seedRink(clubA);

    const session = await signIn(adminUser);
    ctxHolder.ctx = {
      userId: adminUser.id,
      role: "club_admin",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubA],
      email: adminUser.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await adminScheduleT20Assessment({
      player_id: "not-a-uuid",
      rink_id: rinkId,
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      duration_minutes: 60,
      notes: null,
    });

    expect(result.kind).toBe("validation");
  }, 30_000);
});
