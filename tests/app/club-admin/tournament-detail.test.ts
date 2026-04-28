import { describe, it, expect, vi, beforeEach } from "vitest";

// Phase 7 follow-up: regression coverage for getTournamentDetail. The
// detail-page fetch was 400-ing on every request because the embed
// `matches:matches(count, status)` translates to invalid SQL (Postgres
// 42803 — non-aggregate column without GROUP BY). The fix splits the
// match-status counts into a second scoped SELECT. These tests pin the
// post-fix shape so the embed bug can't reappear silently.

vi.mock("server-only", () => ({}));

vi.mock("react", async (importActual) => {
  const actual = await importActual<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});

type MockUser = {
  id: string;
  email: string;
  app_metadata: Record<string, unknown>;
} | null;

type TournamentRow = {
  id: string;
  host_club_id: string;
  name: string;
  status: string;
  host_club: {
    id: string;
    name: string;
    short_name: string | null;
    theme_preset: string;
  };
  entries: Array<{ count: number }>;
} | null;

type MatchRow = { status: string };

let mockUser: MockUser = null;
let tournamentResult: { data: TournamentRow; error: { message: string } | null } = {
  data: null,
  error: null,
};
let matchesResult: { data: MatchRow[] | null; error: { message: string } | null } = {
  data: [],
  error: null,
};

let tournamentsCalls = 0;
let matchesCalls = 0;

function mockAccessToken(appMetadata: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ app_metadata: appMetadata })).toString(
    "base64url",
  );
  return `${header}.${payload}.sig`;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mockUser },
        error: mockUser ? null : new Error("no user"),
      }),
      getSession: async () => ({
        data: {
          session: mockUser
            ? { access_token: mockAccessToken(mockUser.app_metadata) }
            : null,
        },
        error: null,
      }),
    },
    from: (table: string) => {
      type ChainShape =
        | { kind: "tournaments"; result: typeof tournamentResult }
        | { kind: "matches"; result: typeof matchesResult };

      let chain: ChainShape;
      if (table === "tournaments") {
        tournamentsCalls += 1;
        chain = { kind: "tournaments", result: tournamentResult };
      } else if (table === "matches") {
        matchesCalls += 1;
        chain = { kind: "matches", result: matchesResult };
      } else {
        chain = {
          kind: "matches",
          result: { data: [], error: null },
        };
      }

      const builder: {
        select: () => typeof builder;
        eq: () => typeof builder;
        order: () => typeof builder;
        maybeSingle: () => Promise<typeof tournamentResult>;
        then: <T>(
          onFulfilled: (v: typeof matchesResult) => T,
          onRejected?: (reason: unknown) => T,
        ) => Promise<T>;
      } = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        maybeSingle: async () =>
          chain.kind === "tournaments"
            ? chain.result
            : { data: null, error: null },
        then: (onFulfilled, onRejected) =>
          Promise.resolve(
            chain.kind === "matches" ? chain.result : { data: null, error: null },
          ).then(onFulfilled, onRejected),
      };
      return builder;
    },
  }),
}));

const { getTournamentDetail } = await import(
  "@/app/(club-admin)/manage/tournaments/[id]/_data"
);

const ADMIN = {
  id: "u-admin",
  email: "admin@demo.local",
  app_metadata: { role: "club_admin", club_ids: ["club-demo"] },
};

const TOURNAMENT_ROW: NonNullable<TournamentRow> = {
  id: "t1",
  host_club_id: "club-demo",
  name: "Test 1",
  status: "open",
  host_club: {
    id: "club-demo",
    name: "Demo Bowls Club",
    short_name: "Demo",
    theme_preset: "atomic-red",
  },
  entries: [{ count: 0 }],
};

beforeEach(() => {
  mockUser = null;
  tournamentResult = { data: null, error: null };
  matchesResult = { data: [], error: null };
  tournamentsCalls = 0;
  matchesCalls = 0;
});

describe("getTournamentDetail", () => {
  it("returns null when unauthenticated", async () => {
    mockUser = null;
    expect(await getTournamentDetail("t1")).toBeNull();
  });

  it("returns null when the tournament does not exist", async () => {
    mockUser = ADMIN;
    tournamentResult = { data: null, error: null };
    expect(await getTournamentDetail("t1")).toBeNull();
  });

  it("returns null when the parent query errors (regression — Finding 4 root cause)", async () => {
    // The original PostgREST 42803 manifested here: error non-null,
    // data null. We log + return null so the operator sees the cause.
    mockUser = ADMIN;
    tournamentResult = {
      data: null,
      error: { message: 'column "matches_1.status" must appear in GROUP BY' },
    };
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getTournamentDetail("t1")).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[getTournamentDetail] tournaments query failed:",
      expect.objectContaining({ message: expect.stringContaining("GROUP BY") }),
    );
    consoleSpy.mockRestore();
  });

  it("returns null when club_admin's club_ids don't include host_club_id", async () => {
    mockUser = {
      ...ADMIN,
      app_metadata: { role: "club_admin", club_ids: ["other-club"] },
    };
    tournamentResult = { data: TOURNAMENT_ROW, error: null };
    expect(await getTournamentDetail("t1")).toBeNull();
  });

  it("happy path — runs both queries and aggregates match counts (Finding 4 fix)", async () => {
    mockUser = ADMIN;
    tournamentResult = { data: TOURNAMENT_ROW, error: null };
    matchesResult = {
      data: [
        { status: "scheduled" },
        { status: "scheduled" },
        { status: "in_progress" },
        { status: "completed" },
      ],
      error: null,
    };

    const result = await getTournamentDetail("t1");
    expect(tournamentsCalls).toBe(1);
    expect(matchesCalls).toBe(1);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("t1");
    expect(result?.host_club.name).toBe("Demo Bowls Club");
    expect(result?.matches_total).toBe(4);
    expect(result?.matches_open).toBe(2); // scheduled
    expect(result?.matches_in_progress).toBe(1);
    expect(result?.entries_count).toBe(0);
  });

  it("zero matches → zero counts but row still returns (fresh-tournament case — original 404 trigger)", async () => {
    mockUser = ADMIN;
    tournamentResult = { data: TOURNAMENT_ROW, error: null };
    matchesResult = { data: [], error: null };

    const result = await getTournamentDetail("t1");
    expect(result).not.toBeNull();
    expect(result?.matches_total).toBe(0);
    expect(result?.matches_open).toBe(0);
    expect(result?.matches_in_progress).toBe(0);
  });

  it("matches query errors but tournament fetch succeeds → row returns with zero counts (failure-mode fallback)", async () => {
    mockUser = ADMIN;
    tournamentResult = { data: TOURNAMENT_ROW, error: null };
    matchesResult = {
      data: null,
      error: { message: "transient matches read failure" },
    };
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getTournamentDetail("t1");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("t1");
    expect(result?.matches_total).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[getTournamentDetail] matches count query failed:",
      expect.objectContaining({ message: expect.any(String) }),
    );
    consoleSpy.mockRestore();
  });

  it("entries embed shape (single-projection count) maps to entries_count", async () => {
    mockUser = ADMIN;
    tournamentResult = {
      data: { ...TOURNAMENT_ROW, entries: [{ count: 7 }] },
      error: null,
    };
    matchesResult = { data: [], error: null };

    const result = await getTournamentDetail("t1");
    expect(result?.entries_count).toBe(7);
  });
});
