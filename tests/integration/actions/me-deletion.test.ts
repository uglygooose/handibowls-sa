import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSbClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { AuthContext } from "@/lib/auth/role";

// Phase 13 / 13-2b / Batch G1 — POPIA account-lifecycle action
// integration coverage. Live cloud DB; same vi.mock pattern as
// tests/integration/actions/t20-finalize.test.ts (Phase 12 / 12-4
// hotfix template).

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    setAll: () => {},
  }),
  headers: async () => new Map(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const e = new Error(`NEXT_REDIRECT;${url}`);
    (e as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw e;
  },
}));

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ctxHolder: {
  ctx: AuthContext | null;
  client: ReturnType<typeof createSbClient<Database>> | null;
} = { ctx: null, client: null };

vi.mock("@/lib/auth/role", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/role")>();
  return {
    ...actual,
    getAuthContext: async () => ctxHolder.ctx,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ctxHolder.client,
}));

import { admin, cleanup, createTestUser, seedClub, signIn } from "../../rls/helpers";

const { requestAccountDeletion, restoreAccount, superAdminInitiateDeletion } =
  await import("@/app/(player)/(gated)/me/_actions");

const users: string[] = [];
const clubs: string[] = [];

afterAll(async () => {
  // Tests may leave deleted_at set on test users; cleanup() goes
  // through auth.admin.deleteUser which cascades through profiles
  // regardless of soft-delete state, so no explicit reset needed.
  await cleanup(users, clubs);
});

function bindClientFor(token: string) {
  return createSbClient<Database>(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

describe("requestAccountDeletion · live action coverage (DRIFT-13-2b)", () => {
  let clubId: string;

  beforeAll(async () => {
    clubId = await seedClub("POPIA Delete Action");
    clubs.push(clubId);
  });

  it("schedules soft-deletion + returns grace_until + writes audit_log row (kind='scheduled')", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(u.id);

    const session = await signIn(u);
    ctxHolder.ctx = {
      userId: u.id,
      role: "player",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubId],
      email: u.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await requestAccountDeletion();
    expect(result.kind).toBe("scheduled");

    const { data: row } = await admin()
      .from("profiles")
      .select("deleted_at")
      .eq("id", u.id)
      .single();
    expect(row?.deleted_at).not.toBeNull();

    const { data: audit } = await admin()
      .from("audit_log")
      .select("action, retention_category, performed_by")
      .eq("table_name", "profiles")
      .eq("row_id", u.id)
      .eq("action", "account_deletion_requested");
    expect(audit?.length).toBeGreaterThanOrEqual(1);
    expect(audit?.[0]?.retention_category).toBe("compliance");
    expect(audit?.[0]?.performed_by).toBe(u.id);
  }, 30_000);

  it("idempotent — second call on already-scheduled returns 'already_scheduled' with same grace_until", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(u.id);

    const session = await signIn(u);
    ctxHolder.ctx = {
      userId: u.id,
      role: "player",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubId],
      email: u.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const first = await requestAccountDeletion();
    expect(first.kind).toBe("scheduled");

    const second = await requestAccountDeletion();
    expect(second.kind).toBe("already_scheduled");
    if (first.kind === "scheduled" && second.kind === "already_scheduled") {
      expect(second.grace_until).toBe(first.grace_until);
    }
  }, 30_000);

  it("blocks the only super_admin from self-deletion (kind='last_super_admin_block')", async () => {
    // Snapshot the current super_admin count so we can detect whether
    // the cloud already has multiple super_admins (in which case this
    // test's assertion can't fire).
    const { count: existingSupers } = await admin()
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin")
      .is("deleted_at", null);

    if ((existingSupers ?? 0) > 0) {
      // Cloud has prod super_admins. Skip — we can't test "only"
      // super_admin against a non-empty baseline.
      return;
    }

    const sup = await createTestUser({ role: "super_admin", clubIds: [] });
    users.push(sup.id);

    const session = await signIn(sup);
    ctxHolder.ctx = {
      userId: sup.id,
      role: "super_admin",
      clubIds: [],
      email: sup.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await requestAccountDeletion();
    expect(result.kind).toBe("last_super_admin_block");

    // Confirm deleted_at was NOT set.
    const { data: row } = await admin()
      .from("profiles")
      .select("deleted_at")
      .eq("id", sup.id)
      .single();
    expect(row?.deleted_at).toBeNull();
  }, 30_000);
});

describe("restoreAccount · live action coverage", () => {
  let clubId: string;

  beforeAll(async () => {
    clubId = await seedClub("POPIA Restore Action");
    clubs.push(clubId);
  });

  it("restores a soft-deleted profile within grace (kind='restored', deleted_at NULL'd)", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(u.id);

    // Pre-set deleted_at via service-role.
    await admin()
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", u.id)
      .throwOnError();

    const session = await signIn(u);
    ctxHolder.ctx = {
      userId: u.id,
      role: "player",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubId],
      email: u.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await restoreAccount();
    expect(result.kind).toBe("restored");

    const { data: row } = await admin()
      .from("profiles")
      .select("deleted_at")
      .eq("id", u.id)
      .single();
    expect(row?.deleted_at).toBeNull();
  }, 30_000);

  it("returns 'not_eligible' when called on an active profile (no soft-delete pending)", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(u.id);

    const session = await signIn(u);
    ctxHolder.ctx = {
      userId: u.id,
      role: "player",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubId],
      email: u.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await restoreAccount();
    expect(result.kind).toBe("not_eligible");
  }, 30_000);
});

