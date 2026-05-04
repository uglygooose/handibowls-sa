import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { formatPlayerName } from "@/lib/format/profile-display";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

import { weekBoundsUtc } from "./week";

// Phase 9-2 — `/manage/overview` Bookings tab data layer.
//
// One fetcher: `getBookingsForWeek(mondayIso)`. Returns every booking
// (regardless of status) that overlaps the SAST Monday→Sunday week
// at the player's club. Cancelled rows are intentionally INCLUDED —
// the calendar visually distinguishes them, and admin ops sometimes
// want to see "what was originally booked vs cancelled".
//
// Booker name resolved via `profiles!booked_by` embed; null when
// the FK was nulled by a profile delete (`ON DELETE SET NULL` per
// migration 005).
//
// Per migration 010 RLS: club_admin reads bookings at clubs they
// admin; super_admin reads everything. The fetcher relies on the
// existing `bookings_member_read` + `bookings_club_admin_rw`
// policies for scope; we additionally filter by club_id at query
// time to keep the result narrow.

type DbBookingPurpose = Database["public"]["Enums"]["booking_purpose"];
type DbBookingStatus = Database["public"]["Enums"]["booking_status"];

export type BookingCalendarRow = {
  id: string;
  rink_id: string;
  rink_label: string;
  starts_at: string;
  ends_at: string;
  purpose: DbBookingPurpose;
  party_size: number | null;
  status: DbBookingStatus;
  notes: string | null;
  booker_name: string;
  booker_email: string | null;
};

export type OverviewData =
  | {
      ok: true;
      clubId: string;
      clubName: string;
      mondayIso: string;
      bookings: BookingCalendarRow[];
    }
  | { ok: false; reason: "no-club" };

export async function getBookingsForWeek(
  mondayIso: string,
): Promise<OverviewData> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, reason: "no-club" };

  const club = await getCurrentHostClub();
  if (!club) return { ok: false, reason: "no-club" };

  const supabase = await createClient();
  const { startUtc, endUtc } = weekBoundsUtc(mondayIso);

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, rink_id, starts_at, ends_at, purpose, party_size, status, notes, booker:profiles!booked_by(first_name, last_name, display_name, email), rink:rinks!inner(number, green:greens!inner(name))",
    )
    .eq("club_id", club.club_id)
    .gte("starts_at", startUtc)
    .lt("starts_at", endUtc)
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("[overview] bookings fetch failed:", error);
    return {
      ok: true,
      clubId: club.club_id,
      clubName: club.club_name,
      mondayIso,
      bookings: [],
    };
  }

  const bookings: BookingCalendarRow[] = (data ?? []).map((b) => {
    const rink = b.rink as
      | { number?: number; green?: { name?: string } | null }
      | null;
    const greenName = rink?.green?.name ?? "Green";
    const rinkLabel = `${greenName} ${rink?.number ?? "?"}`;
    const booker = b.booker as
      | {
          first_name?: string | null;
          last_name?: string | null;
          display_name?: string | null;
          email?: string | null;
        }
      | null;
    return {
      id: b.id,
      rink_id: b.rink_id,
      rink_label: rinkLabel,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      purpose: b.purpose,
      party_size: b.party_size,
      status: b.status,
      notes: b.notes,
      booker_name: bookerName(booker),
      booker_email: booker?.email ?? null,
    };
  });

  return {
    ok: true,
    clubId: club.club_id,
    clubName: club.club_name,
    mondayIso,
    bookings,
  };
}

