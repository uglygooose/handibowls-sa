import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSbClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { AuthContext } from "@/lib/auth/role";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], setAll: () => {} }),
  headers: async () => new Map(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const e = new Error(`NEXT_REDIRECT;${url}`);
    (e as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw e;
  },
}));

// Phase 12.5 / 12.5-5 — live SQL integration coverage for the new
// `updateTournament` server action. Mirrors the t20-finalize pattern:
// real Supabase via the test users, mocked auth + cookie-bound
// client, then the action runs end-to-end against the database.
//
// Five cases — happy path + the three failure modes the action
// recognises (validation errors are pinned at the unit level on the
// schema; the integration cases here are the live DB paths):
//
//   1. host club_admin updates allowed fields → ok
//   2. optimistic-lock collision → ok=false + code='stale' +
//      currentUpdatedAt
//   3. format-locked: tournament with a scored match_end row
//      rejects format change → ok=false + code='format_locked'
//   4. wrong club's club_admin → ok=false + "Not authorized"
//   5. player → ok=false + "Not authorized"

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

const { updateTournament } = await import(
  "@/app/(club-admin)/manage/tournaments/_actions"
);

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

function bindClientFor(token: string) {
  return createSbClient<Database>(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function seedTournament(opts: {
  clubId: string;
}): Promise<{ id: string; updated_at: string }> {
  const { data, error } = await admin()
    .from("tournaments")
    .insert({
      host_club_id: opts.clubId,
      name: `T-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      format: "singles",
      structure: "knockout",
      status: "open",
    })
    .select("id, updated_at")
    .single();
  if (error || !data) throw error ?? new Error("seedTournament: no data");
  return { id: data.id, updated_at: data.updated_at };
}

async function seedScoredMatch(tournamentId: string): Promise<void> {
  // Bare match (no teams — schema permits null home/away_team_id) +
  // one match_ends row with non-zero shots so the predicate fires.
  const { data: m, error: mErr } = await admin()
    .from("matches")
    .insert({ tournament_id: tournamentId, status: "in_progress" })
    .select("id")
    .single();
  if (mErr || !m) throw mErr ?? new Error("seedScoredMatch: no match");
  const { error: eErr } = await admin().from("match_ends").insert({
    match_id: m.id,
    end_number: 1,
    home_shots: 2,
    away_shots: 0,
  });
  if (eErr) throw eErr;
}

function basePayload(id: string, updated_at: string) {
  return {
    tournament_id: id,
    expected_updated_at: updated_at,
    name: "Updated Tournament",
    scope: "club" as const,
    format: "singles" as const,
    structure: "knockout" as const,
    category: "open" as const,
    age_group: "open" as const,
    handicap_rule: "scratch" as const,
    seeding_method: "random" as const,
    fair_rink: true,
    green_ids: [] as string[],
  };
}

function bindCtx(
  user: { id: string; email: string; role: "club_admin" | "player" | "super_admin" },
  session: { token: string; jwt: { app_metadata: { club_ids?: string[] } } },
  fallbackClubIds: string[],
) {
  ctxHolder.ctx = {
    userId: user.id,
    role: user.role,
    clubIds:
      (session.jwt.app_metadata.club_ids as string[] | undefined) ?? fallbackClubIds,
    email: user.email,
  };
  ctxHolder.client = bindClientFor(session.token);
}

describe("updateTournament · live SQL path (12.5-5)", () => {
  let clubA: string;
  let clubB: string;

  beforeAll(async () => {
    clubA = await seedClub("Update A");
    clubB = await seedClub("Update B");
    clubs.push(clubA, clubB);
  });

  it("happy path — host club_admin updates allowed fields and the row's updated_at advances", async () => {
    const t = await seedTournament({ clubId: clubA });
    const adm = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    users.push(adm.id);
    const session = await signIn(adm);
    bindCtx(adm, session, [clubA]);

    const result = await updateTournament(basePayload(t.id, t.updated_at));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tournament_id).toBe(t.id);
      expect(result.data.updated_at).not.toBe(t.updated_at);
    }

    const { data: row } = await admin()
      .from("tournaments")
      .select("name, updated_at")
      .eq("id", t.id)
      .single();
    expect(row?.name).toBe("Updated Tournament");
    expect(row?.updated_at).not.toBe(t.updated_at);
  });

  it("optimistic-lock conflict — second save with the OLD updated_at returns code='stale' and a fresh currentUpdatedAt", async () => {
    const t = await seedTournament({ clubId: clubA });
    const adm = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    users.push(adm.id);
    const session = await signIn(adm);
    bindCtx(adm, session, [clubA]);

    // First save bumps updated_at.
    const first = await updateTournament({
      ...basePayload(t.id, t.updated_at),
      name: "First save",
    });
    expect(first.ok).toBe(true);

    // Second save with the ORIGINAL updated_at — concurrent-edit
    // simulation. The .eq('updated_at', oldValue) clause matches
    // zero rows, the action re-reads the fresh value and returns it.
    const second = await updateTournament({
      ...basePayload(t.id, t.updated_at),
      name: "Second save (should be rejected)",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe("stale");
      expect(second.currentUpdatedAt).toBeTruthy();
      expect(second.currentUpdatedAt).not.toBe(t.updated_at);
    }

    // Confirm the persisted name is the FIRST save's, not the second.
    const { data: row } = await admin()
      .from("tournaments")
      .select("name")
      .eq("id", t.id)
      .single();
    expect(row?.name).toBe("First save");
  });

  it("format-locked — tournament with a scored match_ends row rejects format change with code='format_locked'", async () => {
    const t = await seedTournament({ clubId: clubA });
    await seedScoredMatch(t.id);
    const adm = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    users.push(adm.id);
    const session = await signIn(adm);
    bindCtx(adm, session, [clubA]);

    const result = await updateTournament({
      ...basePayload(t.id, t.updated_at),
      format: "pairs", // changed from singles → triggers the gate
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("format_locked");
      expect(result.error).toMatch(/locked once a match has been scored/i);
    }

    // Confirm format was NOT mutated despite the call.
    const { data: row } = await admin()
      .from("tournaments")
      .select("format")
      .eq("id", t.id)
      .single();
    expect(row?.format).toBe("singles");
  });

  it("RLS / role gate — admin of another club cannot mutate (RLS hides the row → 'not found' OR role check denies → 'not authorized'; either is correct, the row must not be mutated)", async () => {
    const t = await seedTournament({ clubId: clubA });
    const admB = await createTestUser({ role: "club_admin", clubIds: [clubB] });
    users.push(admB.id);
    const session = await signIn(admB);
    bindCtx(admB, session, [clubB]);

    const result = await updateTournament(basePayload(t.id, t.updated_at));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Either path is the correct security response — RLS on
      // `tournaments` SELECT filters out non-host-club rows, so the
      // action's pre-fetch returns null → "Tournament not found."
      // (more secure: don't leak existence to non-members). If RLS
      // ever loosened, the role check would catch it with "Not
      // authorized." Test pins both as acceptable.
      const err = result.error.toLowerCase();
      expect(err === "tournament not found." || err.includes("not authorized")).toBe(true);
    }

    // The integrity contract — the row must not be mutated.
    const { data: row } = await admin()
      .from("tournaments")
      .select("name")
      .eq("id", t.id)
      .single();
    expect(row?.name).not.toBe("Updated Tournament");
  });

  it("RLS / role gate — player is rejected with 'Not authorized'", async () => {
    const t = await seedTournament({ clubId: clubA });
    const player = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(player.id);
    const session = await signIn(player);
    bindCtx(player, session, [clubA]);

    const result = await updateTournament(basePayload(t.id, t.updated_at));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain("not authorized");
    }
  });
});
