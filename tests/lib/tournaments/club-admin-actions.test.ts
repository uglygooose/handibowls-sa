// tests/lib/tournaments/club-admin-actions.test.ts
//
// Coverage for the 10 server-action scaffolds in
// `app/(club-admin)/manage/tournaments/_actions.ts`. Per the 6d
// directive: auth-gate negative + happy-path Zod + integration-style
// (input → adapter → primitive returns expected shape, no DB writes —
// supabase mocked) + skeleton-throw verification for round_robin and
// sectional structures.
//
// Mocks pattern lifted from tests/auth/role.test.ts: vi.mock the
// runtime modules, build the auth + supabase doubles, then dynamically
// import the action module after the mocks are in place.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// -------------------- mock harness --------------------
//
// `mockCtx` controls what getAuthContext() returns for a given test.
// `mockDb` is a per-test fluent table doubler whose .select/.insert/
// .update/.eq/etc. return the rigged data + error you set up. It does
// NOT model the full Supabase query builder — only what the actions
// actually call.

type MockCtx = { userId: string; role: string; clubIds: string[]; email: string | null } | null;
let mockCtx: MockCtx = null;

vi.mock("@/lib/auth/role", () => ({
  getAuthContext: async () => mockCtx,
}));

type Rig = { data?: unknown; error?: { message: string } | null };
type RigOp = "selectSingle" | "selectMany" | "insert" | "update";
const tableRigs: Record<string, Partial<Record<RigOp, Rig>>> = {};

function rig(table: string, op: RigOp, value: Rig) {
  tableRigs[table] = tableRigs[table] ?? {};
  tableRigs[table][op] = value;
}

function makeQueryBuilder(table: string) {
  // Tracks the *mutating* op when one is invoked; .select() chained after
  // .insert/.update is a "return rows" hint, not a separate query, so we
  // don't let it overwrite. For pure-select chains the kind stays "select".
  let opKind: "select" | "insert" | "update" = "select";

  const builder: Record<string, unknown> = {
    select: (..._args: unknown[]) => builder,
    insert: (rows: unknown) => {
      opKind = "insert";
      builder._lastInsert = rows;
      return builder;
    },
    update: (patch: unknown) => {
      opKind = "update";
      builder._lastUpdate = patch;
      return builder;
    },
    delete: () => {
      // Treated like update for rig-lookup purposes — the tests we care
      // about don't assert delete return shapes specifically.
      opKind = "update";
      return builder;
    },
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    single: () => {
      // For pure-select chains we look up the selectSingle rig; for
      // insert/update chains, the same rig as the .then() path.
      const rig =
        opKind === "select"
          ? tableRigs[table]?.selectSingle
          : tableRigs[table]?.[opKind];
      return Promise.resolve(rig ?? { data: null, error: null });
    },
    then: (resolve: (v: Rig) => void) => {
      const rig =
        opKind === "select"
          ? tableRigs[table]?.selectMany
          : tableRigs[table]?.[opKind];
      return Promise.resolve(rig ?? { data: [], error: null }).then(resolve);
    },
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => makeQueryBuilder(table),
    rpc: vi.fn(),
  }),
}));

// Dynamic import after mocks are in place.
const actions = await import("@/app/(club-admin)/manage/tournaments/_actions");
const cache = await import("next/cache");
const revalidatePathSpy = vi.mocked(cache.revalidatePath);

// -------------------- shared fixtures --------------------

const SUPER_CTX = { userId: "u-super", role: "super_admin", clubIds: [], email: null };
const ADMIN_CTX = { userId: "u-admin", role: "club_admin", clubIds: ["club-1"], email: null };
const PLAYER_CTX = { userId: "u-player", role: "player", clubIds: [], email: null };

function rigTournament(rows: Partial<{
  id: string;
  host_club_id: string;
  status: string;
  scope: string;
  format: string;
  structure: string;
  seeding_method: string;
  handicap_rule: string;
}> = {}) {
  rig("tournaments", "selectSingle", {
    data: {
      id: "t-1",
      host_club_id: "club-1",
      status: "open",
      scope: "club",
      format: "singles",
      structure: "knockout",
      seeding_method: "random",
      handicap_rule: "scratch",
      ...rows,
    },
    error: null,
  });
}

