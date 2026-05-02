// scripts/seed-dev-t20.ts
//
// Phase 12.5 / 12.5-7 (path 2 of audit `seed-data-comprehensive`):
// minimal Twenty 20 fixture seed for the player /t20 hub QA walkthrough.
// Idempotent. Creates 3 submitted assessments at the iconic grade
// bands (gold / silver / bronze) for player@demo.local at Demo Bowls
// Club, plus 1 ungraded request (status='draft' — "request pending"
// state). The most-recent submitted = gold so the hub hero renders
// the GOLD reveal; "All assessments" list shows 3 entries.
//
// Scoped explicitly to the iconic states. NOT covered (logged as
// Phase 13 entries):
//   • Multi-club seed (super_admin walkthrough across N clubs)
//   • Pagination edge cases (>50 rows in any list)
//   • Failed-invite seed for resend QA
//   • club_admin-with-zero-T20 empty-state (would need an alt
//     club + alt admin)
//
// Skips writing t20_deliveries rows — the /t20 hub doesn't read
// deliveries (only `latest.grade` and `latest.percentage` from the
// row). The /t20/[assessmentId] detail view re-runs
// aggregateAssessment on live deliveries; without them the breakdown
// renders zeros. That's acceptable for v1 stakeholder walkthroughs
// where the hub hero is the iconic surface — detail-view scoring
// math is exercised elsewhere by the t20-finalize integration test.
//
// Usage
//   npm run seed:dev:t20              # seed (idempotent)
//   npm run seed:dev:t20 -- --reset   # wipe existing seed rows + re-seed

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Database } from "../types/database.types";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  for (const p of [".env.local", ".env.test"]) {
    const f = resolve(__dirname, "..", p);
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Populate .env.local before running.",
  );
  process.exit(1);
}

const reset = process.argv.includes("--reset");

const PLAYER_EMAIL = "player@demo.local";
const ADMIN_EMAIL = "admin@demo.local";
const DEMO_CLUB_SLUG = "demo-bowls-club";

const supabase = createClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Marker so the seed can find / wipe its own rows on re-run without
// touching unrelated assessments.
const SEED_MARKER = "[seed-dev-t20]";

type Fixture = {
  /** Suffix appended to `assessed_on` so each fixture has a distinct
   *  date for the "history newest first" ordering on the hub. */
  daysAgo: number;
  status: "submitted" | "draft";
  grade: Database["public"]["Enums"]["t20_grade"] | null;
  totalScore: number;
  /** Persisted percentage. The engine clamps at 100 — fixtures pick
   *  a representative in-band value (band means: gold ≥80, silver
   *  65-79, bronze 50-64). */
  percentage: number;
};

const FIXTURES: Fixture[] = [
  // Most recent — drives the hub hero. GOLD reveal.
  {
    daysAgo: 7,
    status: "submitted",
    grade: "gold",
    totalScore: 268,
    percentage: 83.75,
  },
  // Second-most-recent — drives the "All assessments" list +
  // shows progress narrative (silver → gold).
  {
    daysAgo: 90,
    status: "submitted",
    grade: "silver",
    totalScore: 232,
    percentage: 72.5,
  },
  // Third — bronze tier, oldest submitted.
  {
    daysAgo: 180,
    status: "submitted",
    grade: "bronze",
    totalScore: 188,
    percentage: 58.75,
  },
  // Pending request — status='draft', no grade. Doesn't appear in
  // the hub's `history` list (which filters on status='submitted')
  // but renders as an "in_progress" assessment when admin opens
  // /manage/t20.
  {
    daysAgo: 1,
    status: "draft",
    grade: null,
    totalScore: 0,
    percentage: 0,
  },
];

function isoDateNDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("[seed-dev-t20] starting…");

  // Resolve the Demo Bowls Club id.
  const { data: club, error: clubErr } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("slug", DEMO_CLUB_SLUG)
    .maybeSingle();
  if (clubErr || !club) {
    throw new Error(
      `Demo club '${DEMO_CLUB_SLUG}' not found. Run \`npm run seed:dev\` first.`,
    );
  }

  // Resolve the demo player + admin profile ids.
  const { data: users, error: usersErr } = await supabase.auth.admin.listUsers({
    perPage: 200,
  });
  if (usersErr) throw usersErr;
  const playerId = users.users.find(
    (u) => u.email?.toLowerCase() === PLAYER_EMAIL,
  )?.id;
  const adminId = users.users.find(
    (u) => u.email?.toLowerCase() === ADMIN_EMAIL,
  )?.id;
  if (!playerId || !adminId) {
    throw new Error(
      `Demo users not found (player=${!!playerId}, admin=${!!adminId}). Run \`npm run seed:dev\` first.`,
    );
  }

  // Resolve the active rubric version (seeded via migration 013).
  const { data: rubric, error: rubricErr } = await supabase
    .from("t20_rubric_versions")
    .select("id, version")
    .eq("is_active", true)
    .maybeSingle();
  if (rubricErr || !rubric) {
    throw new Error(
      "No active t20_rubric_version. Migration 013 should have seeded it — verify migrations applied.",
    );
  }

  if (reset) {
    console.log(
      `[seed-dev-t20] --reset: wiping seeded assessments (notes LIKE '${SEED_MARKER}%')`,
    );
    const { error: delErr } = await supabase
      .from("t20_assessments")
      .delete()
      .eq("club_id", club.id)
      .eq("profile_id", playerId)
      .like("notes", `${SEED_MARKER}%`);
    if (delErr) throw delErr;
  }

  // Idempotent: check if seed rows already exist (matched on the
  // notes marker). Skip if present + non-reset.
  if (!reset) {
    const { data: existing } = await supabase
      .from("t20_assessments")
      .select("id")
      .eq("club_id", club.id)
      .eq("profile_id", playerId)
      .like("notes", `${SEED_MARKER}%`);
    if (existing && existing.length >= FIXTURES.length) {
      console.log(
        `[seed-dev-t20] ${existing.length} seeded rows already present — skipping. Pass --reset to re-seed.`,
      );
      return;
    }
  }

  // Insert fixtures.
  const rows = FIXTURES.map((f) => ({
    club_id: club.id,
    profile_id: playerId,
    assessor_id: adminId,
    rubric_version_id: rubric.id,
    assessed_on: isoDateNDaysAgo(f.daysAgo),
    status: f.status,
    grade: f.grade,
    total_score: f.totalScore,
    percentage: f.percentage,
    submitted_at:
      f.status === "submitted"
        ? new Date(Date.now() - f.daysAgo * 24 * 60 * 60 * 1000).toISOString()
        : null,
    notes: `${SEED_MARKER} ${f.grade ?? "ungraded"} fixture`,
  }));

  const { error: insErr } = await supabase
    .from("t20_assessments")
    .insert(rows);
  if (insErr) throw insErr;

  console.log(
    `[seed-dev-t20] inserted ${rows.length} assessments for ${PLAYER_EMAIL} @ ${club.name} (rubric ${rubric.version}).`,
  );
  for (const f of FIXTURES) {
    console.log(
      `  • ${f.status} · ${f.grade ?? "ungraded"} · ${f.percentage}% · assessed ${f.daysAgo}d ago`,
    );
  }
  console.log("[seed-dev-t20] done.");
}

main().catch((err) => {
  console.error("[seed-dev-t20] failed:", err);
  process.exit(1);
});
