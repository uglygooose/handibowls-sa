import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Phase 8e-3 — cancelBooking action coverage. The action is a thin
// wrapper around the migration-030 cancel_own_booking RPC; tests
// cover the errcode + message-prefix → CancelBookingResult mapping.

let mockCtx:
  | { userId: string; role: string; clubIds: string[]; email: string | null }
  | null = null;
vi.mock("@/lib/auth/role", () => ({
  getAuthContext: async () => mockCtx,
}));

// getCurrentHostClub is imported by the same _actions module for
// createBooking — keep the mock present so the import doesn't pull
// the real auth/memberships chain.
vi.mock("@/lib/auth/memberships", () => ({
  getCurrentHostClub: async () => null,
}));

let lastRpcArgs: { name: string; args: unknown } | null = null;
let rpcResult: { error: { code?: string; message?: string } | null } = {
  error: null,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({}),
        lt: () => ({}),
        gt: () => ({}),
        single: async () => ({ data: null, error: null }),
        then: <T>(r: (v: unknown) => T) =>
          Promise.resolve({ data: [], error: null }).then(r),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({ data: null, error: null }),
        }),
      }),
    }),
    rpc: async (name: string, args: unknown) => {
      lastRpcArgs = { name, args };
      return rpcResult;
    },
  }),
}));

const { cancelBooking } = await import(
  "@/app/(player)/(gated)/book/_actions"
);
const cache = await import("next/cache");
const revalidatePathSpy = vi.mocked(cache.revalidatePath);

const PLAYER = {
  userId: "u-player",
  role: "player",
  clubIds: ["club-demo"],
  email: "p@demo.local",
};

const VALID_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  mockCtx = PLAYER;
  rpcResult = { error: null };
  lastRpcArgs = null;
  vi.clearAllMocks();
});

describe("cancelBooking — gating", () => {
  it("rejects unauthenticated callers", async () => {
    mockCtx = null;
    const r = await cancelBooking({ booking_id: VALID_ID });
    expect(r.kind).toBe("auth");
  });

  it("rejects malformed UUID", async () => {
    const r = await cancelBooking({ booking_id: "not-a-uuid" });
    expect(r.kind).toBe("validation");
  });
});

describe("cancelBooking — RPC error mapping", () => {
  it("ok → invokes RPC with p_booking_id and revalidates", async () => {
    rpcResult = { error: null };
    const r = await cancelBooking({ booking_id: VALID_ID });
    expect(r.kind).toBe("ok");
    expect(lastRpcArgs).toEqual({
      name: "cancel_own_booking",
      args: { p_booking_id: VALID_ID },
    });
    const paths = revalidatePathSpy.mock.calls.map((c) => c[0]);
    expect(paths).toContain("/book");
    expect(paths).toContain("/me");
  });

  it("P0002 → not_found", async () => {
    rpcResult = {
      error: { code: "P0002", message: "cancel_own_booking: not_found" },
    };
    const r = await cancelBooking({ booking_id: VALID_ID });
    expect(r.kind).toBe("not_found");
  });

  it("42501 + not_owner prefix → not_owner", async () => {
    rpcResult = {
      error: { code: "42501", message: "cancel_own_booking: not_owner" },
    };
    const r = await cancelBooking({ booking_id: VALID_ID });
    expect(r.kind).toBe("not_owner");
  });

  it("42501 + not_authenticated prefix → auth (defensive)", async () => {
    rpcResult = {
      error: {
        code: "42501",
        message: "cancel_own_booking: not_authenticated",
      },
    };
    const r = await cancelBooking({ booking_id: VALID_ID });
    expect(r.kind).toBe("auth");
  });

  it("22023 + wrong_state prefix → wrong_state", async () => {
    rpcResult = {
      error: { code: "22023", message: "cancel_own_booking: wrong_state" },
    };
    const r = await cancelBooking({ booking_id: VALID_ID });
    expect(r.kind).toBe("wrong_state");
  });

  it("22023 + too_close_to_start prefix → too_close_to_start", async () => {
    rpcResult = {
      error: {
        code: "22023",
        message: "cancel_own_booking: too_close_to_start",
      },
    };
    const r = await cancelBooking({ booking_id: VALID_ID });
    expect(r.kind).toBe("too_close_to_start");
  });

  it("unknown errcode → error (with message preserved)", async () => {
    rpcResult = {
      error: { code: "XX999", message: "boom" },
    };
    const r = await cancelBooking({ booking_id: VALID_ID });
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.error).toBe("boom");
    }
  });

  it("does not revalidate on error", async () => {
    rpcResult = {
      error: { code: "P0002", message: "cancel_own_booking: not_found" },
    };
    await cancelBooking({ booking_id: VALID_ID });
    expect(revalidatePathSpy).not.toHaveBeenCalled();
  });
});
