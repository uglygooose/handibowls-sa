import { describe, it, expect, vi, beforeEach } from "vitest";

// Phase 7 follow-up: regression coverage for the host-club resolver
// (`getCurrentHostClub`). The bug it fixes was that Phase-7 admin layouts
// resolved "the user's host club" from `club_memberships` only — so a
// club_admin (whose host club lives in `club_admin_assignments`) had a
// null host club, which redirected /manage/tournaments/new and broke the
// foot-card identity. These tests pin the role-aware behaviour described
// in lib/auth/memberships.ts:getCurrentHostClub.

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
}));

// React.cache memoises across calls within a single render pass; tests
// reuse the imported module so leaving cache live would leak the first
// test's user into every subsequent test. Identity-mock it so each call
// hits the underlying fn.
vi.mock("react", async (importActual) => {
  const actual = await importActual<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});

type MockUser = {
  id: string;
  email: string;
  app_metadata: Record<string, unknown>;
} | null;

let mockUser: MockUser = null;
let assignmentRows: Array<{
  id: string;
  club_id: string;
  assigned_at: string;
  club: {
    name: string;
    short_name: string | null;
    theme_preset: string;
  };
}> = [];
let membershipRows: Array<{
  id: string;
  club_id: string;
  is_primary: boolean;
  club_grading: string | null;
  status: string;
  joined_at: string;
  club: {
    name: string;
    short_name: string | null;
    theme_preset: string;
  };
}> = [];

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
      const rows =
        table === "club_admin_assignments"
          ? assignmentRows
          : table === "club_memberships"
            ? membershipRows
            : [];
      const builder: {
        select: () => typeof builder;
        eq: () => typeof builder;
        order: () => typeof builder;
        limit: () => typeof builder;
        then: <T>(
          onFulfilled: (v: { data: typeof rows; error: null }) => T,
          onRejected?: (reason: unknown) => T,
        ) => Promise<T>;
      } = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        then: (onFulfilled, onRejected) =>
          Promise.resolve({ data: rows, error: null }).then(
            onFulfilled,
            onRejected,
          ),
      };
      return builder;
    },
  }),
}));

const { getCurrentHostClub } = await import("@/lib/auth/memberships");

beforeEach(() => {
  mockUser = null;
  assignmentRows = [];
  membershipRows = [];
});

const DEMO_CLUB_ASSIGNMENT = {
  id: "a1",
  club_id: "club-demo",
  assigned_at: "2026-04-01T00:00:00Z",
  club: {
    name: "Demo Bowls Club",
    short_name: "Demo",
    theme_preset: "ocean-green",
  },
};

const OTHER_CLUB_MEMBERSHIP = {
  id: "m1",
  club_id: "club-other",
  is_primary: true,
  club_grading: null,
  status: "active",
  joined_at: "2026-03-01T00:00:00Z",
  club: {
    name: "Other Bowls Club",
    short_name: "Other",
    theme_preset: "spring-green",
  },
};

