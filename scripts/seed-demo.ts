// Phase 13 / 13-8 / Batch A — Demo seed orchestrator.
//
// DEMO SUPABASE ONLY. Never run against a Supabase project that
// contains real pilot/customer data. There is no production-safety
// check — we trust the operator to know which environment they're
// targeting. See docs/DEMO_LOGINS.md for the operator handoff.
//
// Usage:
//   npm run seed:demo               — reset + full seed
//   npm run seed:demo:reset         — reset only (no seed)
//   tsx scripts/seed-demo.ts --skip-reset  — additive seed without reset
//
// Sub-modules under scripts/seed-demo/:
//   _lib.ts        — shared Supabase client + env loader + password constant
//   _reset.ts      — reset logic (delete demo-tagged rows)
//   clubs.ts       — districts verify + clubs + greens + rinks
//   users.ts       — 7 demo auth users + profiles
//   memberships.ts — club_memberships + club_admin_assignments
//
// Commit 2 will add: tournaments, bookings, t20, messages,
// notifications, plus the coverage matrix test.

import { admin, logSection } from "./seed-demo/_lib";
import { resetDemoData } from "./seed-demo/_reset";
import { ensureDistricts, seedClubs } from "./seed-demo/clubs";
import { seedUsers } from "./seed-demo/users";
import { seedMemberships } from "./seed-demo/memberships";

async function main() {
  const args = process.argv.slice(2);
  const resetOnly = args.includes("--reset-only");
  const skipReset = args.includes("--skip-reset");

  if (!skipReset) {
    await resetDemoData();
  }
  if (resetOnly) {
    return;
  }

  const client = admin();

  logSection("Demo seed — pre-flight (verify migration-seeded reference data)");
  const districts = await ensureDistricts(client);

  const clubs = await seedClubs(client, districts);
  const users = await seedUsers(client);
  await seedMemberships(client, users, clubs);

  logSection("Demo seed — Commit 1 fixtures complete");
  console.log(
    "  Next: Commit 2 ships tournaments, bookings, T20 assessments,",
  );
  console.log(
    "  messages, notifications, and the coverage matrix test.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
