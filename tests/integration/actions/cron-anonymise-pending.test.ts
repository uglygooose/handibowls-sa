import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

vi.mock("server-only", () => ({}));

import { admin, cleanup, createTestUser, seedClub } from "../../rls/helpers";

// Phase 13 / 13-2b / Batch G3b — /api/cron/anonymise-pending
// integration coverage.
//
// Hits the route handler directly + a real cloud DB. Tests cover:
//   1. 401 without the Authorization header
//   2. 401 with a wrong secret
//   3. 200 with empty result when no profile is queued
//   4. End-to-end: queued profile → ban succeeds → auth_banned_at
//      set + audit_log row written
//
// Cleanup hazard: test 4 actually bans a Supabase auth.users row
// via the Auth Admin API. The hardened cleanup() calls
// auth.admin.deleteUser which works on banned users (admin-side
// delete bypasses the ban). No cloud-DB residue.

// Seed CRON_SECRET BEFORE the route module is imported. The route
// reads process.env.CRON_SECRET at request time inside GET, but
// the env-var-existence guard fires at the top of the handler.
process.env.CRON_SECRET = "test-cron-secret-" + randomUUID();
const CRON_SECRET = process.env.CRON_SECRET;

const { GET } = await import("@/app/api/cron/anonymise-pending/route");

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

function buildRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new Request("https://example.test/api/cron/anonymise-pending", {
    method: "GET",
    headers,
  });
}

describe("/api/cron/anonymise-pending · Vercel Cron handler", () => {
  let clubId: string;

  beforeAll(async () => {
    clubId = await seedClub(`POPIA Cron ${randomUUID().slice(0, 6)}`);
    clubs.push(clubId);
  });

  it("returns 401 without an Authorization header", async () => {
    const res = await GET(buildRequest());
    expect(res.status).toBe(401);
  }, 30_000);

  it("returns 401 with a wrong-secret Authorization header", async () => {
    const res = await GET(buildRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  }, 30_000);

  it("returns 200 with empty result when no profile is queued", async () => {
    // Snapshot the existing pending count first (a previous test
    // run on this cloud DB may have queued rows that hadn't yet
    // been processed; we don't want a stale fixture to skew this
    // assertion).
    const { count: existingPending } = await admin()
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("pending_auth_ban", true)
      .is("auth_banned_at", null);

    const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    type Result = {
      processed: number;
      succeeded: number;
      failed: number;
      errors: Array<{ id: string; message: string }>;
    };
    const body = (await res.json()) as Result;

    // The route processes whatever's queued at request time;
    // at minimum it should match (or exceed if any other test
    // race queued something between snapshot + call) the
    // existing baseline.
    expect(body.processed).toBeGreaterThanOrEqual(existingPending ?? 0);
  }, 60_000);

  it("end-to-end: queued profile → ban succeeds → auth_banned_at set + audit_log row written", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(u.id);

    // Queue this user for auth ban: deleted_at + pending_auth_ban
    // satisfy the profiles_auth_ban_requires_deletion check.
    await admin()
      .from("profiles")
      .update({
        deleted_at: new Date().toISOString(),
        pending_auth_ban: true,
      })
      .eq("id", u.id)
      .throwOnError();

    const res = await GET(buildRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    type Result = {
      processed: number;
      succeeded: number;
      failed: number;
      errors: Array<{ id: string; message: string }>;
    };
    const body = (await res.json()) as Result;
    expect(body.processed).toBeGreaterThanOrEqual(1);

    // auth_banned_at written on the profile row.
    const { data: row } = await admin()
      .from("profiles")
      .select("auth_banned_at")
      .eq("id", u.id)
      .single();
    expect(row?.auth_banned_at).not.toBeNull();

    // Audit log row written, retention_category='compliance'.
    const { data: audit } = await admin()
      .from("audit_log")
      .select("action, retention_category, performed_by, table_name, row_id")
      .eq("row_id", u.id)
      .eq("action", "auth_user_banned");
    expect(audit?.length).toBeGreaterThanOrEqual(1);
    expect(audit?.[0]?.retention_category).toBe("compliance");
    expect(audit?.[0]?.table_name).toBe("profiles");
    expect(audit?.[0]?.performed_by).toBeNull(); // System action.
  }, 60_000);
});