describe("getCurrentHostClub", () => {
  it("returns null when unauthenticated", async () => {
    mockUser = null;
    expect(await getCurrentHostClub()).toBeNull();
  });

  it("club_admin with no memberships still resolves a host club via assignments (Finding 3 regression)", async () => {
    mockUser = {
      id: "u1",
      email: "admin@demo.local",
      app_metadata: { role: "club_admin", club_ids: ["club-demo"] },
    };
    assignmentRows = [DEMO_CLUB_ASSIGNMENT];
    membershipRows = [];

    const host = await getCurrentHostClub();
    expect(host).toEqual({
      club_id: "club-demo",
      club_name: "Demo Bowls Club",
      club_short_name: "Demo",
      club_theme_preset: "ocean-green",
      source: "admin_assignment",
    });
  });

  it("club_admin with both assignment AND membership prefers the assignment (don't accidentally read player membership)", async () => {
    mockUser = {
      id: "u1",
      email: "admin@demo.local",
      app_metadata: {
        role: "club_admin",
        club_ids: ["club-demo", "club-other"],
      },
    };
    assignmentRows = [DEMO_CLUB_ASSIGNMENT];
    membershipRows = [OTHER_CLUB_MEMBERSHIP];

    const host = await getCurrentHostClub();
    expect(host?.club_id).toBe("club-demo");
    expect(host?.source).toBe("admin_assignment");
  });

  it("club_admin with no assignments AND no memberships returns null (profile fallback path is reachable — Finding 1 regression)", async () => {
    // Confirms the resolver itself returns null for the truly-empty case so
    // the calling layout's `hostClub?.club_name ?? deriveDisplayName(profile)`
    // fallback fires deliberately, not because Phase-7 was reading the wrong
    // table.
    mockUser = {
      id: "u1",
      email: "admin@demo.local",
      app_metadata: { role: "club_admin", club_ids: [] },
    };
    assignmentRows = [];
    membershipRows = [];

    expect(await getCurrentHostClub()).toBeNull();
  });

  it("club_admin with assignment does NOT fall through to deriveDisplayName (Finding 1 regression)", async () => {
    // Pairs with the previous test: when an assignment exists, the resolver
    // returns a non-null host club, so the layout's display-name fallback
    // never fires and the foot card primary line is the club name.
    mockUser = {
      id: "u1",
      email: "admin@demo.local",
      app_metadata: { role: "club_admin", club_ids: ["club-demo"] },
    };
    assignmentRows = [DEMO_CLUB_ASSIGNMENT];

    const host = await getCurrentHostClub();
    expect(host).not.toBeNull();
    expect(host?.club_name).toBe("Demo Bowls Club");
  });

  it("super_admin returns null even when memberships exist (deliberate)", async () => {
    // Super admins don't have a canonical host club — Phase-12 polish
    // will surface a cross-club picker. Returning null here keeps the
    // contract honest rather than silently scoping to a stray membership.
    mockUser = {
      id: "u1",
      email: "super@handibowls.local",
      app_metadata: { role: "super_admin", club_ids: ["club-other"] },
    };
    assignmentRows = [];
    membershipRows = [OTHER_CLUB_MEMBERSHIP];

    expect(await getCurrentHostClub()).toBeNull();
  });

  it("super_admin returns null even when admin assignments exist (deliberate)", async () => {
    mockUser = {
      id: "u1",
      email: "super@handibowls.local",
      app_metadata: { role: "super_admin", club_ids: ["club-demo"] },
    };
    assignmentRows = [DEMO_CLUB_ASSIGNMENT];
    membershipRows = [];

    expect(await getCurrentHostClub()).toBeNull();
  });

  it("player resolves to primary active membership", async () => {
    mockUser = {
      id: "u1",
      email: "player@demo.local",
      app_metadata: { role: "player", club_ids: ["club-other"] },
    };
    assignmentRows = [];
    membershipRows = [OTHER_CLUB_MEMBERSHIP];

    const host = await getCurrentHostClub();
    expect(host).toEqual({
      club_id: "club-other",
      club_name: "Other Bowls Club",
      club_short_name: "Other",
      club_theme_preset: "spring-green",
      source: "membership",
    });
  });

  it("player with multiple memberships and no primary flag falls back to the first row", async () => {
    mockUser = {
      id: "u1",
      email: "player@demo.local",
      app_metadata: { role: "player", club_ids: ["club-other", "club-demo"] },
    };
    membershipRows = [
      { ...OTHER_CLUB_MEMBERSHIP, is_primary: false },
      {
        ...OTHER_CLUB_MEMBERSHIP,
        id: "m2",
        club_id: "club-second",
        is_primary: false,
        club: { ...OTHER_CLUB_MEMBERSHIP.club, name: "Second Club" },
      },
    ];

    const host = await getCurrentHostClub();
    expect(host?.club_name).toBe("Other Bowls Club");
    expect(host?.source).toBe("membership");
  });

  it("player with no memberships returns null", async () => {
    mockUser = {
      id: "u1",
      email: "newbie@demo.local",
      app_metadata: { role: "player", club_ids: [] },
    };
    expect(await getCurrentHostClub()).toBeNull();
  });
});
