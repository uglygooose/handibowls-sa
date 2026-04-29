import { describe, expect, it, vi, beforeEach } from "vitest";

// Phase 8d Finding 17 — overview surfaces must filter captain_submitted
// (and beyond) matches out of the next-match queries. Migration 026
// introduced the lifecycle (pending → captain_submitted →
// opponent_confirmed → completed), but three player overview queries
// kept matching on `match.status` only — letting submitted matches
// leak into HeroNextMatch and the tournament-detail "Score next match"
// CTA. Per design audit (player-core.jsx + chat transcripts) overview
// surfaces deliberately treat intermediate lifecycle states as
// invisible; the scorecard owns the post-submit handshake UI.
//
// These tests pin the contract: every overview-match query MUST issue
// `.eq("submission_status", "pending")` on top of the existing
// `.in("status", [...])` predicate. Future drift (e.g., adding
// scheduled / in_progress branches without the lifecycle gate)
// surfaces locally before it ships.

vi.mock("server-only", () => ({}));
vi.mock("react", async (importActual) => {
  const actual = await importActual<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});

let mockCtx:
  | { userId: string; role: string; clubIds: string[]; email: string | null }
  | null = null;
vi.mock("@/lib/auth/role", () => ({
  getAuthContext: async () => mockCtx,
}));

// Per-table query log — every eq()/in()/or()/order() call is captured
// alongside the table name so each test asserts on the predicate set
// the function-under-test issued.
type Call = { table: string; method: string; args: unknown[] };
const calls: Call[] = [];

// Per-table rigged result for the terminal `.maybeSingle()` /
// awaited-array flush. Tests set this before invoking the function.
type Rig = { data: unknown; error: unknown };
const rigs: Record<string, Rig> = {};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {
        select: (...args: unknown[]) => {
          calls.push({ table, method: "select", args });
          return builder;
        },
        eq: (...args: unknown[]) => {
          calls.push({ table, method: "eq", args });
          return builder;
        },
        in: (...args: unknown[]) => {
          calls.push({ table, method: "in", args });
          return builder;
        },
        or: (...args: unknown[]) => {
          calls.push({ table, method: "or", args });
          return builder;
        },
        order: (...args: unknown[]) => {
          calls.push({ table, method: "order", args });
          return builder;
        },
        limit: (...args: unknown[]) => {
          calls.push({ table, method: "limit", args });
          return builder;
        },
        maybeSingle: async () =>
          rigs[table] ?? { data: null, error: null },
        // Awaiting the chain (no terminal method) returns the array shape.
        then: <T>(
          resolve: (v: Rig) => T,
          reject?: (reason: unknown) => T,
        ) => Promise.resolve(rigs[table] ?? { data: [], error: null }).then(
          resolve,
          reject,
        ),
      };
      return builder;
    },
  }),
}));

const { getNextMatchForCurrentPlayer } = await import(
  "@/app/(player)/(gated)/play/_data"
);
const { getEnteredTournamentsForPlayer } = await import(
  "@/app/(player)/(gated)/tournaments/_data"
);
const { getPlayerOpenMatchInTournament } = await import(
  "@/app/(player)/(gated)/tournaments/[id]/_data"
);

const PLAYER = {
  userId: "u-player",
  role: "player",
  clubIds: ["club-demo"],
  email: "player@demo.local",
};

// Helper: every eq call against `matches` issued during the run.
function matchesEqCalls(): Array<[string, unknown]> {
  return calls
    .filter((c) => c.table === "matches" && c.method === "eq")
    .map((c) => [c.args[0] as string, c.args[1]]);
}

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(rigs)) delete rigs[k];
  mockCtx = PLAYER;
});

describe("Finding 17 — getNextMatchForCurrentPlayer", () => {
  it("issues .eq('submission_status', 'pending') alongside the status filter", async () => {
    rigs["tournament_team_members"] = {
      data: [{ team_id: "team-home" }],
      error: null,
    };
    rigs["matches"] = { data: null, error: null };

    await getNextMatchForCurrentPlayer();

    const eqs = matchesEqCalls();
    expect(eqs).toContainEqual(["submission_status", "pending"]);
    // The pre-existing match-status filter is `.in("status", […])` —
    // assert it's still there and didn't get accidentally dropped.
    const inCalls = calls.filter(
      (c) => c.table === "matches" && c.method === "in",
    );
    expect(inCalls.length).toBeGreaterThan(0);
    expect(inCalls.some((c) => c.args[0] === "status")).toBe(true);
  });

  it("returns null when the player has no team memberships (early-out preserved)", async () => {
    rigs["tournament_team_members"] = { data: [], error: null };
    const result = await getNextMatchForCurrentPlayer();
    expect(result).toBeNull();
    // Should never have queried matches when there are no team ids.
    expect(calls.some((c) => c.table === "matches")).toBe(false);
  });

  it("returns null when no matching match exists (post-filter empty)", async () => {
    rigs["tournament_team_members"] = {
      data: [{ team_id: "team-home" }],
      error: null,
    };
    rigs["matches"] = { data: null, error: null };
    const result = await getNextMatchForCurrentPlayer();
    expect(result).toBeNull();
  });
});

describe("Finding 17 — tournamentsWithOpenMatchForPlayer (via getEnteredTournamentsForPlayer)", () => {
  it("issues .eq('submission_status', 'pending') on the matches lookup", async () => {
    // Path B (team formats) → teamIds populated → matches lookup runs.
    rigs["tournament_entries"] = { data: [], error: null };
    rigs["tournament_team_members"] = {
      data: [{ team_id: "team-home" }],
      error: null,
    };
    rigs["tournament_teams"] = {
      data: [{ tournament_id: "t-1" }],
      error: null,
    };
    rigs["tournaments"] = { data: [], error: null };
    rigs["matches"] = { data: [], error: null };

    await getEnteredTournamentsForPlayer();

    const eqs = matchesEqCalls();
    expect(eqs).toContainEqual(["submission_status", "pending"]);
  });
});

describe("Finding 17 — getPlayerOpenMatchInTournament", () => {
  it("issues .eq('submission_status', 'pending') alongside the status filter", async () => {
    rigs["tournament_team_members"] = {
      data: [{ team_id: "team-home" }],
      error: null,
    };
    rigs["matches"] = { data: null, error: null };

    await getPlayerOpenMatchInTournament("t-1");

    const eqs = matchesEqCalls();
    expect(eqs).toContainEqual(["submission_status", "pending"]);
    expect(eqs).toContainEqual(["tournament_id", "t-1"]);
  });

  it("returns null when the player has no team memberships", async () => {
    rigs["tournament_team_members"] = { data: [], error: null };
    const result = await getPlayerOpenMatchInTournament("t-1");
    expect(result).toBeNull();
    expect(calls.some((c) => c.table === "matches")).toBe(false);
  });
});
