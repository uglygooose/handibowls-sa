import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { admin, cleanup, createTestUser, signIn } from "../rls/helpers";

// Phase 13 / 13-2 / Batch C2 — DRIFT-L190.
//
// Real-DB integration test for the migration-042 RPC
// public.activate_rubric_version(p_version_id uuid).
//
// Cloud-state hazard: the cloud DB ships with one production-active
// rubric version (v1-final-2026 from migration 013). My test creates
// new test-only versions, runs the RPC, then RESTORES the original
// active version in afterAll. Without the restore, every test run
// would leave cloud's /t20 surfaces pointing at a deleted test
// rubric (or worse, pointing at no active rubric — captures lock to
// the rubric active at capture time, so the consequence is contained,
// but it would still show up as a failure on /platform/rubrics +
// in QA).
//
// Audit-log rows from the test runs persist (audit_log has no FK to
// the rubric_versions table); they're cleaned up alongside the
// version delete to keep the cloud DB tidy.

const users: string[] = [];
const clubs: string[] = [];
let originalActiveVersionId: string | null = null;
const testVersionIds: string[] = [];

beforeAll(async () => {
  const a = admin();
  // Snapshot the production-active rubric version so we can restore
  // it after the test mutates the active state.
  const { data, error } = await a
    .from("t20_rubric_versions")
    .select("id, version")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`snapshot active rubric failed: ${error.message}`);
  originalActiveVersionId = data?.id ?? null;
});

afterAll(async () => {
  const a = admin();
  // Restore the production-active rubric. Order matters: deactivate
  // anything we left active before re-activating the original to
  // satisfy the partial unique index.
  if (testVersionIds.length > 0) {
    await a
      .from("t20_rubric_versions")
      .update({ is_active: false })
      .in("id", testVersionIds);
  }
  if (originalActiveVersionId) {
    await a
      .from("t20_rubric_versions")
      .update({ is_active: true })
      .eq("id", originalActiveVersionId);
  }
  // Delete the test versions + their audit-log rows.
  if (testVersionIds.length > 0) {
    await a
      .from("audit_log")
      .delete()
      .eq("table_name", "t20_rubric_versions")
      .in("row_id", testVersionIds);
    await a.from("t20_rubric_versions").delete().in("id", testVersionIds);
  }
  await cleanup(users, clubs);
});

// Helper: insert N inactive test rubric versions; track their ids
// for cleanup. Each version gets a unique random version label so
// concurrent test runs don't collide on the version-unique
// constraint.
async function seedTestVersions(n: number): Promise<string[]> {
  const a = admin();
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const { data, error } = await a
      .from("t20_rubric_versions")
      .insert({
        version: `vTEST-${randomUUID().slice(0, 8)}-${i}`,
        // Minimal valid rubric shape — tests don't exercise scoring.
        // The RubricSchema requires { version, sections } at minimum;
        // bypass via service-role direct insert to avoid having to
        // import the full Zod shape into a test file.
        rubric: { version: "test", sections: [] } as unknown as object,
        is_active: false,
      })
      .select("id")
      .single();
    if (error || !data)
      throw new Error(`seed test version: ${error?.message}`);
    ids.push(data.id);
    testVersionIds.push(data.id);
  }
  return ids;
}

