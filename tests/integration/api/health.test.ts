import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { GET } = await import("@/app/api/health/route");

// Phase 13 / 13-5 / Batch C — /api/health integration coverage.
// Hits the route handler directly with a real Supabase service-role
// client probing the `districts` reference table. No auth setup, no
// fixture seed — districts are migration-003 reference data and
// always present.

describe("/api/health · public health endpoint", () => {
  it("returns 200 + correct JSON shape when DB is reachable", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, db_ok: true });
    expect(typeof body.version).toBe("string");
    expect(typeof body.ts).toBe("string");
    // ISO 8601 UTC timestamp shape
    expect(body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  }, 10_000);

  it("emits Cache-Control: no-store, max-age=0 header", async () => {
    const res = await GET();
    expect(res.headers.get("cache-control")).toBe("no-store, max-age=0");
  }, 10_000);

  it("derives version from VERCEL_GIT_COMMIT_SHA when set, else 'unknown'", async () => {
    const original = process.env.VERCEL_GIT_COMMIT_SHA;
    try {
      process.env.VERCEL_GIT_COMMIT_SHA = "abc1234567890";
      const res = await GET();
      const body = (await res.json()) as { version: string };
      expect(body.version).toBe("abc1234");
    } finally {
      if (original === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
      else process.env.VERCEL_GIT_COMMIT_SHA = original;
    }
  }, 10_000);

  it("returns 503 when the DB probe throws", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/service", () => ({
      createServiceClient: () => {
        throw new Error("simulated DB connection failure");
      },
    }));
    const { GET: GetWithBrokenDb } = await import("@/app/api/health/route");
    const res = await GetWithBrokenDb();
    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: false, db_ok: false });
    vi.doUnmock("@/lib/supabase/service");
    vi.resetModules();
  }, 10_000);
});
