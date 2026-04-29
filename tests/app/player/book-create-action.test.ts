import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Phase 8e-2 — createBooking action coverage.
//
// Pattern lifted from `tests/lib/tournaments/club-admin-actions.test.ts`:
// dynamic-import the action module after mocks land. Asserts cover:
//
//   • auth gate (no session → kind=auth)
//   • Zod validation (bad input → kind=validation)
//   • host-club resolution (no club → kind=auth)
//   • inverted slot bounds → kind=validation
//   • happy path inserts via cookie-bound client (RLS authoritative)
//     with server-derived rink_id + club_id + booked_by
//   • GIST 23P01 conflict → kind=slot_conflict
//   • no rinks at club → kind=no_availability
//   • all rinks taken → kind=no_availability
//   • revalidateBookingSurfaces invoked on happy path

let mockCtx:
  | { userId: string; role: string; clubIds: string[]; email: string | null }
  | null = null;
vi.mock("@/lib/auth/role", () => ({
  getAuthContext: async () => mockCtx,
}));

let mockClub: { club_id: string; club_name: string } | null = null;
vi.mock("@/lib/auth/memberships", () => ({
  getCurrentHostClub: async () => mockClub,
}));

type Rig = { data?: unknown; error?: unknown };
const tableRigs: Record<string, { select?: Rig; insert?: Rig }> = {};

let lastInsert: Record<string, unknown> | null = null;

function rig(table: string, op: "select" | "insert", value: Rig) {
  tableRigs[table] = tableRigs[table] ?? {};
  tableRigs[table][op] = value;
}

function makeQueryBuilder(table: string) {
  let opKind: "select" | "insert" = "select";
  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: (rows: unknown) => {
      opKind = "insert";
      lastInsert = rows as Record<string, unknown>;
      return builder;
    },
    eq: () => builder,
    lt: () => builder,
    gt: () => builder,
    single: async () =>
      opKind === "select"
        ? (tableRigs[table]?.select ?? { data: null, error: null })
        : (tableRigs[table]?.insert ?? { data: null, error: null }),
    then: <T>(resolve: (v: Rig) => T) =>
      Promise.resolve(
        opKind === "select"
          ? (tableRigs[table]?.select ?? { data: [], error: null })
          : (tableRigs[table]?.insert ?? { data: null, error: null }),
      ).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => makeQueryBuilder(table),
  }),
}));

const { createBooking } = await import(
  "@/app/(player)/(gated)/book/_actions"
);
const cache = await import("next/cache");
const revalidatePathSpy = vi.mocked(cache.revalidatePath);

const PLAYER = {
  userId: "u-player",
  role: "player",
  clubIds: ["club-demo"],
  email: "player@demo.local",
};
const CLUB = { club_id: "club-demo", club_name: "Demo Bowls Club" };

const VALID_INPUT = {
  slot_starts_at: "2026-04-30T06:00:00.000Z",
  slot_ends_at: "2026-04-30T08:00:00.000Z",
  purpose: "practice" as const,
  party_size: 2,
};

beforeEach(() => {
  mockCtx = PLAYER;
  mockClub = CLUB;
  for (const t of Object.keys(tableRigs)) delete tableRigs[t];
  lastInsert = null;
  vi.clearAllMocks();
});

describe("createBooking — gating", () => {
  it("rejects unauthenticated callers", async () => {
    mockCtx = null;
    const r = await createBooking(VALID_INPUT);
    expect(r.kind).toBe("auth");
  });

  it("rejects callers without a primary host club", async () => {
    mockClub = null;
    const r = await createBooking(VALID_INPUT);
    expect(r.kind).toBe("auth");
  });

  it("rejects malformed Zod input", async () => {
    const r = await createBooking({
      ...VALID_INPUT,
      slot_starts_at: "not-an-iso",
    });
    expect(r.kind).toBe("validation");
  });

  it("rejects inverted slot bounds (ends_at <= starts_at)", async () => {
    const r = await createBooking({
      ...VALID_INPUT,
      slot_starts_at: "2026-04-30T08:00:00.000Z",
      slot_ends_at: "2026-04-30T06:00:00.000Z",
    });
    expect(r.kind).toBe("validation");
  });
});

describe("createBooking — happy + race-condition paths", () => {
  it("inserts with server-derived rink_id + club_id + booked_by; revalidates", async () => {
    rig("rinks", "select", {
      data: [
        { id: "r-2", number: 2, green: { name: "Main", club_id: "club-demo" } },
        { id: "r-1", number: 1, green: { name: "Main", club_id: "club-demo" } },
        { id: "r-3", number: 3, green: { name: "Main", club_id: "club-demo" } },
      ],
      error: null,
    });
    rig("bookings", "select", { data: [], error: null });
    rig("bookings", "insert", { data: { id: "b-new" }, error: null });

    const r = await createBooking(VALID_INPUT);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.booking_id).toBe("b-new");
    }
    // Server-derived fields land in the insert payload.
    expect(lastInsert).toMatchObject({
      rink_id: "r-1", // sorted by number ascending — picks lowest
      club_id: "club-demo",
      booked_by: "u-player",
      purpose: "practice",
      starts_at: VALID_INPUT.slot_starts_at,
      ends_at: VALID_INPUT.slot_ends_at,
      party_size: 2,
    });
    // Both surfaces revalidated.
    const paths = revalidatePathSpy.mock.calls.map((c) => c[0]);
    expect(paths).toContain("/book");
    expect(paths).toContain("/me");
  });

  it("returns slot_conflict on GIST 23P01 (race lost to another player)", async () => {
    rig("rinks", "select", {
      data: [
        { id: "r-1", number: 1, green: { name: "Main", club_id: "club-demo" } },
      ],
      error: null,
    });
    // Pre-flight saw the rink as available — but the GIST EXCLUDE
    // raises 23P01 on insert because another client got there first.
    rig("bookings", "select", { data: [], error: null });
    rig("bookings", "insert", {
      data: null,
      error: { code: "23P01", message: "exclusion violation" },
    });

    const r = await createBooking(VALID_INPUT);
    expect(r.kind).toBe("slot_conflict");
  });

  it("returns no_availability when the player's club has no active rinks", async () => {
    // Rinks query returns rinks at OTHER clubs only; filter eliminates them.
    rig("rinks", "select", {
      data: [
        { id: "r-x", number: 1, green: { name: "South", club_id: "other-club" } },
      ],
      error: null,
    });
    rig("bookings", "select", { data: [], error: null });

    const r = await createBooking(VALID_INPUT);
    expect(r.kind).toBe("no_availability");
  });

  it("returns no_availability when every rink in the slot is already booked", async () => {
    rig("rinks", "select", {
      data: [
        { id: "r-1", number: 1, green: { name: "Main", club_id: "club-demo" } },
        { id: "r-2", number: 2, green: { name: "Main", club_id: "club-demo" } },
      ],
      error: null,
    });
    rig("bookings", "select", {
      data: [{ rink_id: "r-1" }, { rink_id: "r-2" }],
      error: null,
    });

    const r = await createBooking(VALID_INPUT);
    expect(r.kind).toBe("no_availability");
  });

  it("does not revalidate when the insert errors", async () => {
    rig("rinks", "select", {
      data: [
        { id: "r-1", number: 1, green: { name: "Main", club_id: "club-demo" } },
      ],
      error: null,
    });
    rig("bookings", "select", { data: [], error: null });
    rig("bookings", "insert", {
      data: null,
      error: { code: "23P01", message: "exclusion violation" },
    });

    await createBooking(VALID_INPUT);
    expect(revalidatePathSpy).not.toHaveBeenCalled();
  });
});
