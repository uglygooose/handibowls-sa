import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminGate } from "./adminGate";

type MockProfile = { role: string | null; is_admin: boolean | null; club_id: string | null };

function mockClient(opts: {
  user: { id: string } | null;
  profile?: MockProfile | null;
  profileError?: { message: string } | null;
}): SupabaseClient {
  const single = async () => ({
    data: opts.profile ?? null,
    error: opts.profileError ?? null,
  });
  const eq = () => ({ single });
  const select = () => ({ eq });
  const from = () => ({ select });
  const client = {
    auth: {
      getUser: async () => ({ data: { user: opts.user }, error: null }),
    },
    from,
  };
  return client as unknown as SupabaseClient;
}

describe("adminGate", () => {
  it("returns NOT_AUTHENTICATED when no user", async () => {
    const res = await adminGate(mockClient({ user: null }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("NOT_AUTHENTICATED");
  });

  it("returns PROFILE_ERROR when profile query errors", async () => {
    const res = await adminGate(
      mockClient({ user: { id: "u1" }, profileError: { message: "db down" } })
    );
    expect(res.ok).toBe(false);
    if (!res.ok && res.reason === "PROFILE_ERROR") {
      expect(res.message).toBe("db down");
    } else {
      throw new Error("expected PROFILE_ERROR");
    }
  });

  it("returns PROFILE_ERROR when profile row missing", async () => {
    const res = await adminGate(mockClient({ user: { id: "u1" }, profile: null }));
    expect(res.ok).toBe(false);
    if (!res.ok && res.reason === "PROFILE_ERROR") {
      expect(res.message).toBe("Profile not found.");
    } else {
      throw new Error("expected PROFILE_ERROR");
    }
  });

  it("returns NOT_ADMIN when neither role nor is_admin", async () => {
    const res = await adminGate(
      mockClient({
        user: { id: "u1" },
        profile: { role: "MEMBER", is_admin: false, club_id: "c1" },
      })
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("NOT_ADMIN");
  });

  it("succeeds for super admin with adminClubId=null", async () => {
    const res = await adminGate(
      mockClient({
        user: { id: "u1" },
        profile: { role: "SUPER_ADMIN", is_admin: false, club_id: "c1" },
      })
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.isSuperAdmin).toBe(true);
      expect(res.adminClubId).toBe(null);
    }
  });

  it("succeeds for club admin with adminClubId set", async () => {
    const res = await adminGate(
      mockClient({
        user: { id: "u1" },
        profile: { role: null, is_admin: true, club_id: "c1" },
      })
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.isSuperAdmin).toBe(false);
      expect(res.adminClubId).toBe("c1");
    }
  });

  it("succeeds for club admin with null club_id → adminClubId=null", async () => {
    const res = await adminGate(
      mockClient({
        user: { id: "u1" },
        profile: { role: null, is_admin: true, club_id: null },
      })
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.isSuperAdmin).toBe(false);
      expect(res.adminClubId).toBe(null);
    }
  });

  it("role matching is case-insensitive", async () => {
    const res = await adminGate(
      mockClient({
        user: { id: "u1" },
        profile: { role: "super_admin", is_admin: false, club_id: null },
      })
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.isSuperAdmin).toBe(true);
  });
});