describe("superAdminInitiateDeletion · live action coverage", () => {
  let clubId: string;

  beforeAll(async () => {
    clubId = await seedClub("POPIA Admin Delete");
    clubs.push(clubId);
  });

  it("super_admin schedules deletion of another user (kind='scheduled')", async () => {
    const sup = await createTestUser({ role: "super_admin", clubIds: [] });
    const target = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(sup.id, target.id);

    const session = await signIn(sup);
    ctxHolder.ctx = {
      userId: sup.id,
      role: "super_admin",
      clubIds: [],
      email: sup.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await superAdminInitiateDeletion({
      target_user_id: target.id,
    });
    expect(result.kind).toBe("scheduled");

    const { data: row } = await admin()
      .from("profiles")
      .select("deleted_at")
      .eq("id", target.id)
      .single();
    expect(row?.deleted_at).not.toBeNull();

    const { data: audit } = await admin()
      .from("audit_log")
      .select("action, retention_category, performed_by")
      .eq("table_name", "profiles")
      .eq("row_id", target.id)
      .eq("action", "admin_account_deletion");
    expect(audit?.length).toBeGreaterThanOrEqual(1);
    expect(audit?.[0]?.retention_category).toBe("compliance");
    expect(audit?.[0]?.performed_by).toBe(sup.id);
  }, 30_000);

  it("returns kind='auth' when called by a non-super_admin", async () => {
    const ca = await createTestUser({ role: "club_admin", clubIds: [clubId] });
    const target = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(ca.id, target.id);

    const session = await signIn(ca);
    ctxHolder.ctx = {
      userId: ca.id,
      role: "club_admin",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubId],
      email: ca.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await superAdminInitiateDeletion({
      target_user_id: target.id,
    });
    expect(result.kind).toBe("auth");
  }, 30_000);

  it("returns kind='validation' for a malformed target_user_id", async () => {
    const sup = await createTestUser({ role: "super_admin", clubIds: [] });
    users.push(sup.id);

    const session = await signIn(sup);
    ctxHolder.ctx = {
      userId: sup.id,
      role: "super_admin",
      clubIds: [],
      email: sup.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await superAdminInitiateDeletion({
      target_user_id: "not-a-uuid",
    });
    expect(result.kind).toBe("validation");
  }, 30_000);
});