function bookerName(
  p: {
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null,
): string {
  // Phase 13 / 13-2b / Batch H1 — cross-user display via formatPlayerName.
  // display_name takes precedence when present (user-chosen alias);
  // formatPlayerName handles the first/last composition + anonymisation
  // marker when both are NULL.
  if (p?.display_name) return p.display_name;
  return formatPlayerName(p ?? null);
}

// Phase 9-3 — recent audit_log rows for the admin's club.
//
// Why two queries vs one PostgREST embed:
//   audit_log.row_id is polymorphic (no FK to bookings.id) so PostgREST
//   can't auto-join. We fetch the club's recent booking IDs (cap 500 —
//   plenty for a year of admin actions on one club) then `in()` against
//   them. RLS via `audit_log_visible_to_admin` already enforces club
//   scope; this explicit filter narrows the *display* list to the
//   `clubId` the admin is currently viewing (matters for multi-club
//   admins).
//
//   The 500-row cap on the booking pre-fetch is the only edge case to
//   note: an audit event on a *very* old booking (#501+ down the
//   created_at list) would not surface. In practice admin force-cancels
//   target near-future bookings, so this is acceptable. If the cap ever
//   bites, the right fix is a SECURITY DEFINER `recent_audit_log_for_club`
//   RPC (Phase 12.5 polish).

export type AuditAction = "force_cancel_booking" | string;

export type AuditLogRow = {
  id: string;
  table_name: string;
  row_id: string;
  action: AuditAction;
  reason: string | null;
  performed_at: string;
  performer_name: string;
  performer_email: string | null;
};

export type AuditLogResult =
  | { ok: true; rows: AuditLogRow[] }
  | { ok: false; reason: "no-club" | "error"; error?: string };

const AUDIT_LOG_DEFAULT_LIMIT = 20;
const AUDIT_LOG_BOOKING_PREFETCH_CAP = 500;

export async function getRecentAuditLogForClub(
  clubId: string,
  limit: number = AUDIT_LOG_DEFAULT_LIMIT,
): Promise<AuditLogResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, reason: "no-club" };

  const supabase = await createClient();

  const { data: clubBookings, error: bookingsErr } = await supabase
    .from("bookings")
    .select("id")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(AUDIT_LOG_BOOKING_PREFETCH_CAP);

  if (bookingsErr) {
    console.error("[overview] audit-log bookings prefetch failed:", bookingsErr);
    return { ok: false, reason: "error", error: bookingsErr.message };
  }

  const bookingIds = (clubBookings ?? []).map((b) => b.id);
  if (bookingIds.length === 0) {
    return { ok: true, rows: [] };
  }

  const { data, error } = await supabase
    .from("audit_log")
    .select(
      "id, table_name, row_id, action, reason, performed_at, performer:profiles!performed_by(first_name, last_name, display_name, email)",
    )
    .eq("table_name", "bookings")
    .in("row_id", bookingIds)
    .order("performed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[overview] audit-log fetch failed:", error);
    return { ok: false, reason: "error", error: error.message };
  }

  const rows: AuditLogRow[] = (data ?? []).map((r) => {
    const performer = r.performer as
      | {
          first_name?: string | null;
          last_name?: string | null;
          display_name?: string | null;
          email?: string | null;
        }
      | null;
    return {
      id: r.id,
      table_name: r.table_name,
      row_id: r.row_id,
      action: r.action,
      reason: r.reason,
      performed_at: r.performed_at,
      performer_name: bookerName(performer),
      performer_email: performer?.email ?? null,
    };
  });

  return { ok: true, rows };
}

// Phase 13 / 13-6 / Batch C — Getting-started checklist state.
//
// Five cheap existence checks that drive the AdminGettingStartedChecklist
// card on /manage/overview. Each check is a `.limit(1/2)` against an
// existing table — no aggregate count, no new RPC, no joins beyond the
// rinks → greens FK already used by the bookings calendar query.
//
// All five run in parallel via Promise.all. RLS already scopes the
// caller to their own club; the explicit `club_id`/`host_club_id`
// filters keep the fetched rows narrow for multi-club admins.
//
// Per-table state derivation:
//   greens-and-rinks   greens.club_id has any row + rinks (joined via
//                      greens!inner) has any row with active=true
//   invited-member     club_memberships.club_id has ≥2 active rows
//                      (admin themselves + at least one other)
//   booking-window     booking_windows.club_id has any row
//   first-tournament   tournaments.host_club_id has any row (any status,
//                      drafts count)
//   first-message      messages.club_id has any row (any status,
//                      drafts count — matches "authored" framing)

export type OnboardingChecklistState = {
  hasGreensAndRinks: boolean;
  hasInvitedMember: boolean;
  hasBookingAvailability: boolean;
  hasFirstTournament: boolean;
  hasFirstMessage: boolean;
};

export async function getOnboardingChecklistState(
  clubId: string,
): Promise<OnboardingChecklistState> {
  const supabase = await createClient();

  const [greens, activeRinks, members, windows, tournaments, messages] =
    await Promise.all([
      supabase.from("greens").select("id").eq("club_id", clubId).limit(1),
      supabase
        .from("rinks")
        .select("id, greens!inner(club_id)")
        .eq("greens.club_id", clubId)
        .eq("active", true)
        .limit(1),
      supabase
        .from("club_memberships")
        .select("id")
        .eq("club_id", clubId)
        .eq("status", "active")
        .limit(2),
      supabase
        .from("booking_windows")
        .select("id")
        .eq("club_id", clubId)
        .limit(1),
      supabase
        .from("tournaments")
        .select("id")
        .eq("host_club_id", clubId)
        .limit(1),
      supabase.from("messages").select("id").eq("club_id", clubId).limit(1),
    ]);

  // Soft-fail per query: a Supabase error degrades that signal to false
  // (i.e. the item shows as unchecked) rather than blowing up the page.
  // Errors are still logged for triage.
  const has = (
    label: string,
    res: { data: unknown[] | null; error: { message: string } | null },
    minRows = 1,
  ): boolean => {
    if (res.error) {
      console.error(`[overview] checklist '${label}' query failed:`, res.error);
      return false;
    }
    return (res.data?.length ?? 0) >= minRows;
  };

  return {
    hasGreensAndRinks:
      has("greens", greens) && has("active-rinks", activeRinks),
    hasInvitedMember: has("memberships", members, 2),
    hasBookingAvailability: has("booking-windows", windows),
    hasFirstTournament: has("tournaments", tournaments),
    hasFirstMessage: has("messages", messages),
  };
}
