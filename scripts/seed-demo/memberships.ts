// Phase 13 / 13-8 / Batch A — Demo seed club_memberships +
// club_admin_assignments.
//
// Mapping:
//   admin@demo.local      → club_admin_assignments(Demo Bowls Club)
//   admin2@demo.local     → club_admin_assignments(Pinelands BC)
//   coach@demo.local      → club_admin_assignments(Demo Bowls Club)
//   captain@demo.local    → club_memberships(Demo Bowls Club, primary)
//   player@demo.local     → club_memberships(Demo Bowls Club, primary)
//   player2@demo.local    → club_memberships(Demo Bowls Club, primary)
//   super@handibowls.local → no club affiliation (platform-only)
//
// Idempotent via unique (profile_id, club_id) on both tables.
//
// Bulk filler memberships (30-50 members at Demo Bowls Club for the
// /manage/members pagination demo) land in Commit 2 alongside the
// invite + tournament-team fixtures — those need additional auth
// users which depend on the patterns this file establishes.

import { logSection, type Admin } from "./_lib";
import type { ClubRow } from "./clubs";
import type { SeededUser } from "./users";

export async function seedMemberships(
  client: Admin,
  users: SeededUser[],
  clubs: { demo: ClubRow; pinelands: ClubRow },
): Promise<void> {
  logSection("Demo seed — club memberships + admin assignments");

  for (const u of users) {
    if (u.email === "super@handibowls.local") continue;

    const targetClub =
      u.email === "admin2@demo.local" ? clubs.pinelands : clubs.demo;

    if (u.role === "club_admin") {
      const { error } = await client
        .from("club_admin_assignments")
        .upsert(
          { profile_id: u.id, club_id: targetClub.id },
          { onConflict: "profile_id,club_id" },
        );
      if (error) throw error;
      console.log(
        `  ${u.email.padEnd(32)} club_admin_assignment → ${targetClub.name}`,
      );
    } else if (u.role === "player") {
      const { error } = await client.from("club_memberships").upsert(
        {
          profile_id: u.id,
          club_id: targetClub.id,
          status: "active",
          is_primary: true,
        },
        { onConflict: "profile_id,club_id" },
      );
      if (error) throw error;
      console.log(
        `  ${u.email.padEnd(32)} club_membership → ${targetClub.name} (primary)`,
      );
    }
  }
}
