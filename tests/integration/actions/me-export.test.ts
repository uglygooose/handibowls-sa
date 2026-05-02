import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "@/lib/auth/role";

// Phase 13 / 13-2b / Batch G2 — /api/me/export integration coverage.
// Pattern lifted from tests/integration/actions/me-deletion.test.ts.

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

const ctxHolder: { ctx: AuthContext | null } = { ctx: null };

vi.mock("@/lib/auth/role", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/role")>();
  return {
    ...actual,
    getAuthContext: async () => ctxHolder.ctx,
  };
});

import { admin, cleanup, createTestUser, seedClub } from "../../rls/helpers";

const { GET } = await import("@/app/api/me/export/route");

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("/api/me/export · POPIA data portability", () => {
  let clubId: string;

  beforeAll(async () => {
    clubId = await seedClub(`POPIA Export ${randomUUID().slice(0, 6)}`);
    clubs.push(clubId);
  });

  it("returns 401 when called without an auth context", async () => {
    ctxHolder.ctx = null;
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  }, 30_000);

  it("returns 200 JSON with the user's own profile + correct filename header", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(u.id);

    ctxHolder.ctx = {
      userId: u.id,
      role: "player",
      clubIds: [clubId],
      email: u.email,
    };

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    const cd = res.headers.get("Content-Disposition") ?? "";
    expect(cd).toMatch(
      new RegExp(`^attachment; filename="handibowls-data-export-${u.id}-\\d{8}\\.json"$`),
    );

    type ExportPayload = {
      exported_at: string;
      user_id: string;
      schema_version: string;
      tables: { profiles: { id: string }[] } & Record<string, unknown[]>;
    };
    const payload = (await res.json()) as ExportPayload;
    expect(payload.user_id).toBe(u.id);
    expect(payload.schema_version).toBe("popia-v1");
    expect(payload.tables.profiles).toHaveLength(1);
    expect(payload.tables.profiles[0]?.id).toBe(u.id);
  }, 30_000);

  it("does NOT include other users' profile rows (the request is scoped to auth.uid())", async () => {
    const a = await createTestUser({ role: "player", clubIds: [clubId] });
    const b = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(a.id, b.id);

    ctxHolder.ctx = {
      userId: a.id,
      role: "player",
      clubIds: [clubId],
      email: a.email,
    };

    const res = await GET();
    expect(res.status).toBe(200);
    type ExportPayload = {
      tables: { profiles: { id: string }[] };
    };
    const payload = (await res.json()) as ExportPayload;
    const ids = payload.tables.profiles.map((p) => p.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
  }, 30_000);

  it("includes the user's club_memberships, consents, and notifications rows", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(u.id);

    // Seed a notification + a consent for u.
    await admin()
      .from("notifications")
      .insert({
        profile_id: u.id,
        club_id: clubId,
        kind: "test_notification",
        title: "Test",
        body: "Body",
      })
      .throwOnError();

    await admin()
      .from("consents")
      .insert({
        profile_id: u.id,
        kind: "terms",
        version: "v1",
        accepted_at: new Date().toISOString(),
      })
      .throwOnError();

    ctxHolder.ctx = {
      userId: u.id,
      role: "player",
      clubIds: [clubId],
      email: u.email,
    };

    const res = await GET();
    expect(res.status).toBe(200);
    type ExportPayload = {
      tables: {
        club_memberships: { profile_id: string }[];
        consents: { profile_id: string }[];
        notifications: { profile_id: string }[];
      };
    };
    const payload = (await res.json()) as ExportPayload;
    expect(payload.tables.club_memberships.length).toBeGreaterThanOrEqual(1);
    expect(payload.tables.consents.length).toBeGreaterThanOrEqual(1);
    expect(payload.tables.notifications.length).toBeGreaterThanOrEqual(1);
    // Every row returned belongs to the calling user.
    expect(
      payload.tables.club_memberships.every((r) => r.profile_id === u.id),
    ).toBe(true);
    expect(payload.tables.consents.every((r) => r.profile_id === u.id)).toBe(
      true,
    );
    expect(
      payload.tables.notifications.every((r) => r.profile_id === u.id),
    ).toBe(true);
  }, 30_000);

  it("writes a compliance-tier audit_log row with action='data_export_requested'", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(u.id);

    ctxHolder.ctx = {
      userId: u.id,
      role: "player",
      clubIds: [clubId],
      email: u.email,
    };

    await GET();

    const { data: audit } = await admin()
      .from("audit_log")
      .select("action, retention_category, performed_by, table_name, row_id")
      .eq("performed_by", u.id)
      .eq("action", "data_export_requested");
    expect(audit?.length).toBeGreaterThanOrEqual(1);
    expect(audit?.[0]?.retention_category).toBe("compliance");
    expect(audit?.[0]?.table_name).toBe("profiles");
    expect(audit?.[0]?.row_id).toBe(u.id);
  }, 30_000);

  it("payload size for a baseline test user stays under 10 KB (sanity check for v1 single-blob viability)", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(u.id);

    ctxHolder.ctx = {
      userId: u.id,
      role: "player",
      clubIds: [clubId],
      email: u.email,
    };

    const res = await GET();
    const text = await res.text();
    const bytes = new TextEncoder().encode(text).length;
    // Baseline test user (1 club_membership + 1 audit row from
    // export itself) — minimal data. Real users will be larger;
    // tracked at 10 KB here as a regression-pin against future
    // bloat in the per-user query set. Real-world heavy-user
    // budget is ~5 MB before the design needs streaming.
    expect(bytes).toBeLessThan(10_000);
  }, 30_000);
});
