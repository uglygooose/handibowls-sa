import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { createClient } from "@/lib/supabase/server";
import {
  type Rubric,
  RubricSchema,
  type SectionKey,
} from "@/lib/t20/rubric";
import type { Database } from "@/types/database.types";

// Phase 10 — Twenty 20 admin data layer.
//
// Three fetchers:
//
//   getActiveRubric()             — currently-active t20_rubric_versions
//                                   row, parsed against RubricSchema.
//                                   Cached one fetch per request.
//
//   listAssessmentsForClub(clubId)— assessments at the host club with
//                                   player + assessor profile embeds
//                                   for the list page's grade-pill UI.
//
// Phase 12.5 / 12.5-4: `getAssessmentDetail` (single assessment +
// deliveries + rubric, used by the capture wizard / admin results
// view / new player results view) was extracted to
// `lib/t20/assessment-detail.ts` so the new player route at
// `app/(player)/(gated)/t20/[assessmentId]/page.tsx` can read the
// same data without duplicating the SQL or types. The shared types
// + function are re-exported below for back-compat with the four
// existing admin consumers.
//
// All consumers are server-side. Cancelled / finalized assessments
// are returned alongside in-progress ones; the UI distinguishes by
// `status`.

// Re-export shared assessment-detail types + fetcher from the
// extracted lib module (12.5-4).
export {
  type AssessmentDetail,
  type AssessmentDetailAssessment,
  type DeliveryRow,
  type DetailResult,
  type T20Notes,
  getAssessmentDetail,
} from "@/lib/t20/assessment-detail";

type DbAssessmentStatus = "draft" | "submitted" | "archived";
type DbT20Section = Database["public"]["Enums"]["t20_section"];
type DbT20Grade = Database["public"]["Enums"]["t20_grade"];

export type AssessmentListRow = {
  id: string;
  club_id: string;
  player_id: string;
  player_name: string | null;
  player_email: string | null;
  assessor_id: string;
  assessor_name: string | null;
  assessor_accreditation_id: string | null;
  assessed_on: string;
  green_type: string | null;
  green_speed: number | null;
  status: DbAssessmentStatus;
  /** UI-derived state. `in_progress` is `status='draft' AND any deliveries exist`. */
  ui_state: "draft" | "in_progress" | "completed";
  total_score: number;
  percentage: number;
  grade: DbT20Grade | null;
  rubric_version_id: string;
  rubric_version_label: string | null;
  second_marker_name: string | null;
};

export type ListResult =
  | { ok: true; clubId: string; clubName: string; rows: AssessmentListRow[] }
  | { ok: false; reason: "no-club" | "error"; error?: string };

export type RubricResult =
  | { ok: true; rubric: Rubric; versionId: string; versionLabel: string }
  | { ok: false; reason: "no-active" | "validation" | "error"; error?: string };

export type T20PersonRow = {
  profile_id: string;
  name: string | null;
  email: string | null;
  bsa_number: string | null;
  /** Last submitted assessment for this person (when they're being assessed),
   *  used by the New form's "Player history" sidebar. Null when first-time. */
  last_assessment: {
    id: string;
    assessed_on: string;
    grade: "gold" | "silver" | "bronze" | "fail" | null;
    percentage: number;
  } | null;
};

export type CandidatesResult =
  | { ok: true; clubId: string; clubName: string; rows: T20PersonRow[] }
  | { ok: false; reason: "no-club" | "error"; error?: string };

export async function getActiveRubric(): Promise<RubricResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("t20_rubric_versions")
    .select("id, version, rubric")
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("[t20] active rubric fetch failed:", error);
    return { ok: false, reason: "error", error: error.message };
  }
  if (!data) return { ok: false, reason: "no-active" };
  const parsed = RubricSchema.safeParse(data.rubric);
  if (!parsed.success) {
    console.error("[t20] active rubric failed schema validation:", parsed.error);
    return {
      ok: false,
      reason: "validation",
      error: "Active rubric does not match the v1 schema. Contact platform admin.",
    };
  }
  return {
    ok: true,
    rubric: parsed.data,
    versionId: data.id,
    versionLabel: data.version,
  };
}

