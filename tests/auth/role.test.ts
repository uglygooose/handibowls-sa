import { describe, it, expect, vi, beforeEach } from "vitest";

// server-only throws when imported outside a Server Component bundle; no-op
// it in tests.
vi.mock("server-only", () => ({}));

// next/navigation uses internal rsc requireContext runtime; mock before
// importing the module under test.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
}));

type MockUser = {
  id: string;
  email: string;
  app_metadata: Record<string, unknown>;
} | null;

let mockUser: MockUser = null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mockUser },
        error: mockUser ? null : new Error("no user"),
      }),
    },
  }),
}));

// Imported dynamically so the mocks are in place first.
const { getAuthContext, requireRole, homeFor } = await import(
  "@/lib/auth/role"
);

beforeEach(() => {
  mockUser = null;
});

describe("getAuthContext", () => {
  it("returns null when unauthenticated", async () => {
    mockUser = null;
    expect(await getAuthContext()).toBeNull();
  });

  it("reads role + club_ids from app_metadata", async () => {
    mockUser = {
      id: "u1",
      email: "a@b.co",
      app_metadata: { role: "club_admin", club_ids: ["c1", "c2"] },
    };
    expect(await getAuthContext()).toEqual({
      userId: "u1",
      role: "club_admin",
      clubIds: ["c1", "c2"],
      email: "a@b.co",
    });
  });

  it("falls back to player when role claim is missing", async () => {
    mockUser = { id: "u1", email: "a@b.co", app_metadata: {} };
    const ctx = await getAuthContext();
    expect(ctx?.role).toBe("player");
    expect(ctx?.clubIds).toEqual([]);
  });

  it("ignores garbage role values", async () => {
    mockUser = {
      id: "u1",
      email: "a@b.co",
      app_metadata: { role: "pretend_admin" },
    };
    const ctx = await getAuthContext();
    expect(ctx?.role).toBe("player");
  });
});

describe("requireRole", () => {
  it("redirects unauthenticated callers to /login", async () => {
    mockUser = null;
    await expect(requireRole(["player"])).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects wrong-role callers to their home", async () => {
    mockUser = {
      id: "u1",
      email: "a@b.co",
      app_metadata: { role: "player", club_ids: [] },
    };
    await expect(requireRole(["super_admin"])).rejects.toThrow(
      "REDIRECT:/play",
    );
  });

  it("allows callers whose role is in the allowed list", async () => {
    mockUser = {
      id: "u1",
      email: "a@b.co",
      app_metadata: { role: "club_admin", club_ids: ["c1"] },
    };
    const ctx = await requireRole(["club_admin", "super_admin"]);
    expect(ctx.role).toBe("club_admin");
  });

  it("produces the expected home path for every role", () => {
    expect(homeFor("super_admin")).toBe("/platform/clubs");
    expect(homeFor("club_admin")).toBe("/manage/overview");
    expect(homeFor("player")).toBe("/play");
  });
});
