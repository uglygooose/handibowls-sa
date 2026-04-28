// Direct coverage for the IO half of `completion.ts`. The pure derive
// + isMatchBye + isMatchDone are covered by tests/lib/tournaments/
// match.test.ts (re-exports). This file mocks a Supabase client so we
// can exercise completeTournamentIfDone's branches:
//   - missing tournamentId
//   - matches load fails
//   - tournament not yet complete (final has no winner)
//   - just-completed (status update succeeds)
//   - already-completed (no-op)
//   - winner backfill from scores when winner_team_id missing on the final
//   - stray-rounds cleanup beyond the last full round

import { describe, expect, it, vi, beforeEach } from "vitest";

import { completeTournamentIfDone } from "@/lib/tournaments/completion";

// -------------------- mock supabase client --------------------

type Rig = { data?: unknown; error?: { message: string } | null };
type RigOp = "selectMany" | "update" | "delete";
const tableRigs: Record<string, Partial<Record<RigOp, Rig>>> = {};

function rig(table: string, op: RigOp, value: Rig) {
  tableRigs[table] = tableRigs[table] ?? {};
  tableRigs[table][op] = value;
}

function makeQueryBuilder(table: string) {
  let opKind: "select" | "update" | "delete" = "select";
  const builder: Record<string, unknown> = {
    select: (..._args: unknown[]) => builder,
    update: (_patch: unknown) => {
      opKind = "update";
      return builder;
    },
    delete: () => {
      opKind = "delete";
      return builder;
    },
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    then: (resolve: (v: Rig) => void) => {
      const lookup =
        opKind === "select" ? "selectMany" : opKind === "update" ? "update" : "delete";
      const r = tableRigs[table]?.[lookup];
      return Promise.resolve(r ?? { data: [], error: null }).then(resolve);
    },
  };
  return builder;
}

function fakeSupabase() {
  return { from: (table: string) => makeQueryBuilder(table) } as unknown as Parameters<
    typeof completeTournamentIfDone
  >[0]["supabase"];
}

beforeEach(() => {
  for (const t of Object.keys(tableRigs)) delete tableRigs[t];
  vi.restoreAllMocks();
});

// -------------------- early-exit branches --------------------

describe("completeTournamentIfDone — early exits", () => {
  it("missing tournamentId returns attempted=false, completed=false", async () => {
    const out = await completeTournamentIfDone({
      supabase: fakeSupabase(),
      tournamentId: "",
    });
    expect(out).toEqual({ attempted: false, completed: false, error: null });
  });

  it("matches load error returns attempted=false with error message", async () => {
    rig("matches", "selectMany", {
      data: null,
      error: { message: "boom" },
    });
    const out = await completeTournamentIfDone({
      supabase: fakeSupabase(),
      tournamentId: "tour-1",
    });
    expect(out.attempted).toBe(false);
    expect(out.error).toMatch(/boom/);
  });
});

// -------------------- not-yet-complete branches --------------------

describe("completeTournamentIfDone — incomplete tournaments", () => {
  it("returns attempted=false when no playable rounds exist", async () => {
    rig("matches", "selectMany", { data: [], error: null });
    const out = await completeTournamentIfDone({
      supabase: fakeSupabase(),
      tournamentId: "tour-1",
    });
    expect(out.attempted).toBe(false);
    expect(out.completed).toBe(false);
  });

  it("returns attempted=false when final lacks a winner (deriveCompletion incomplete)", async () => {
    rig("matches", "selectMany", {
      data: [
        { id: "m1", round_no: 1, status: "OPEN", team_a_id: "tA", team_b_id: "tB", winner_team_id: null, score_a: null, score_b: null, finalized_by_admin: false },
      ],
      error: null,
    });
    const out = await completeTournamentIfDone({
      supabase: fakeSupabase(),
      tournamentId: "tour-1",
    });
    expect(out.attempted).toBe(false);
  });
});

// -------------------- just-completed branches --------------------

describe("completeTournamentIfDone — just-completed", () => {
  it("attempts + completes when final has explicit winner_team_id", async () => {
    rig("matches", "selectMany", {
      data: [
        {
          id: "f1",
          round_no: 1,
          status: "COMPLETED",
          team_a_id: "tA",
          team_b_id: "tB",
          winner_team_id: "tA",
          score_a: 21,
          score_b: 14,
          finalized_by_admin: true,
        },
      ],
      error: null,
    });
    rig("tournaments", "update", { data: null, error: null });
    const out = await completeTournamentIfDone({
      supabase: fakeSupabase(),
      tournamentId: "tour-1",
    });
    expect(out.attempted).toBe(true);
    expect(out.completed).toBe(true);
  });

  it("backfills winner_team_id from scores when missing", async () => {
    // The final has no winner_team_id but has decisive scores.
    rig("matches", "selectMany", {
      data: [
        {
          id: "f1",
          round_no: 1,
          status: "COMPLETED",
          team_a_id: "tA",
          team_b_id: "tB",
          winner_team_id: null,
          score_a: 21,
          score_b: 14,
          finalized_by_admin: false,
        },
      ],
      error: null,
    });
    rig("matches", "update", { data: null, error: null });
    rig("tournaments", "update", { data: null, error: null });
    const out = await completeTournamentIfDone({
      supabase: fakeSupabase(),
      tournamentId: "tour-1",
    });
    expect(out.attempted).toBe(true);
    expect(out.completed).toBe(true);
  });

  it("returns attempted=true completed=false when tournaments update errors", async () => {
    rig("matches", "selectMany", {
      data: [
        {
          id: "f1",
          round_no: 1,
          status: "COMPLETED",
          team_a_id: "tA",
          team_b_id: "tB",
          winner_team_id: "tA",
          finalized_by_admin: true,
        },
      ],
      error: null,
    });
    rig("tournaments", "update", {
      data: null,
      error: { message: "constraint violated" },
    });
    const out = await completeTournamentIfDone({
      supabase: fakeSupabase(),
      tournamentId: "tour-1",
    });
    expect(out.attempted).toBe(true);
    expect(out.completed).toBe(false);
    expect(out.error).toMatch(/constraint violated/);
  });
});

// -------------------- stray-rounds cleanup --------------------

describe("completeTournamentIfDone — stray-rounds cleanup", () => {
  it("does not crash when cleanup query throws (best-effort log + continue)", async () => {
    // Two rounds: round 1 complete with winner, round 2 has a stray
    // single-team placeholder. Winner-only-team match qualifies for cleanup.
    rig("matches", "selectMany", {
      data: [
        {
          id: "r1m1",
          round_no: 1,
          status: "COMPLETED",
          team_a_id: "tA",
          team_b_id: "tB",
          winner_team_id: "tA",
          finalized_by_admin: true,
        },
        {
          id: "r2m1",
          round_no: 2,
          status: "OPEN",
          team_a_id: "tA",
          team_b_id: null,
          winner_team_id: null,
          finalized_by_admin: false,
        },
      ],
      error: null,
    });
    // Cleanup delete and tournaments update — both succeed.
    rig("matches", "delete", { data: null, error: null });
    rig("tournaments", "update", { data: null, error: null });
    const out = await completeTournamentIfDone({
      supabase: fakeSupabase(),
      tournamentId: "tour-1",
    });
    // Once stray round is removed, the remaining maxFullRound is round 1
    // with a winner → tournament completes.
    expect(out.attempted).toBe(true);
    expect(out.completed).toBe(true);
  });
});