export async function listAssessmentsForClub(): Promise<ListResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, reason: "no-club" };

  const club = await getCurrentHostClub();
  if (!club) return { ok: false, reason: "no-club" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("t20_assessments")
    .select(
      "id, club_id, profile_id, assessor_id, assessor_accreditation_id, assessed_on, green_type, green_speed, status, total_score, percentage, grade, rubric_version_id, second_marker_name, player:profiles!profile_id(first_name, last_name, display_name, email), assessor:profiles!assessor_id(first_name, last_name, display_name), rubric:t20_rubric_versions!rubric_version_id(version)",
    )
    .eq("club_id", club.club_id)
    .order("assessed_on", { ascending: false });

  if (error) {
    console.error("[t20] list assessments fetch failed:", error);
    return { ok: false, reason: "error", error: error.message };
  }

  const ids = (data ?? []).map((r) => r.id);
  const deliveryCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: deliv } = await supabase
      .from("t20_deliveries")
      .select("assessment_id")
      .in("assessment_id", ids);
    for (const d of deliv ?? []) {
      deliveryCounts[d.assessment_id] = (deliveryCounts[d.assessment_id] ?? 0) + 1;
    }
  }

  const rows: AssessmentListRow[] = (data ?? []).map((r) => {
    const player = r.player as
      | { first_name?: string | null; last_name?: string | null; display_name?: string | null; email?: string | null }
      | null;
    const assessor = r.assessor as
      | { first_name?: string | null; last_name?: string | null; display_name?: string | null }
      | null;
    const rubric = r.rubric as { version?: string } | null;
    const ui_state: AssessmentListRow["ui_state"] =
      r.status === "submitted" || r.status === "archived"
        ? "completed"
        : (deliveryCounts[r.id] ?? 0) > 0
          ? "in_progress"
          : "draft";
    return {
      id: r.id,
      club_id: r.club_id,
      player_id: r.profile_id,
      player_name: nameOf(player),
      player_email: player?.email ?? null,
      assessor_id: r.assessor_id,
      assessor_name: nameOf(assessor),
      assessor_accreditation_id: r.assessor_accreditation_id,
      assessed_on: r.assessed_on,
      green_type: r.green_type,
      green_speed: r.green_speed,
      status: r.status as DbAssessmentStatus,
      ui_state,
      total_score: Number(r.total_score),
      percentage: Number(r.percentage),
      grade: r.grade,
      rubric_version_id: r.rubric_version_id,
      rubric_version_label: rubric?.version ?? null,
      second_marker_name: r.second_marker_name,
    };
  });

  return { ok: true, clubId: club.club_id, clubName: club.club_name, rows };
}

// 12.5-4: getAssessmentDetail moved to `lib/t20/assessment-detail.ts`
// and re-exported at the top of this file. The block below is the
// admin _data layer's remaining helpers + the candidate-list fetcher.
//
// `nameOf` is shared with `listAssessmentsForClub` and
// `getT20CandidatesForClub` — kept here as a private helper.
//
// `parseNotes` moved to lib/t20/assessment-detail.ts (only consumer
// was getAssessmentDetail).

function nameOf(
  p: {
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null,
): string | null {
  if (!p) return null;
  if (p.display_name) return p.display_name;
  const composed = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return composed || null;
}

// Phase 10 / 10-5 — candidate-list fetcher for the New assessment
// form. Returns active club members with their most-recent submitted
// Twenty 20 assessment (when present) so the form's player-history
// sidebar can render without a second roundtrip.
//
// Two queries — one for memberships, one for the latest submitted
// assessments at the club — joined client-side. The assessments
// query is scoped to the club + status='submitted' so we don't
// surface in-progress drafts as "history."
//
// One pool serves both the player picker AND the assessor picker.
// The schema doesn't enforce a separate "is coach" role today; the
// accreditation ID field is free-text per migration 007 and the
// action's Zod regex is the gating layer. Future migration can split
// out an `assessor_accreditations` table if BSA-coach validation
// needs to be enforced server-side.
export async function getT20CandidatesForClub(): Promise<CandidatesResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, reason: "no-club" };

  const club = await getCurrentHostClub();
  if (!club) return { ok: false, reason: "no-club" };

  const supabase = await createClient();

  const [membersRes, assessmentsRes] = await Promise.all([
    supabase
      .from("club_memberships")
      .select(
        "profile:profiles!inner(id, first_name, last_name, display_name, email, bsa_number)",
      )
      .eq("club_id", club.club_id)
      .eq("status", "active"),
    supabase
      .from("t20_assessments")
      .select("id, profile_id, assessed_on, grade, percentage, submitted_at")
      .eq("club_id", club.club_id)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false }),
  ]);

  if (membersRes.error) {
    console.error("[t20] candidates fetch failed:", membersRes.error);
    return { ok: false, reason: "error", error: membersRes.error.message };
  }

  // Dedupe: latest-submitted assessment per profile_id.
  const lastByProfile = new Map<
    string,
    { id: string; assessed_on: string; grade: T20PersonRow["last_assessment"] extends infer T ? T extends null ? never : T extends { grade: infer G } ? G : never : never; percentage: number }
  >();
  for (const row of assessmentsRes.data ?? []) {
    if (!lastByProfile.has(row.profile_id)) {
      lastByProfile.set(row.profile_id, {
        id: row.id,
        assessed_on: row.assessed_on,
        grade: row.grade,
        percentage: Number(row.percentage),
      });
    }
  }

  const rows: T20PersonRow[] = (membersRes.data ?? []).map((m) => {
    const p = m.profile as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      display_name: string | null;
      email: string | null;
      bsa_number: string | null;
    };
    const last = lastByProfile.get(p.id);
    return {
      profile_id: p.id,
      name: nameOf(p),
      email: p.email,
      bsa_number: p.bsa_number,
      last_assessment: last
        ? {
            id: last.id,
            assessed_on: last.assessed_on,
            grade: last.grade,
            percentage: last.percentage,
          }
        : null,
    };
  });

  // Stable sort: name ASC (case-insensitive), nulls last.
  rows.sort((a, b) => {
    if (a.name === b.name) return 0;
    if (!a.name) return 1;
    if (!b.name) return -1;
    return a.name.localeCompare(b.name, "en-ZA", { sensitivity: "base" });
  });

  return { ok: true, clubId: club.club_id, clubName: club.club_name, rows };
}
