// Phase 13 / 13-8 / Batch A / Commit 2 — Demo seed invites.
//
// Four invites at Demo Bowls Club covering every `invite_status` enum
// value (pending / accepted / expired / revoked). Demonstrates the
// resend-button affordance + the audit trail for invitation lifecycle
// on /manage/members.
//
// Invites cascade-delete from clubs (FK ON DELETE CASCADE per
// migration 011) — Stage 2 reset's club-delete handles cleanup.

import { logSection, type Admin } from "./_lib";
import type { ClubRow } from "./clubs";
import type { SeededFiller, SeededUser } from "./users";

export async function seedInvites(
  client: Admin,
  clubs: { demo: ClubRow; pinelands: ClubRow },
  users: SeededUser[],
  fillers: SeededFiller[],
): Promise<void> {
  logSection("Demo seed — invites covering all 4 invite_status values");

  const adminUser = users.find((u) => u.email === "admin@demo.local");
  if (!adminUser) throw new Error("admin@demo.local not seeded");

  // Use the most recent filler (ren@demo.local) as the accepted-invite
  // anchor. Tells the narrative "this invite is the one that brought
  // ren@ into Demo Bowls Club".
  const ren = fillers.find((f) => f.email === "ren@demo.local");
  if (!ren) throw new Error("ren@demo.local filler not seeded");

  const now = new Date();
  const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const rows = [
    {
      // status = 'pending' (default) — invite sent, recipient
      // hasn't responded yet.
      club_id: clubs.demo.id,
      invited_by: adminUser.id,
      email: "pending.invite@example.test",
      role: "player" as const,
      status: "pending" as const,
      expires_at: fourteenDaysFromNow.toISOString(),
      accepted_at: null,
      accepted_profile_id: null,
      note: "Awaiting response — sent 2 days ago.",
    },
    {
      // status = 'accepted' — historical record of the invite that
      // brought ren@demo.local into the club.
      club_id: clubs.demo.id,
      invited_by: adminUser.id,
      email: "ren@demo.local",
      role: "player" as const,
      status: "accepted" as const,
      expires_at: fourteenDaysFromNow.toISOString(),
      accepted_at: twoDaysAgo.toISOString(),
      accepted_profile_id: ren.id,
      note: null,
    },
    {
      // status = 'expired' — invite past its expires_at without
      // being accepted. Demonstrates the resend-button on
      // /manage/members.
      club_id: clubs.demo.id,
      invited_by: adminUser.id,
      email: "expired.invite@example.test",
      role: "player" as const,
      status: "expired" as const,
      expires_at: tenDaysAgo.toISOString(),
      accepted_at: null,
      accepted_profile_id: null,
      note: "Expired without acceptance — operator can resend.",
    },
    {
      // status = 'revoked' — invite explicitly cancelled by an admin
      // (e.g. wrong recipient address).
      club_id: clubs.demo.id,
      invited_by: adminUser.id,
      email: "revoked.invite@example.test",
      role: "player" as const,
      status: "revoked" as const,
      expires_at: fourteenDaysFromNow.toISOString(),
      accepted_at: null,
      accepted_profile_id: null,
      note: "Cancelled — wrong recipient.",
    },
  ];

  // Idempotent: invites have no obvious natural unique key (token is
  // generated server-side). Delete any prior demo invites first by
  // email pattern, then insert.
  await client
    .from("invites")
    .delete()
    .in(
      "email",
      rows.map((r) => r.email),
    );

  const { error } = await client.from("invites").insert(rows);
  if (error) throw error;

  console.log(`  invites — seeded 4 (pending / accepted / expired / revoked)`);
}