beforeEach(() => {
  mockCtx = null;
  for (const t of Object.keys(tableRigs)) delete tableRigs[t];
  vi.clearAllMocks();
});

// -------------------- 1. createTournament --------------------

describe("createTournament", () => {
  it("rejects unauthenticated", async () => {
    mockCtx = null;
    const res = await actions.createTournament({
      host_club_id: "11111111-1111-4111-8111-111111111111",
      name: "Open Singles",
      format: "singles",
      structure: "knockout",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Not authenticated/);
  });

  it("rejects player role for a club they don't admin", async () => {
    mockCtx = PLAYER_CTX;
    const res = await actions.createTournament({
      host_club_id: "11111111-1111-4111-8111-111111111111",
      name: "Open Singles",
      format: "singles",
      structure: "knockout",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Not authorized/);
  });

  it("rejects invalid Zod payload (missing required field)", async () => {
    mockCtx = ADMIN_CTX;
    const res = await actions.createTournament({
      host_club_id: "not-a-uuid",
      name: "x",
      format: "singles",
      structure: "knockout",
    } as Parameters<typeof actions.createTournament>[0]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/Invalid input/);
      expect(res.fieldErrors?.host_club_id).toBeTruthy();
    }
  });

  it("happy path — super_admin creates returns tournament_id", async () => {
    mockCtx = SUPER_CTX;
    rig("tournaments", "insert", {
      data: { id: "t-new" },
      error: null,
    });
    const res = await actions.createTournament({
      host_club_id: "11111111-1111-4111-8111-111111111111",
      name: "Open Singles",
      format: "singles",
      structure: "knockout",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.tournament_id).toBe("t-new");
  });
});

// -------------------- 2. closeEntries --------------------

describe("closeEntries", () => {
  it("rejects invalid Zod (non-uuid id)", async () => {
    mockCtx = ADMIN_CTX;
    const res = await actions.closeEntries({ tournament_id: "x" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Invalid input/);
  });

  it("rejects when tournament status is in_progress (cannot reverse)", async () => {
    mockCtx = ADMIN_CTX;
    rigTournament({ status: "in_progress" });
    const res = await actions.closeEntries({
      tournament_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/cannot close entries/);
  });

  it("happy path — sets entries_close_at", async () => {
    mockCtx = ADMIN_CTX;
    rigTournament({ status: "open" });
    rig("tournaments", "update", { data: null, error: null });
    const res = await actions.closeEntries({
      tournament_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.entries_close_at).toMatch(/^\d{4}-/);
  });
});

// -------------------- 3. seedEntries --------------------

describe("seedEntries", () => {
  it("rejects invalid Zod", async () => {
    mockCtx = ADMIN_CTX;
    const res = await actions.seedEntries({ tournament_id: "nope" });
    expect(res.ok).toBe(false);
  });

  it("rejects unauthorised role", async () => {
    mockCtx = PLAYER_CTX;
    rigTournament();
    const res = await actions.seedEntries({
      tournament_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Not authorized/);
  });

  it("happy path — calls seeding primitive + materialises tournament_teams", async () => {
    mockCtx = ADMIN_CTX;
    rigTournament({ seeding_method: "random" });
    // tournament_entries select returns 4 entries
    tableRigs["tournament_entries"] = {
      selectMany: {
        data: [
          { id: "e1", tournament_id: "t-1", club_id: "club-1", profile_id: "p1", team_name: null, seed: 1, withdrawn: false, notes: null, created_at: "", updated_at: "" },
          { id: "e2", tournament_id: "t-1", club_id: "club-1", profile_id: "p2", team_name: null, seed: 2, withdrawn: false, notes: null, created_at: "", updated_at: "" },
          { id: "e3", tournament_id: "t-1", club_id: "club-1", profile_id: "p3", team_name: null, seed: 3, withdrawn: false, notes: null, created_at: "", updated_at: "" },
          { id: "e4", tournament_id: "t-1", club_id: "club-1", profile_id: "p4", team_name: null, seed: 4, withdrawn: false, notes: null, created_at: "", updated_at: "" },
        ],
        error: null,
      },
    };
    rig("tournament_teams", "insert", {
      data: [{ id: "team-a" }, { id: "team-b" }, { id: "team-c" }, { id: "team-d" }],
      error: null,
    });
    const res = await actions.seedEntries({
      tournament_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.teams_created).toBe(4);
  });
});

// -------------------- 4. generateBracket (incl. skeleton throws) --------------------

describe("generateBracket", () => {
  it("rejects invalid Zod", async () => {
    mockCtx = ADMIN_CTX;
    const res = await actions.generateBracket({ tournament_id: "x" });
    expect(res.ok).toBe(false);
  });

  it("rejects unauthorised role", async () => {
    mockCtx = PLAYER_CTX;
    rigTournament();
    const res = await actions.generateBracket({
      tournament_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Not authorized/);
  });

  it("knockout happy path — primitive emits round-1 inserts", async () => {
    mockCtx = ADMIN_CTX;
    rigTournament({ structure: "knockout" });
    tableRigs["tournament_teams"] = {
      selectMany: {
        data: [
          { id: "tm1", tournament_id: "t-1", club_id: null, name: null, seed: 1, section_label: null, handicap_shots: 0, withdrawn: false, created_at: "", updated_at: "" },
          { id: "tm2", tournament_id: "t-1", club_id: null, name: null, seed: 2, section_label: null, handicap_shots: 0, withdrawn: false, created_at: "", updated_at: "" },
          { id: "tm3", tournament_id: "t-1", club_id: null, name: null, seed: 3, section_label: null, handicap_shots: 0, withdrawn: false, created_at: "", updated_at: "" },
          { id: "tm4", tournament_id: "t-1", club_id: null, name: null, seed: 4, section_label: null, handicap_shots: 0, withdrawn: false, created_at: "", updated_at: "" },
        ],
        error: null,
      },
    };
    rig("matches", "insert", {
      data: [{ id: "m1" }, { id: "m2" }],
      error: null,
    });
    const res = await actions.generateBracket({
      tournament_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.matches_created).toBe(2);
      expect(res.data.bye_team_count).toBe(0);
    }
  });

  it("round_robin structure throws the verbatim skeleton message", async () => {
    mockCtx = ADMIN_CTX;
    rigTournament({ structure: "round_robin" });
    tableRigs["tournament_teams"] = {
      selectMany: {
        data: [
          { id: "tm1", tournament_id: "t-1", club_id: null, name: null, seed: 1, section_label: null, handicap_shots: 0, withdrawn: false, created_at: "", updated_at: "" },
        ],
        error: null,
      },
    };
    await expect(
      actions.generateBracket({
        tournament_id: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toThrow("Not implemented (Phase 12 cross-cutting)");
  });

  it("sectional structure throws the verbatim skeleton message", async () => {
    mockCtx = ADMIN_CTX;
    rigTournament({ structure: "sectional" });
    tableRigs["tournament_teams"] = {
      selectMany: {
        data: [
          { id: "tm1", tournament_id: "t-1", club_id: null, name: null, seed: 1, section_label: "A", handicap_shots: 0, withdrawn: false, created_at: "", updated_at: "" },
        ],
        error: null,
      },
    };
    await expect(
      actions.generateBracket({
        tournament_id: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toThrow("Not implemented (Phase 12 or later)");
  });

  it("drawn_social structure rejects (no fixtures generated)", async () => {
    mockCtx = ADMIN_CTX;
    rigTournament({ structure: "drawn_social" });
    tableRigs["tournament_teams"] = {
      selectMany: {
        data: [
          { id: "tm1", tournament_id: "t-1", club_id: null, name: null, seed: 1, section_label: null, handicap_shots: 0, withdrawn: false, created_at: "", updated_at: "" },
        ],
        error: null,
      },
    };
    const res = await actions.generateBracket({
      tournament_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Drawn\/social/);
  });
});

// -------------------- 5. advanceRound --------------------

describe("advanceRound", () => {
  it("rejects invalid Zod (non-positive round_no)", async () => {
    mockCtx = ADMIN_CTX;
    const res = await actions.advanceRound({
      tournament_id: "11111111-1111-4111-8111-111111111111",
      round_no: 0,
    });
    expect(res.ok).toBe(false);
  });

  it("happy path — primitive emits next round inserts", async () => {
    mockCtx = ADMIN_CTX;
    rigTournament();
    // 2 round-1 matches, both COMPLETED with winners
    tableRigs["matches"] = {
      selectMany: {
        data: [
          {
            id: "m1", tournament_id: "t-1", home_team_id: "tm1", away_team_id: "tm2",
            home_shots: 21, away_shots: 14, home_ends_won: 0, away_ends_won: 0,
            rink_id: null, round: 1, bracket_slot: null, section_label: null,
            status: "completed", starts_at: null, ends_at: null,
            winner_team_id: "tm1", notes: null, match_no: 1, finalized_by_admin: true,
            slot_a_source_type: "TEAM", slot_a_source_match_id: null,
            slot_b_source_type: "TEAM", slot_b_source_match_id: null,
            created_at: "", updated_at: "",
          },
          {
            id: "m2", tournament_id: "t-1", home_team_id: "tm3", away_team_id: "tm4",
            home_shots: 21, away_shots: 9, home_ends_won: 0, away_ends_won: 0,
            rink_id: null, round: 1, bracket_slot: null, section_label: null,
            status: "completed", starts_at: null, ends_at: null,
            winner_team_id: "tm3", notes: null, match_no: 2, finalized_by_admin: true,
            slot_a_source_type: "TEAM", slot_a_source_match_id: null,
            slot_b_source_type: "TEAM", slot_b_source_match_id: null,
            created_at: "", updated_at: "",
          },
        ],
        error: null,
      },
      insert: {
        data: [{ id: "m3" }],
        error: null,
      },
    };
    tableRigs["tournament_teams"] = {
      selectMany: {
        data: [
          { id: "tm1", tournament_id: "t-1", club_id: null, name: null, seed: 1, section_label: null, handicap_shots: 0, withdrawn: false, created_at: "", updated_at: "" },
          { id: "tm2", tournament_id: "t-1", club_id: null, name: null, seed: 2, section_label: null, handicap_shots: 0, withdrawn: false, created_at: "", updated_at: "" },
          { id: "tm3", tournament_id: "t-1", club_id: null, name: null, seed: 3, section_label: null, handicap_shots: 0, withdrawn: false, created_at: "", updated_at: "" },
          { id: "tm4", tournament_id: "t-1", club_id: null, name: null, seed: 4, section_label: null, handicap_shots: 0, withdrawn: false, created_at: "", updated_at: "" },
        ],
        error: null,
      },
    };
    const res = await actions.advanceRound({
      tournament_id: "11111111-1111-4111-8111-111111111111",
      round_no: 1,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.data.kind === "nextRound") {
      expect(res.data.next_round).toBe(2);
      expect(res.data.matches_created).toBe(1);
    }
  });
});

// -------------------- 6. submitMatch --------------------

describe("submitMatch", () => {
  it("rejects unauthenticated", async () => {
    mockCtx = null;
    const res = await actions.submitMatch({
      match_id: "11111111-1111-4111-8111-111111111111",
      home_shots: 21,
      away_shots: 14,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects invalid Zod (negative score)", async () => {
    mockCtx = PLAYER_CTX;
    const res = await actions.submitMatch({
      match_id: "11111111-1111-4111-8111-111111111111",
      home_shots: -1,
      away_shots: 0,
    });
    expect(res.ok).toBe(false);
  });

  it("happy path — admin submits (super_admin bypasses team-membership check)", async () => {
    mockCtx = SUPER_CTX;
    rig("matches", "selectSingle", {
      data: { id: "m1", tournament_id: "t-1", home_team_id: "tm1", away_team_id: "tm2", status: "scheduled", submission_status: "pending" },
      error: null,
    });
    rig("matches", "update", { data: null, error: null });
    const res = await actions.submitMatch({
      match_id: "11111111-1111-4111-8111-111111111111",
      home_shots: 21,
      away_shots: 14,
    });
    expect(res.ok).toBe(true);

    // Phase 8d follow-up — Finding 13 integration assertion.
    // Pre-fix, only `/manage/tournaments/t-1` invalidated, leaving the
    // player scorecard, /play, and /me serving the old RSC payload
    // until a tangential rebuild hit those paths. The post-fix
    // contract is `revalidateMatchSurfaces(tournamentId, matchId)` —
    // every player surface that derives data from this match is on
    // the list. Drift here surfaces locally before it ships.
    const paths = revalidatePathSpy.mock.calls.map((c) => c[0]);
    expect(paths).toContain("/manage/tournaments/t-1");
    expect(paths).toContain("/tournaments/t-1");
    expect(paths).toContain(
      "/tournaments/t-1/matches/11111111-1111-4111-8111-111111111111",
    );
    expect(paths).toContain("/play");
    expect(paths).toContain("/tournaments");
    expect(paths).toContain("/me");
  });

  it("rejects re-submission once opponent has confirmed", async () => {
    mockCtx = SUPER_CTX;
    rig("matches", "selectSingle", {
      data: { id: "m1", tournament_id: "t-1", home_team_id: "tm1", away_team_id: "tm2", status: "in_progress", submission_status: "opponent_confirmed" },
      error: null,
    });
    const res = await actions.submitMatch({
      match_id: "11111111-1111-4111-8111-111111111111",
      home_shots: 22,
      away_shots: 14,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/already confirmed/i);
  });
});

// -------------------- 7. confirmMatch --------------------

describe("confirmMatch", () => {
  it("rejects invalid Zod", async () => {
    mockCtx = PLAYER_CTX;
    const res = await actions.confirmMatch({ match_id: "x" });
    expect(res.ok).toBe(false);
  });

  it("happy path — admin confirms, primitive infers winner from scores", async () => {
    mockCtx = SUPER_CTX;
    // Phase 8d-prep precondition: confirmMatch only accepts a match
    // whose submission_status is 'captain_submitted'. Fixture must
    // reflect a captain having already submitted.
    rig("matches", "selectSingle", {
      data: { id: "m1", tournament_id: "t-1", home_team_id: "tm1", away_team_id: "tm2", home_shots: 21, away_shots: 14, status: "in_progress", submission_status: "captain_submitted" },
      error: null,
    });
    rig("matches", "update", { data: null, error: null });
    const res = await actions.confirmMatch({
      match_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(true);
  });

  it("rejects when submission_status is still 'pending'", async () => {
    mockCtx = SUPER_CTX;
    rig("matches", "selectSingle", {
      data: { id: "m1", tournament_id: "t-1", home_team_id: "tm1", away_team_id: "tm2", home_shots: 0, away_shots: 0, status: "scheduled", submission_status: "pending" },
      error: null,
    });
    const res = await actions.confirmMatch({
      match_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/hasn't submitted/i);
  });
});

// -------------------- 8. verifyMatch --------------------

describe("verifyMatch", () => {
  it("rejects invalid Zod", async () => {
    mockCtx = ADMIN_CTX;
    const res = await actions.verifyMatch({
      match_id: "x",
    } as Parameters<typeof actions.verifyMatch>[0]);
    expect(res.ok).toBe(false);
  });

  it("rejects player role (admin verification only)", async () => {
    mockCtx = PLAYER_CTX;
    rig("matches", "selectSingle", {
      data: { id: "m1", tournament_id: "t-1", home_team_id: "tm1", away_team_id: "tm2", home_shots: 21, away_shots: 14, status: "completed", submission_status: "opponent_confirmed" },
      error: null,
    });
    const res = await actions.verifyMatch({
      match_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Admin verification only/);
  });

  it("happy path — super_admin finalises, completes-tournament-if-done invoked", async () => {
    mockCtx = SUPER_CTX;
    // Default verify path requires submission_status='opponent_confirmed'
    // (both captains have agreed; admin is the final signoff).
    rig("matches", "selectSingle", {
      data: { id: "m1", tournament_id: "t-1", home_team_id: "tm1", away_team_id: "tm2", home_shots: 21, away_shots: 14, status: "completed", submission_status: "opponent_confirmed" },
      error: null,
    });
    rig("matches", "update", { data: null, error: null });
    rig("matches", "insert", { data: null, error: null });
    rig("tournaments", "update", { data: null, error: null });
    const res = await actions.verifyMatch({
      match_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(true);
  });

  it("rejects default-path verify when submission_status is 'pending'", async () => {
    mockCtx = SUPER_CTX;
    rig("matches", "selectSingle", {
      data: { id: "m1", tournament_id: "t-1", home_team_id: "tm1", away_team_id: "tm2", home_shots: 0, away_shots: 0, status: "scheduled", submission_status: "pending" },
      error: null,
    });
    const res = await actions.verifyMatch({
      match_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/override scores/i);
  });

  it("override path — admin verifies a 'pending' match by passing override scores (dispute resolution)", async () => {
    mockCtx = SUPER_CTX;
    rig("matches", "selectSingle", {
      data: { id: "m1", tournament_id: "t-1", home_team_id: "tm1", away_team_id: "tm2", home_shots: 0, away_shots: 0, status: "scheduled", submission_status: "pending" },
      error: null,
    });
    rig("matches", "update", { data: null, error: null });
    rig("matches", "insert", { data: null, error: null });
    rig("tournaments", "update", { data: null, error: null });
    const res = await actions.verifyMatch({
      match_id: "11111111-1111-4111-8111-111111111111",
      override_home_shots: 21,
      override_away_shots: 14,
    });
    expect(res.ok).toBe(true);
  });
});

// -------------------- 9. completeTournament --------------------

describe("completeTournament", () => {
  it("rejects invalid Zod", async () => {
    mockCtx = ADMIN_CTX;
    const res = await actions.completeTournament({ tournament_id: "x" });
    expect(res.ok).toBe(false);
  });

  it("rejects unauthorised role", async () => {
    mockCtx = PLAYER_CTX;
    rigTournament();
    const res = await actions.completeTournament({
      tournament_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(false);
  });

  it("returns already_completed when tournament status is already 'completed'", async () => {
    mockCtx = SUPER_CTX;
    rigTournament({ status: "completed" });
    rig("matches", "update", { data: null, error: null });
    const res = await actions.completeTournament({
      tournament_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.already_completed).toBe(true);
  });
});

// -------------------- 10. cancelTournament --------------------

describe("cancelTournament", () => {
  it("rejects invalid Zod (reason too long)", async () => {
    mockCtx = ADMIN_CTX;
    const res = await actions.cancelTournament({
      tournament_id: "11111111-1111-4111-8111-111111111111",
      reason: "x".repeat(501),
    });
    expect(res.ok).toBe(false);
  });

  it("rejects unauthorised role", async () => {
    mockCtx = PLAYER_CTX;
    rigTournament();
    const res = await actions.cancelTournament({
      tournament_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(false);
  });

  it("rejects when tournament is already completed", async () => {
    mockCtx = ADMIN_CTX;
    rigTournament({ status: "completed" });
    const res = await actions.cancelTournament({
      tournament_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/already completed/i);
  });

  it("happy path — sets status='cancelled'", async () => {
    mockCtx = ADMIN_CTX;
    rigTournament({ status: "open" });
    rig("tournaments", "update", { data: null, error: null });
    const res = await actions.cancelTournament({
      tournament_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.cancelled).toBe(true);
  });
});