describe("RPC · public.activate_rubric_version", () => {
  it("super_admin activates a draft → only target is active, audit_log written, returns the new row", async () => {
    const sup = await createTestUser({ role: "super_admin", clubIds: [] });
    users.push(sup.id);
    const [vTarget] = await seedTestVersions(1);

    const { client } = await signIn(sup);
    const { data, error } = await client.rpc("activate_rubric_version", {
      p_version_id: vTarget,
    });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    if (data && !Array.isArray(data)) {
      expect(data.id).toBe(vTarget);
      expect(data.is_active).toBe(true);
      expect(data.activated_at).not.toBeNull();
      expect(data.activated_by).toBe(sup.id);
    }

    // Post-state: exactly one is_active=true row in the table, and
    // it's our target. The original active version is now inactive.
    const a = admin();
    const { data: activeRows } = await a
      .from("t20_rubric_versions")
      .select("id")
      .eq("is_active", true);
    expect(activeRows?.length).toBe(1);
    expect(activeRows?.[0]?.id).toBe(vTarget);

    // Audit row written.
    const { data: auditRows } = await a
      .from("audit_log")
      .select("action, performed_by, payload")
      .eq("table_name", "t20_rubric_versions")
      .eq("row_id", vTarget);
    expect(auditRows?.length).toBeGreaterThanOrEqual(1);
    const last = auditRows![auditRows!.length - 1];
    expect(last.action).toBe("activate_rubric_version");
    expect(last.performed_by).toBe(sup.id);
  }, 30_000);

  it("re-activating an already-active version → 23514 already_active (not a no-op)", async () => {
    const sup = await createTestUser({ role: "super_admin", clubIds: [] });
    users.push(sup.id);
    const [vTarget] = await seedTestVersions(1);

    const { client } = await signIn(sup);
    // First activation succeeds.
    const first = await client.rpc("activate_rubric_version", {
      p_version_id: vTarget,
    });
    expect(first.error).toBeNull();

    // Second activation on the same version raises 23514.
    const second = await client.rpc("activate_rubric_version", {
      p_version_id: vTarget,
    });
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe("23514");
    expect(second.error?.message).toContain("already_active");
  }, 30_000);

  it("club_admin caller → 42501 super_admin_only", async () => {
    // club_admin needs a club assignment to JWT-hook properly.
    const club = await admin()
      .from("clubs")
      .select("id")
      .limit(1)
      .single()
      .throwOnError();
    const ca = await createTestUser({
      role: "club_admin",
      clubIds: [club.data!.id],
    });
    users.push(ca.id);
    const [vTarget] = await seedTestVersions(1);

    const { client } = await signIn(ca);
    const { error } = await client.rpc("activate_rubric_version", {
      p_version_id: vTarget,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(error?.message).toContain("super_admin_only");
  }, 30_000);

  it("player caller → 42501 super_admin_only", async () => {
    const club = await admin()
      .from("clubs")
      .select("id")
      .limit(1)
      .single()
      .throwOnError();
    const player = await createTestUser({
      role: "player",
      clubIds: [club.data!.id],
    });
    users.push(player.id);
    const [vTarget] = await seedTestVersions(1);

    const { client } = await signIn(player);
    const { error } = await client.rpc("activate_rubric_version", {
      p_version_id: vTarget,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(error?.message).toContain("super_admin_only");
  }, 30_000);

  it("non-existent p_version_id → P0002 not_found", async () => {
    const sup = await createTestUser({ role: "super_admin", clubIds: [] });
    users.push(sup.id);

    const { client } = await signIn(sup);
    const { error } = await client.rpc("activate_rubric_version", {
      p_version_id: randomUUID(),
    });
    expect(error).not.toBeNull();
    // PostgREST surfaces P0002 as the error code field.
    expect(error?.code).toBe("P0002");
    expect(error?.message).toContain("not_found");
  }, 30_000);

  it("concurrent activations of different versions → both succeed (advisory lock serialises), exactly one ends active, no unique-violation", async () => {
    const sup = await createTestUser({ role: "super_admin", clubIds: [] });
    users.push(sup.id);
    const [vA, vB] = await seedTestVersions(2);

    const { client } = await signIn(sup);
    // Two concurrent calls. Without the advisory lock, the second
    // commit would trip 23505 on the partial unique index. With the
    // lock, calls serialise — both succeed; the last to commit is
    // the one that ends active.
    const [resA, resB] = await Promise.all([
      client.rpc("activate_rubric_version", { p_version_id: vA }),
      client.rpc("activate_rubric_version", { p_version_id: vB }),
    ]);
    expect(resA.error).toBeNull();
    expect(resB.error).toBeNull();

    // Post-state: exactly one active, and it's one of vA or vB
    // (deterministic by lock ordering, but which one wins depends on
    // network timing — assert "exactly one of the two", not which).
    const { data: activeRows } = await admin()
      .from("t20_rubric_versions")
      .select("id")
      .eq("is_active", true);
    expect(activeRows?.length).toBe(1);
    expect([vA, vB]).toContain(activeRows?.[0]?.id);
  }, 30_000);

  it("prior active row's activated_at timestamp is preserved across deactivation", async () => {
    const sup = await createTestUser({ role: "super_admin", clubIds: [] });
    users.push(sup.id);
    const [vOriginal, vNext] = await seedTestVersions(2);

    const { client } = await signIn(sup);
    // Activate vOriginal first to give it a known activated_at.
    await client.rpc("activate_rubric_version", { p_version_id: vOriginal });

    const { data: beforeRow } = await admin()
      .from("t20_rubric_versions")
      .select("activated_at, activated_by")
      .eq("id", vOriginal)
      .single();
    expect(beforeRow?.activated_at).not.toBeNull();
    const originalActivatedAt = beforeRow!.activated_at;

    // Now activate vNext — vOriginal should be deactivated but
    // its activated_at must remain unchanged.
    await client.rpc("activate_rubric_version", { p_version_id: vNext });

    const { data: afterRow } = await admin()
      .from("t20_rubric_versions")
      .select("is_active, activated_at, activated_by")
      .eq("id", vOriginal)
      .single();
    expect(afterRow?.is_active).toBe(false);
    expect(afterRow?.activated_at).toBe(originalActivatedAt);
    expect(afterRow?.activated_by).toBe(sup.id);
  }, 30_000);
});
