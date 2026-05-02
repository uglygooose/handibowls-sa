import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/role";
import { createServiceClient } from "@/lib/supabase/service";

// Phase 13 / 13-2b / Batch G2 — POPIA Section 23(2)(c) data
// portability endpoint.
//
// GET /api/me/export
//   Authenticated user only. Returns a single JSON blob keyed by
//   the user's auth.uid() containing every row across the schema
//   that references the user (authored, owned, or recipient).
//   Triggers a synchronous browser download via
//   Content-Disposition: attachment.
//
// Tables in the export (per scoping § 1):
//   - profiles                    — own row
//   - consents                    — every row
//   - club_memberships            — every row (incl. inactive +
//                                   primary flag history)
//   - club_admin_assignments      — every row (admin assignments
//                                   are part of the user's data
//                                   trail even though there's no
//                                   PII on them — for super_admin /
//                                   club_admin users only, empty
//                                   for player-only users)
//   - tournament_team_members     — every row where profile_id =
//                                   self
//   - tournament_entries          — every row where profile_id =
//                                   self (Note: profile_id has ON
//                                   DELETE SET NULL — historical
//                                   entries with NULL profile_id
//                                   on hard-deleted users are
//                                   intentionally excluded since
//                                   they no longer reference any
//                                   user)
//   - bookings                    — every row where booked_by =
//                                   self OR for_profile_id = self
//   - matches                     — every row where one of the
//                                   teams the user belongs to is
//                                   home_team_id or away_team_id
//                                   (resolved via team_members)
//   - match_ends                  — every row where submitted_by =
//                                   self
//   - t20_assessments             — every row where profile_id =
//                                   self OR assessor_id = self
//   - t20_deliveries              — every row tied to assessments
//                                   the user authored or is the
//                                   subject of (resolved via
//                                   assessment_id)
//   - messages                    — every row where sender_id =
//                                   self
//   - message_recipients          — every row where profile_id =
//                                   self (with linked message_id
//                                   for cross-reference)
//   - notifications               — every row where profile_id =
//                                   self
//   - audit_log                   — every row where performed_by =
//                                   self (own actions; not actions
//                                   performed against the user by
//                                   admins — those have row_id=
//                                   user but performed_by=admin
//                                   and are separately included
//                                   below)
//   - audit_log (admin actions)   — every row where row_id = self
//                                   AND table_name='profiles' (so
//                                   admin-driven deletion +
//                                   anonymisation events affecting
//                                   the user are surfaced)
//
// Service-role queries deliberately bypass the user's session
// RLS. Per POPIA, the user has the right to receive ALL their
// personal data — including rows their current RLS access might
// not surface (e.g. messages they sent before leaving a club,
// audit_log entries they performed before a role change). The
// route's authentication gate (getAuthContext) ensures the
// requester IS the user whose data is being exported.
//
// Audit log entry on every successful export — retention_category
// = 'compliance' (POPIA Section 23(2)(c) is a documented user
// rights exercise).
//
// Payload size estimate:
//   v1 dev seed users hit ~5-50 KB each. A real-world heavy user
//   (years of bookings, hundreds of messages, multiple
//   tournaments, weekly T20 assessments) projects to ~500 KB - 2
//   MB. Single-blob synchronous response is fine up to ~5 MB
//   (Vercel's default body size limit is 4 MB on free / 50 MB
//   on Pro). Streaming export deferred to Phase 14 if observed
//   payloads exceed the limit; flag in the post-launch
//   monitoring DRIFT.

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  const userId = ctx.userId;
  const admin = createServiceClient();

  // First pass — direct user-keyed lookups. All run in parallel.
  const [
    profileRes,
    consentsRes,
    membershipsRes,
    adminAssignmentsRes,
    teamMembersRes,
    entriesRes,
    bookingsBookedByRes,
    bookingsForProfileRes,
    matchEndsRes,
    assessmentsAsPlayerRes,
    assessmentsAsAssessorRes,
    messagesSentRes,
    recipientsRes,
    notificationsRes,
    auditPerformedByRes,
    auditOwnProfileRes,
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    admin.from("consents").select("*").eq("profile_id", userId),
    admin.from("club_memberships").select("*").eq("profile_id", userId),
    admin.from("club_admin_assignments").select("*").eq("profile_id", userId),
    admin
      .from("tournament_team_members")
      .select("*")
      .eq("profile_id", userId),
    admin.from("tournament_entries").select("*").eq("profile_id", userId),
    admin.from("bookings").select("*").eq("booked_by", userId),
    admin.from("bookings").select("*").eq("for_profile_id", userId),
    admin.from("match_ends").select("*").eq("submitted_by", userId),
    admin.from("t20_assessments").select("*").eq("profile_id", userId),
    admin.from("t20_assessments").select("*").eq("assessor_id", userId),
    admin.from("messages").select("*").eq("sender_id", userId),
    admin.from("message_recipients").select("*").eq("profile_id", userId),
    admin.from("notifications").select("*").eq("profile_id", userId),
    admin.from("audit_log").select("*").eq("performed_by", userId),
    admin
      .from("audit_log")
      .select("*")
      .eq("row_id", userId)
      .eq("table_name", "profiles"),
  ]);

  // Aggregate any errors. Fail-fast on any single query failure
  // so a partial export isn't silently shipped.
  const errors = [
    profileRes.error,
    consentsRes.error,
    membershipsRes.error,
    adminAssignmentsRes.error,
    teamMembersRes.error,
    entriesRes.error,
    bookingsBookedByRes.error,
    bookingsForProfileRes.error,
    matchEndsRes.error,
    assessmentsAsPlayerRes.error,
    assessmentsAsAssessorRes.error,
    messagesSentRes.error,
    recipientsRes.error,
    notificationsRes.error,
    auditPerformedByRes.error,
    auditOwnProfileRes.error,
  ].filter((e) => e !== null);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: `Export failed: ${errors[0]?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  // Second pass — resolved via first-pass results.
  // Matches: where one of the user's team_ids is home or away.
  const teamIds = (teamMembersRes.data ?? []).map((tm) => tm.team_id);
  const assessmentIds = [
    ...(assessmentsAsPlayerRes.data ?? []).map((a) => a.id),
    ...(assessmentsAsAssessorRes.data ?? []).map((a) => a.id),
  ];

  const [matchesRes, deliveriesRes] = await Promise.all([
    teamIds.length > 0
      ? admin
          .from("matches")
          .select("*")
          .or(
            `home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`,
          )
      : Promise.resolve({ data: [] as unknown[], error: null }),
    assessmentIds.length > 0
      ? admin
          .from("t20_deliveries")
          .select("*")
          .in("assessment_id", assessmentIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);

  if (matchesRes.error) {
    return NextResponse.json(
      { error: `Export failed (matches): ${matchesRes.error.message}` },
      { status: 500 },
    );
  }
  if (deliveriesRes.error) {
    return NextResponse.json(
      { error: `Export failed (deliveries): ${deliveriesRes.error.message}` },
      { status: 500 },
    );
  }

  // Combine + dedupe overlap (e.g. a row that matches both
  // assessmentsAsPlayer and assessmentsAsAssessor — possible if
  // the user assessed themselves; rare but defensible).
  const dedupById = <T extends { id: string }>(rows: T[]): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const r of rows) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        out.push(r);
      }
    }
    return out;
  };

  const tables = {
    profiles: profileRes.data ? [profileRes.data] : [],
    consents: consentsRes.data ?? [],
    club_memberships: membershipsRes.data ?? [],
    club_admin_assignments: adminAssignmentsRes.data ?? [],
    tournament_team_members: teamMembersRes.data ?? [],
    tournament_entries: entriesRes.data ?? [],
    bookings: dedupById([
      ...(bookingsBookedByRes.data ?? []),
      ...(bookingsForProfileRes.data ?? []),
    ]),
    matches: matchesRes.data ?? [],
    match_ends: matchEndsRes.data ?? [],
    t20_assessments: dedupById([
      ...(assessmentsAsPlayerRes.data ?? []),
      ...(assessmentsAsAssessorRes.data ?? []),
    ]),
    t20_deliveries: deliveriesRes.data ?? [],
    messages: messagesSentRes.data ?? [],
    message_recipients: recipientsRes.data ?? [],
    notifications: notificationsRes.data ?? [],
    audit_log: dedupById([
      ...(auditPerformedByRes.data ?? []),
      ...(auditOwnProfileRes.data ?? []),
    ]),
  };

  const exportedAt = new Date().toISOString();
  const payload = {
    exported_at: exportedAt,
    user_id: userId,
    schema_version: "popia-v1",
    tables,
  };

  // Audit log — POPIA Section 23(2)(c) compliance event. Service-
  // role insert per the established lib/auth/actions.ts:309
  // pattern.
  await admin.from("audit_log").insert({
    table_name: "profiles",
    row_id: userId,
    action: "data_export_requested",
    reason: "User-initiated POPIA data portability export.",
    payload: { schema_version: "popia-v1" } as never,
    performed_by: userId,
    retention_category: "compliance",
  });

  // Filename: handibowls-data-export-{user_id}-{YYYYMMDD}.json.
  // Date in the basename so users who export multiple times can
  // disambiguate. user_id (UUID) keeps the file unambiguous if a
  // user has multiple browser sessions or shared a download folder.
  const yyyymmdd = exportedAt.slice(0, 10).replace(/-/g, "");
  const filename = `handibowls-data-export-${userId}-${yyyymmdd}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
