// Phase 13 / 13-8 / Batch A / Commit 2 — Demo seed messages +
// recipients + notifications.
//
// Messages: 5 covering channel × audience diversity at Demo BC:
//   1. in_app only, all_members      — admin broadcast
//   2. email only, all_members       — newsletter-style
//   3. both channels, tournament_entrants — pre-tournament reminder
//   4. both channels, custom audience — direct message to a few
//   5. in_app only, all_members, draft state — unsent admin draft
//
// message_status enum coverage: draft (1) + sent (4) — minimum
// reachable on the live path.
// message_channel enum coverage (via send_in_app + send_email
// booleans): in_app (rows 1,3,4,5) + email (rows 2,3,4) reachable.
// audience_kind coverage: all_members (3) + tournament_entrants (1)
// + custom (1) = 3/3 reachable.
//
// message_recipients: per-message rows for the demo player accounts.
// in_app_status enum coverage: unread (some) + read (some) +
// archived (one) = 3/3 reachable.
//
// Notifications: 5 covering every related_kind from
// NotificationsBell.tsx routing taxonomy:
//   message / booking / t20_assessment / match / tournament
// Mix of read/unread for player@'s inbox demo.

import { logSection, type Admin } from "./_lib";
import type { ClubRow } from "./clubs";
import type { SeededFiller, SeededUser } from "./users";

const NOW = new Date();
const ONE_HOUR = 60 * 60 * 1000;

function isoAgo(hoursAgo: number): string {
  return new Date(NOW.getTime() - hoursAgo * ONE_HOUR).toISOString();
}

