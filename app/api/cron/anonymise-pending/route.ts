import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

// Phase 13 / 13-2b / Batch G3b — Vercel Cron handler for the
// hybrid pg_cron + Vercel Cron POPIA model.
//
// GET /api/cron/anonymise-pending
//   Authenticated via the Vercel Cron secret (Authorization:
//   Bearer $CRON_SECRET). Vercel automatically attaches this
//   header on cron-triggered invocations; manual hits without
//   the secret are rejected with 401.
//
// What it does:
//   1. Query profiles where pending_auth_ban = true AND
//      auth_banned_at IS NULL (i.e. pg_cron has anonymised the
//      PII but the auth.users row hasn't been banned yet).
//   2. For each row: call Supabase Auth Admin
//      admin.auth.admin.updateUserById(id, { ban_duration:
//      '876000h' }). 876,000 hours ≈ 100 years — Supabase Auth
//      doesn't accept 'infinity' but accepts large hour counts;
//      practical-effective lifetime ban.
//   3. On success: UPDATE profiles SET auth_banned_at = now()
//      + INSERT compliance-tier audit_log row.
//   4. On failure: log to console (Sentry collects in 13-5),
//      do NOT update auth_banned_at, retry next run. Failures
//      are per-row so one user's API outage doesn't block the
//      others.
//
// Schedule (configured in vercel.json):
//   /api/cron/anonymise-pending → 0 * * * * (hourly)
//   Hourly is fine — pg_cron sets pending_auth_ban=true at
//   03:00 UTC, this catches the queue within the next hour
//   and bans them. If a user has been anonymised but not yet
//   banned and tries to sign in during that window, RLS hides
//   their grace-window state from cross-user views (PII is
//   already null), the auth.users row still works for sign-in
//   but the profile is empty so the app surfaces no usable
//   state. Acceptable v1 race window.
//
// Operator setup:
//   - Add CRON_SECRET to Vercel project env vars (any
//     high-entropy random string; rotate per Vercel's standard
//     guidance).
//   - .env.example documents the variable.
//   - Local dev / preview deploys without CRON_SECRET set will
//     return 401 to all callers — including the route's
//     integration test, which sets process.env.CRON_SECRET
//     before importing the route.

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();

  const { data: pending, error: queryErr } = await admin
    .from("profiles")
    .select("id")
    .eq("pending_auth_ban", true)
    .is("auth_banned_at", null);

  if (queryErr) {
    return NextResponse.json(
      { error: `query failed: ${queryErr.message}` },
      { status: 500 },
    );
  }

  type Result = {
    processed: number;
    succeeded: number;
    failed: number;
    errors: Array<{ id: string; message: string }>;
  };
  const result: Result = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  for (const row of pending ?? []) {
    result.processed++;
    try {
      const { error: banErr } = await admin.auth.admin.updateUserById(row.id, {
        ban_duration: "876000h",
      });
      if (banErr) {
        result.failed++;
        result.errors.push({ id: row.id, message: banErr.message });
        console.error(
          `[cron/anonymise-pending] ban failed for ${row.id}:`,
          banErr.message,
        );
        continue;
      }

      const now = new Date().toISOString();
      const { error: updateErr } = await admin
        .from("profiles")
        .update({ auth_banned_at: now })
        .eq("id", row.id);
      if (updateErr) {
        // Ban succeeded but profile UPDATE failed — log + retry
        // next run. The unban via the same Auth Admin API path
        // is idempotent; calling updateUserById again with the
        // same ban_duration on an already-banned user is a no-op,
        // so the next run picks this up cleanly.
        result.failed++;
        result.errors.push({
          id: row.id,
          message: `ban succeeded but profile update failed: ${updateErr.message}`,
        });
        console.error(
          `[cron/anonymise-pending] profile update failed for ${row.id}:`,
          updateErr.message,
        );
        continue;
      }

      await admin.from("audit_log").insert({
        table_name: "profiles",
        row_id: row.id,
        action: "auth_user_banned",
        reason:
          "Vercel Cron POPIA auth-ban after pg_cron anonymise sweep.",
        payload: { automated: true } as never,
        performed_by: null,
        retention_category: "compliance",
      });

      result.succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.failed++;
      result.errors.push({ id: row.id, message });
      console.error(
        `[cron/anonymise-pending] unexpected error for ${row.id}:`,
        message,
      );
    }
  }

  return NextResponse.json(result, { status: 200 });
}
