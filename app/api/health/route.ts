import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

// Phase 13 / 13-5 / Batch C — public health endpoint. Pinged by
// Better Stack (Batch D wires the monitor) and any other uptime
// tooling. No auth gate, no rate limit, no PII surface.
//
// GET /api/health
//   200 + { ok: true, version, db_ok: true, ts } when reachable.
//   503 + { ok: false, version, db_ok: false, ts } when the DB
//   probe fails or times out (Better Stack alerts on 503).
//
// DB probe uses the service-role client so RLS never denies the
// query — this is a system-level liveness check, not a user-scoped
// one. Queries the `districts` reference table (20 rows, seeded at
// migration 003, never mutates) with head:true so no rows transit.
//
// Force-dynamic + Cache-Control no-store so health responses always
// reflect live state, never a cached snapshot.

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PROBE_TIMEOUT_MS = 2000;

export async function GET() {
  const ts = new Date().toISOString();
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown";

  let db_ok = false;
  try {
    const supabase = createServiceClient();
    const probe = supabase
      .from("districts")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    const timeout = new Promise<{ error: { message: string } }>((resolve) =>
      setTimeout(
        () => resolve({ error: { message: "probe timeout" } }),
        PROBE_TIMEOUT_MS,
      ),
    );
    const result = await Promise.race([probe, timeout]);
    db_ok = !result.error;
  } catch {
    db_ok = false;
  }

  const payload = { ok: db_ok, version, db_ok, ts };
  return NextResponse.json(payload, {
    status: db_ok ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
