// Phase 13 / 13-8 / Batch A — Demo seed users (7 canonical accounts).
//
// Roster:
//   super@handibowls.local   → super_admin (no club)
//   admin@demo.local         → club_admin at Demo Bowls Club
//   admin2@demo.local        → club_admin at Pinelands BC (cross-club demo)
//   coach@demo.local         → club_admin at Demo Bowls Club (T20 capture demo)
//   captain@demo.local       → player at Demo Bowls Club (captain demo)
//   player@demo.local        → player at Demo Bowls Club (primary)
//   player2@demo.local       → player at Demo Bowls Club (opposing-captain demo)
//
// All 7 share the password `DemoPass2026!` (see scripts/seed-demo/_lib.ts).
//
// Auth-user creation pattern mirrors scripts/seed-dev-users.ts:
// listUsers + filter + create-or-update. The reset script wipes all
// matching auth users first, so re-running this against a clean
// reset always hits the create-path; the update-path covers re-runs
// without reset (operator running `seed:demo --skip-reset`).

import {
  DEMO_PASSWORD,
  findUserId,
  logSection,
  type Admin,
} from "./_lib";
import type { Database } from "../../types/database.types";

type Role = Database["public"]["Enums"]["user_role"];

export type SeedUser = {
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  displayName: string;
  // Logical role hint for fixtures in commit 2 (T20 coach, tournament
  // captain). NOT stored as a column — derived for downstream
  // fixture modules to find the right account.
  hint?: "coach" | "captain" | "opposing-captain" | "primary-player";
};

export const SEED_USERS: SeedUser[] = [
  {
    email: "super@handibowls.local",
    role: "super_admin",
    firstName: "Sally",
    lastName: "Super",
    displayName: "Sally Super",
  },
  {
    email: "admin@demo.local",
    role: "club_admin",
    firstName: "Alex",
    lastName: "Admin",
    displayName: "Alex Admin",
  },
  {
    email: "admin2@demo.local",
    role: "club_admin",
    firstName: "Mo",
    lastName: "Manager",
    displayName: "Mo Manager",
  },
  {
    email: "coach@demo.local",
    role: "club_admin",
    firstName: "Casey",
    lastName: "Coach",
    displayName: "Casey Coach",
    hint: "coach",
  },
  {
    email: "captain@demo.local",
    role: "player",
    firstName: "Cam",
    lastName: "Captain",
    displayName: "Cam Captain",
    hint: "captain",
  },
  {
    email: "player@demo.local",
    role: "player",
    firstName: "Pat",
    lastName: "Player",
    displayName: "Pat Player",
    hint: "primary-player",
  },
  {
    email: "player2@demo.local",
    role: "player",
    firstName: "Pippa",
    lastName: "Player",
    displayName: "Pippa Player",
    hint: "opposing-captain",
  },
];

export type SeededUser = SeedUser & { id: string };

export async function seedUsers(client: Admin): Promise<SeededUser[]> {
  logSection("Demo seed — auth users + profiles");

  const seeded: SeededUser[] = [];
  for (const u of SEED_USERS) {
    const id = await ensureAuthUser(client, u);

    const { error: profileErr } = await client
      .from("profiles")
      .update({
        role: u.role,
        first_name: u.firstName,
        last_name: u.lastName,
        display_name: u.displayName,
        email: u.email,
        profile_completed: true,
      })
      .eq("id", id);
    if (profileErr) throw profileErr;

    seeded.push({ ...u, id });
    console.log(`  ${u.email.padEnd(32)} ${u.role.padEnd(12)} ${u.displayName}`);
  }

  console.log(
    `\n  Seeded ${seeded.length} demo users. Shared password: ${DEMO_PASSWORD}`,
  );
  return seeded;
}

async function ensureAuthUser(
  client: Admin,
  user: SeedUser,
): Promise<string> {
  const existing = await findUserId(client, user.email);
  if (existing) {
    const { error } = await client.auth.admin.updateUserById(existing, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    return existing;
  }
  const { data, error } = await client.auth.admin.createUser({
    email: user.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  return data.user.id;
}
