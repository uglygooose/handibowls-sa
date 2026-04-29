import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Phase 9-2 — adminForceCancelBooking action contract.
//
// All authorization lives in the RPC. The action's job is Zod gating
// + SQLSTATE→result-kind mapping. These tests pin every branch in
// _actions.ts so a future SQLSTATE refactor that drops a code is
// caught.

let mockCtx:
  | { userId: string; role: string; clubIds: string[]; email: string | null }
  | null = null;
vi.mock("@/lib/auth/role", () => ({
  getAuthContext: async () => mockCtx,
}));

type RpcResult = { error: { code?: string; message?: string } | null };
let nextRpcResult: RpcResult = { error: null };
const lastRpcCalls: Array<{ fn: string; args: unknown }> = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: (fn: string, args: unknown) => {
      lastRpcCalls.push({ fn, args });
      return Promise.resolve(nextRpcResult);
    },
  }),
}));

const actions = await import("@/app/(club-admin)/manage/overview/_actions");
const cache = await import("next/cache");
const revalidatePathSpy = vi.mocked(cache.revalidatePath);

const ADMIN_CTX = {
  userId: "u-admin",
  role: "club_admin",
  clubIds: ["club-1"],
  email: null,
};

const BOOKING = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  mockCtx = null;
  nextRpcResult = { error: null };
  lastRpcCalls.length = 0;
  vi.clearAllMocks();
});

describe("adminForceCancelBooking — gating", () => {
  it("rejects unauthenticated", async () => {
    mockCtx = null;
    const r = await actions.adminForceCancelBooking({
      booking_id: BOOKING,
      reason: "test",
    });
    expect(r.kind).toBe("auth");
    expect(lastRpcCalls).toHaveLength(0);
  });

  it("rejects malformed booking_id (non-uuid)", async () => {
    mockCtx = ADMIN_CTX;
    const r = await actions.adminForceCancelBooking({
      booking_id: "not-a-uuid",
      reason: "test",
    });
    expect(r.kind).toBe("validation");
    expect(lastRpcCalls).toHaveLength(0);
  });

  it("rejects empty reason as reason_required (Zod)", async () => {
    mockCtx = ADMIN_CTX;
    const r = await actions.adminForceCancelBooking({
      booking_id: BOOKING,
      reason: "",
    });
    expect(r.kind).toBe("reason_required");
    expect(lastRpcCalls).toHaveLength(0);
  });

  it("rejects whitespace-only reason as reason_required (after trim)", async () => {
    mockCtx = ADMIN_CTX;
    const r = await actions.adminForceCancelBooking({
      booking_id: BOOKING,
      reason: "   \n  ",
    });
    expect(r.kind).toBe("reason_required");
    expect(lastRpcCalls).toHaveLength(0);
  });

  it("rejects reason >500 chars as validation", async () => {
    mockCtx = ADMIN_CTX;
    const r = await actions.adminForceCancelBooking({
      booking_id: BOOKING,
      reason: "x".repeat(501),
    });
    expect(r.kind).toBe("validation");
    expect(lastRpcCalls).toHaveLength(0);
  });
});

describe("adminForceCancelBooking — happy path", () => {
  it("calls RPC with snake_case arg names + revalidates surfaces", async () => {
    mockCtx = ADMIN_CTX;
    nextRpcResult = { error: null };

    const r = await actions.adminForceCancelBooking({
      booking_id: BOOKING,
      reason: "Member contacted secretary",
    });
    expect(r.kind).toBe("ok");

    expect(lastRpcCalls).toHaveLength(1);
    expect(lastRpcCalls[0]).toEqual({
      fn: "admin_force_cancel_booking",
      args: {
        p_booking_id: BOOKING,
        p_reason: "Member contacted secretary",
      },
    });

    expect(revalidatePathSpy).toHaveBeenCalledWith("/manage/overview", "page");
    expect(revalidatePathSpy).toHaveBeenCalledWith("/book", "page");
    expect(revalidatePathSpy).toHaveBeenCalledWith("/me", "page");
  });
});

describe("adminForceCancelBooking — SQLSTATE → result-kind mapping", () => {
  it("P0002 → not_found", async () => {
    mockCtx = ADMIN_CTX;
    nextRpcResult = {
      error: { code: "P0002", message: "admin_force_cancel_booking: not_found" },
    };
    const r = await actions.adminForceCancelBooking({
      booking_id: BOOKING,
      reason: "test",
    });
    expect(r.kind).toBe("not_found");
    expect(revalidatePathSpy).not.toHaveBeenCalled();
  });

  it("22004 → reason_required", async () => {
    mockCtx = ADMIN_CTX;
    nextRpcResult = {
      error: {
        code: "22004",
        message: "admin_force_cancel_booking: reason_required",
      },
    };
    const r = await actions.adminForceCancelBooking({
      booking_id: BOOKING,
      reason: "x",
    });
    expect(r.kind).toBe("reason_required");
  });

  it("22001 → validation (reason_too_long)", async () => {
    mockCtx = ADMIN_CTX;
    nextRpcResult = {
      error: {
        code: "22001",
        message: "admin_force_cancel_booking: reason_too_long",
      },
    };
    const r = await actions.adminForceCancelBooking({
      booking_id: BOOKING,
      reason: "x",
    });
    expect(r.kind).toBe("validation");
    if (r.kind === "validation") expect(r.error).toMatch(/500/);
  });

  it("42501 + wrong_club → wrong_club", async () => {
    mockCtx = ADMIN_CTX;
    nextRpcResult = {
      error: {
        code: "42501",
        message: "admin_force_cancel_booking: wrong_club",
      },
    };
    const r = await actions.adminForceCancelBooking({
      booking_id: BOOKING,
      reason: "test",
    });
    expect(r.kind).toBe("wrong_club");
  });

  it("42501 + insufficient_role → insufficient_role", async () => {
    mockCtx = ADMIN_CTX;
    nextRpcResult = {
      error: {
        code: "42501",
        message: "admin_force_cancel_booking: insufficient_role",
      },
    };
    const r = await actions.adminForceCancelBooking({
      booking_id: BOOKING,
      reason: "test",
    });
    expect(r.kind).toBe("insufficient_role");
  });

  it("42501 + not_authenticated → auth (defensive fallback)", async () => {
    mockCtx = ADMIN_CTX;
    nextRpcResult = {
      error: {
        code: "42501",
        message: "admin_force_cancel_booking: not_authenticated",
      },
    };
    const r = await actions.adminForceCancelBooking({
      booking_id: BOOKING,
      reason: "test",
    });
    expect(r.kind).toBe("auth");
  });

  it("22023 → wrong_state", async () => {
    mockCtx = ADMIN_CTX;
    nextRpcResult = {
      error: {
        code: "22023",
        message: "admin_force_cancel_booking: wrong_state",
      },
    };
    const r = await actions.adminForceCancelBooking({
      booking_id: BOOKING,
      reason: "test",
    });
    expect(r.kind).toBe("wrong_state");
  });

  it("unknown error code → kind=error with the underlying message", async () => {
    mockCtx = ADMIN_CTX;
    nextRpcResult = {
      error: { code: "XX000", message: "weird db blowup" },
    };
    const r = await actions.adminForceCancelBooking({
      booking_id: BOOKING,
      reason: "test",
    });
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.error).toBe("weird db blowup");
  });
});
