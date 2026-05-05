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
import { seedFillerMembers, seedUsers } from "./seed-demo/users";
import {
  seedFillerMemberships,
  seedMemberships,
} from "./seed-demo/memberships";
import { seedInvites } from "./seed-demo/invites";
import { seedTournaments } from "./seed-demo/tournaments";
import { seedBookings } from "./seed-demo/bookings";
import { seedT20 } from "./seed-demo/t20";
import { seedMessages } from "./seed-demo/messages";

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

  // Commit 2 fixtures — additive on top of canonical 7 users + 2 clubs.
  const fillers = await seedFillerMembers(client);
  await seedFillerMemberships(client, fillers, clubs);
  await seedInvites(client, clubs, users, fillers);
  await seedTournaments(client, clubs, users, fillers);
  await seedBookings(client, clubs, users, fillers);
  await seedT20(client, clubs, users, fillers);
  await seedMessages(client, clubs, users, fillers);

  logSection("Demo seed — fixtures complete");
  console.log(
    "  All state-machine matrix cells reachable. Run",
  );
  console.log(
    "  `npx vitest run tests/scripts/seed-demo-coverage.test.ts`",
  );
  console.log(
    "  to verify the post-seed coverage assertions.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
