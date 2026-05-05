// Phase 13 / 13-8 / Batch A / Commit 2 — Demo seed bookings + windows.
//
// Booking windows: weekday Mon–Sat 09:00–17:00 at Demo BC's 2 greens
// + Pinelands' 1 green. Covers the next 14-day visible range on /book
// per locked decision (functional minimum to render the date strip
// + slot list cleanly).
//
// Bookings: ~10 covering every reachable booking_purpose enum
// (roll_up, practice, coaching, match, social, t20_assessment) +
// past + upcoming + in-flight diversity. Idempotent via pre-delete
// on club_id (Stage 2 reset already wipes; this defends against
// `--skip-reset` re-runs).

import { logSection, type Admin } from "./_lib";
import type { ClubRow } from "./clubs";
import type { SeededFiller, SeededUser } from "./users";

const NOW = new Date();
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

function isoAt(daysFromNow: number, hour: number): string {
  const d = new Date(NOW.getTime() + daysFromNow * ONE_DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export async function seedBookings(
  client: Admin,
  clubs: { demo: ClubRow; pinelands: ClubRow },
  users: SeededUser[],
  fillers: SeededFiller[],
): Promise<void> {
  logSection("Demo seed — booking windows + bookings");

  await seedBookingWindows(client, clubs);
  await seedBookingRows(client, clubs, users, fillers);
}

async function seedBookingWindows(
  client: Admin,
  clubs: { demo: ClubRow; pinelands: ClubRow },
) {
  // Wipe demo booking_windows first (cascade from clubs handles
  // most, but defensive on --skip-reset).
  await client
    .from("booking_windows")
    .delete()
    .in("club_id", [clubs.demo.id, clubs.pinelands.id]);

  // Resolve all greens at Demo BC + Pinelands.
  const { data: demoGreens } = await client
    .from("greens")
    .select("id")
    .eq("club_id", clubs.demo.id);
  const { data: pinGreens } = await client
    .from("greens")
    .select("id")
    .eq("club_id", clubs.pinelands.id);

  type Window = {
    club_id: string;
    green_id: string;
    weekday: number;
    starts_time: string;
    ends_time: string;
    is_closure: boolean;
  };

  const windows: Window[] = [];
  // Mon–Sat (weekday 1..6), 09:00–17:00 at every demo green.
  for (const g of demoGreens ?? []) {
    for (let weekday = 1; weekday <= 6; weekday++) {
      windows.push({
        club_id: clubs.demo.id,
        green_id: g.id,
        weekday,
        starts_time: "09:00",
        ends_time: "17:00",
        is_closure: false,
      });
    }
  }
  for (const g of pinGreens ?? []) {
    for (let weekday = 1; weekday <= 6; weekday++) {
      windows.push({
        club_id: clubs.pinelands.id,
        green_id: g.id,
        weekday,
        starts_time: "09:00",
        ends_time: "17:00",
        is_closure: false,
      });
    }
  }

  if (windows.length > 0) {
    const { error } = await client.from("booking_windows").insert(windows);
    if (error) throw error;
  }
  console.log(
    `  booking_windows — seeded ${windows.length} weekly windows (Mon–Sat 09:00–17:00 across all demo greens)`,
  );
}

async function seedBookingRows(
  client: Admin,
  clubs: { demo: ClubRow; pinelands: ClubRow },
  users: SeededUser[],
  fillers: SeededFiller[],
) {
  // Pre-wipe demo bookings.
  await client
    .from("bookings")
    .delete()
    .in("club_id", [clubs.demo.id, clubs.pinelands.id]);

  const playerUser = req(users, "player@demo.local");
  const captainUser = req(users, "captain@demo.local");
  const player2User = req(users, "player2@demo.local");
  const veeFiller = reqF(fillers, "vee@demo.local");
  const coachUser = req(users, "coach@demo.local");

  // Resolve a Demo BC rink id (any active rink).
  const { data: demoRinks } = await client
    .from("rinks")
    .select("id, greens!inner(club_id)")
    .eq("greens.club_id", clubs.demo.id)
    .eq("active", true)
    .limit(2);
  const { data: pinRinks } = await client
    .from("rinks")
    .select("id, greens!inner(club_id)")
    .eq("greens.club_id", clubs.pinelands.id)
    .eq("active", true)
    .limit(1);

  if (!demoRinks || demoRinks.length === 0) {
    throw new Error("Demo BC has no active rinks");
  }
  const demoRink1 = demoRinks[0].id;
  const demoRink2 = demoRinks[1]?.id ?? demoRink1;
  const pinRink = pinRinks?.[0]?.id;

  type Booking = {
    rink_id: string;
    club_id: string;
    booked_by: string;
    purpose: "roll_up" | "practice" | "coaching" | "match" | "social" | "t20_assessment";
    starts_at: string;
    ends_at: string;
    party_size: number | null;
    notes: string | null;
    status?: "booked" | "cancelled";
    // Per migration 037 CHECK: required IFF purpose='t20_assessment'.
    // Identifies the player whose assessment the booking is FOR;
    // distinct from booked_by (= the admin who scheduled it).
    for_profile_id?: string | null;
  };

  // 6 future bookings — 1 per booking_purpose enum at Demo BC.
  // Spread across +1d → +6d so /book's date strip shows variety.
  const futures: Booking[] = [
    {
      rink_id: demoRink1,
      club_id: clubs.demo.id,
      booked_by: playerUser.id,
      purpose: "roll_up",
      starts_at: isoAt(1, 10),
      ends_at: isoAt(1, 12),
      party_size: 4,
      notes: "Casual roll-up.",
    },
    {
      rink_id: demoRink1,
      club_id: clubs.demo.id,
      booked_by: captainUser.id,
      purpose: "practice",
      starts_at: isoAt(2, 14),
      ends_at: isoAt(2, 16),
      party_size: 3,
      notes: "Pre-tournament practice.",
    },
    {
      rink_id: demoRink2,
      club_id: clubs.demo.id,
      booked_by: coachUser.id,
      purpose: "coaching",
      starts_at: isoAt(3, 9),
      ends_at: isoAt(3, 11),
      party_size: 2,
      notes: "Lead-position fundamentals.",
    },
    {
      rink_id: demoRink1,
      club_id: clubs.demo.id,
      booked_by: captainUser.id,
      purpose: "match",
      starts_at: isoAt(4, 13),
      ends_at: isoAt(4, 17),
      party_size: 4,
      notes: "Round-robin Match A vs C.",
    },
    {
      rink_id: demoRink2,
      club_id: clubs.demo.id,
      booked_by: veeFiller.id,
      purpose: "social",
      starts_at: isoAt(5, 15),
      ends_at: isoAt(5, 17),
      party_size: 8,
      notes: "Club social afternoon.",
    },
    {
      rink_id: demoRink1,
      club_id: clubs.demo.id,
      booked_by: coachUser.id,
      purpose: "t20_assessment",
      starts_at: isoAt(6, 10),
      ends_at: isoAt(6, 12),
      party_size: 2,
      notes: "Twenty 20 assessment scheduled by club admin.",
      for_profile_id: captainUser.id,
    },
  ];

  // 3 historical bookings — anchor /me past-bookings render.
  const historical: Booking[] = [
    {
      rink_id: demoRink1,
      club_id: clubs.demo.id,
      booked_by: playerUser.id,
      purpose: "practice",
      starts_at: isoAt(-7, 14),
      ends_at: isoAt(-7, 16),
      party_size: 2,
      notes: null,
    },
    {
      rink_id: demoRink2,
      club_id: clubs.demo.id,
      booked_by: player2User.id,
      purpose: "roll_up",
      starts_at: isoAt(-3, 10),
      ends_at: isoAt(-3, 12),
      party_size: 4,
      notes: null,
      status: "cancelled",
    },
    {
      rink_id: demoRink1,
      club_id: clubs.demo.id,
      booked_by: captainUser.id,
      purpose: "match",
      starts_at: isoAt(-13, 13),
      ends_at: isoAt(-13, 17),
      party_size: 4,
      notes: "Mixed Triples Final.",
    },
  ];

  // 1 cross-club at Pinelands BC (in-flight: today).
  const pinelandsBookings: Booking[] = pinRink
    ? [
        {
          rink_id: pinRink,
          club_id: clubs.pinelands.id,
          booked_by: req(users, "admin2@demo.local").id,
          purpose: "match",
          starts_at: isoAt(0, 14),
          ends_at: isoAt(0, 17),
          party_size: 2,
          notes: "Pinelands Singles 2026 round 1.",
        },
      ]
    : [];

  // Default status to 'booked' before insert. Schema has a default
  // but supabase-js sometimes serializes the missing key as null
  // (depending on the runtime path) which trips the NOT NULL
  // constraint. Explicit default is the safe move.
  const all = [...futures, ...historical, ...pinelandsBookings].map((b) => ({
    ...b,
    status: b.status ?? ("booked" as const),
  }));
  const { error } = await client.from("bookings").insert(all);
  if (error) throw error;

  console.log(
    `  bookings — seeded ${all.length} (${futures.length} upcoming covering all 6 purposes, ${historical.length} historical, ${pinelandsBookings.length} cross-club)`,
  );
}

function req<T extends { email: string }>(arr: T[], email: string): T {
  const u = arr.find((x) => x.email === email);
  if (!u) throw new Error(`required user not found: ${email}`);
  return u;
}

function reqF(arr: SeededFiller[], email: string): SeededFiller {
  return req(arr, email);
}