export async function seedMessages(
  client: Admin,
  clubs: { demo: ClubRow; pinelands: ClubRow },
  users: SeededUser[],
  fillers: SeededFiller[],
): Promise<void> {
  logSection("Demo seed — messages + recipients + notifications");

  const adminUser = req(users, "admin@demo.local");
  const playerUser = req(users, "player@demo.local");
  const captainUser = req(users, "captain@demo.local");
  const player2User = req(users, "player2@demo.local");

  const allDemoPlayerIds = [
    playerUser.id,
    player2User.id,
    captainUser.id,
    ...fillers.filter((f) => f.clubSlug === "demo-bowls-club").map((f) => f.id),
  ];

  // Pre-wipe demo messages (cascades recipients).
  await client
    .from("messages")
    .delete()
    .in("club_id", [clubs.demo.id, clubs.pinelands.id]);

  type Message = {
    club_id: string;
    sender_id: string;
    subject: string;
    body_md: string;
    send_in_app: boolean;
    send_email: boolean;
    audience_kind: "all_members" | "tournament_entrants" | "custom";
    audience_tournament_id: string | null;
    audience_profile_ids: string[];
    status: "draft" | "queued" | "sent" | "failed";
    sent_at: string | null;
    recipient_count: number;
  };

  const messages: Message[] = [
    {
      club_id: clubs.demo.id,
      sender_id: adminUser.id,
      subject: "Welcome to the new season",
      body_md: "Hello members — the bowls season is upon us. Practice greens open Monday.",
      send_in_app: true,
      send_email: false,
      audience_kind: "all_members",
      audience_tournament_id: null,
      audience_profile_ids: [],
      status: "sent",
      sent_at: isoAgo(48),
      recipient_count: allDemoPlayerIds.length,
    },
    {
      club_id: clubs.demo.id,
      sender_id: adminUser.id,
      subject: "Monthly newsletter — March recap",
      body_md: "## March highlights\n\nThree tournaments completed; Mixed Triples final won by Champions team.",
      send_in_app: false,
      send_email: true,
      audience_kind: "all_members",
      audience_tournament_id: null,
      audience_profile_ids: [],
      status: "sent",
      sent_at: isoAgo(72),
      recipient_count: allDemoPlayerIds.length,
    },
    {
      club_id: clubs.demo.id,
      sender_id: adminUser.id,
      subject: "Autumn Pairs round 1 — schedule confirmed",
      body_md: "Round 1 fixtures are on /tournaments. Check your match time + rink.",
      send_in_app: true,
      send_email: true,
      audience_kind: "tournament_entrants",
      audience_tournament_id: null,
      audience_profile_ids: [],
      status: "sent",
      sent_at: isoAgo(24),
      recipient_count: 8,
    },
    {
      club_id: clubs.demo.id,
      sender_id: adminUser.id,
      subject: "Coach availability — pick a slot",
      body_md: "I have 3 open coaching slots this week. Reply or DM to claim.",
      send_in_app: true,
      send_email: true,
      audience_kind: "custom",
      audience_tournament_id: null,
      audience_profile_ids: [playerUser.id, captainUser.id],
      status: "sent",
      sent_at: isoAgo(6),
      recipient_count: 2,
    },
    {
      club_id: clubs.demo.id,
      sender_id: adminUser.id,
      subject: "AGM agenda (draft — not sent yet)",
      body_md: "Draft notice — review before sending.",
      send_in_app: true,
      send_email: false,
      audience_kind: "all_members",
      audience_tournament_id: null,
      audience_profile_ids: [],
      status: "draft",
      sent_at: null,
      recipient_count: 0,
    },
  ];

  const { data: insertedMsgs, error: msgErr } = await client
    .from("messages")
    .insert(messages)
    .select("id, subject, status");
  if (msgErr) throw msgErr;
  console.log(`  messages — seeded ${insertedMsgs?.length ?? 0} (4 sent + 1 draft, channel/audience diversity)`);

  // Recipients for the 4 sent messages targeted at player@/captain@/player2@.
  // Mix of in_app_status: unread, read, archived.
  type Recipient = {
    message_id: string;
    profile_id: string;
    in_app_status: "unread" | "read" | "archived";
    read_at: string | null;
    sent_at: string;
  };
  const recipients: Recipient[] = [];
  const sentMsgs = (insertedMsgs ?? []).filter((m) => m.status === "sent");
  const statuses: Array<"unread" | "read" | "archived"> = [
    "unread",
    "read",
    "archived",
    "unread",
  ];
  for (let i = 0; i < sentMsgs.length; i++) {
    const m = sentMsgs[i];
    const status = statuses[i % statuses.length];
    for (const pid of [playerUser.id, captainUser.id, player2User.id]) {
      recipients.push({
        message_id: m.id,
        profile_id: pid,
        in_app_status: status,
        read_at: status === "read" || status === "archived" ? isoAgo(2) : null,
        sent_at: isoAgo(24),
      });
    }
  }

  if (recipients.length > 0) {
    const { error: recErr } = await client
      .from("message_recipients")
      .insert(recipients);
    if (recErr) throw recErr;
  }
  console.log(
    `  message_recipients — seeded ${recipients.length} rows across ${sentMsgs.length} sent messages (unread/read/archived mix)`,
  );

  // Notifications for player@ — 1 per related_kind for routing demo.
  await client.from("notifications").delete().eq("profile_id", playerUser.id);

  type Notification = {
    profile_id: string;
    club_id: string;
    kind: string;
    title: string;
    body: string | null;
    related_kind: string;
    related_id: string | null;
    read: boolean;
    read_at: string | null;
  };

  const notifs: Notification[] = [
    {
      profile_id: playerUser.id,
      club_id: clubs.demo.id,
      kind: "message_new",
      title: "New message: Coach availability — pick a slot",
      body: "Tap to read on /me/inbox.",
      related_kind: "message",
      related_id: null,
      read: false,
      read_at: null,
    },
    {
      profile_id: playerUser.id,
      club_id: clubs.demo.id,
      kind: "booking_confirmed",
      title: "Booking confirmed — Tuesday 14:00",
      body: "Practice slot at Main 1 confirmed.",
      related_kind: "booking",
      related_id: null,
      read: false,
      read_at: null,
    },
    {
      profile_id: playerUser.id,
      club_id: clubs.demo.id,
      kind: "t20_grade_published",
      title: "Twenty 20 grade: Gold",
      body: "Your latest assessment graded Gold (82.6%).",
      related_kind: "t20_assessment",
      related_id: null,
      read: true,
      read_at: isoAgo(6),
    },
    {
      profile_id: playerUser.id,
      club_id: clubs.demo.id,
      kind: "match_scheduled",
      title: "Match scheduled: Team A vs Team C",
      body: "Round 1, tomorrow 13:00.",
      related_kind: "match",
      related_id: null,
      read: false,
      read_at: null,
    },
    {
      profile_id: playerUser.id,
      club_id: clubs.demo.id,
      kind: "tournament_entered",
      title: "You're entered: Autumn Pairs Round-Robin",
      body: "Entries close in 3 days.",
      related_kind: "tournament",
      related_id: null,
      read: true,
      read_at: isoAgo(48),
    },
  ];

  const { error: notifErr } = await client.from("notifications").insert(notifs);
  if (notifErr) throw notifErr;
  console.log(
    `  notifications — seeded ${notifs.length} for player@ (1 per related_kind: message/booking/t20_assessment/match/tournament)`,
  );
}

function req<T extends { email: string }>(arr: T[], email: string): T {
  const u = arr.find((x) => x.email === email);
  if (!u) throw new Error(`required user not found: ${email}`);
  return u;
}
