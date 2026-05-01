import "server-only";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import {
  type Rubric,
  RubricSchema,
} from "@/lib/t20/rubric";
import type { Database } from "@/types/database.types";

// Phase 12.5 / 12.5-4: shared assessment-detail data layer.
//
// Extracted from `app/(club-admin)/manage/t20/_data.ts` so the new
// player route at `app/(player)/(gated)/t20/[assessmentId]/page.tsx`
// can read the same data without duplicating the SQL or the type
// shape. Both the admin and player consumers call `getAssessmentDetail`
// directly; RLS gates which rows are visible per the caller's session
// (`t20_assessments_subject_read` / `t20_assessments_assessor_rw` /
// `t20_assessments_club_admin_rw` from migration 010 — pinned by
// `tests/rls/t20.test.ts:27-48`).
//
// The admin `_data.ts` re-exports every public symbol below for
// back-compat with the four existing consumers
// (AssessmentResults / CaptureWizard / capture page / detail page).

type DbAssessmentStatus = "draft" | "submitted" | "archived";
type DbT20Section = Database["public"]["Enums"]["t20_section"];
type DbT20Grade = Database["public"]["Enums"]["t20_grade"];

export type DeliveryRow = {
  id: string;
  assessment_id: string;
  section: DbT20Section;
  round: number;
  delivery_index: number;
  distance_m: number | null;
  hand: "fore" | "back" | null;
  outcome: Record<string, unknown>;
  points: number;
  distance_bucket: "<10cm" | "10-30cm" | "30cm+" | null;
};

/** 12-4 / N8: coach-categorised notes (migration 041). The jsonb
 *  column carries any subset of these keys; the UI renders one
 *  tile per known category. NULL = no notes captured. */
export type T20Notes = {
  strengths?: string;
  watch?: string;
  focus?: string;
  /** Reserved for future imports of pre-12-4 uncategorised notes —
   *  surfaces as a read-only tile in the UI when present. */
  legacy?: string;
};

/** Full row carried by `<AssessmentDetail['assessment']>`. Same field
 *  set the existing admin list-row exposes plus detail-only fields
 *  (notes, pdf_url, submitted_at). Stand-alone type so the player
 *  + admin routes can both read it without inheriting list-page
 *  concerns. */
export type AssessmentDetailAssessment = {
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
  notes: T20Notes | null;
  pdf_url: string | null;
  submitted_at: string | null;
};

export type AssessmentDetail = {
  assessment: AssessmentDetailAssessment;
  deliveries: DeliveryRow[];
  rubric: Rubric;
};

export type DetailResult =
  | { ok: true; data: AssessmentDetail }
  | { ok: false; reason: "not-found" | "no-club" | "error"; error?: string };

export async function getAssessmentDetail(
  id: string,
): Promise<DetailResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, reason: "no-club" };

  const supabase = await createClient();
  const { data: a, error: aErr } = await supabase
    .from("t20_assessments")
    .select(
      "id, club_id, profile_id, assessor_id, assessor_accreditation_id, assessed_on, green_type, green_speed, status, total_score, percentage, grade, rubric_version_id, second_marker_name, notes, pdf_url, submitted_at, player:profiles!profile_id(first_name, last_name, display_name, email), assessor:profiles!assessor_id(first_name, last_name, display_name), rubric:t20_rubric_versions!rubric_version_id(version, rubric)",
    )
    .eq("id", id)
    .maybeSingle();
  if (aErr) {
    console.error("[t20] assessment detail fetch failed:", aErr);
    return { ok: false, reason: "error", error: aErr.message };
  }
  if (!a) return { ok: false, reason: "not-found" };

  const rubricRow = a.rubric as { version?: string; rubric?: unknown } | null;
  const rubricParsed = RubricSchema.safeParse(rubricRow?.rubric);
  if (!rubricParsed.success) {
    console.error("[t20] rubric attached to assessment failed schema validation");
    return {
      ok: false,
      reason: "error",
      error: "Rubric attached to assessment is not valid v1 shape.",
    };
  }

  const { data: deliveries, error: dErr } = await supabase
    .from("t20_deliveries")
    .select(
      "id, assessment_id, section, round, delivery_index, distance_m, hand, outcome, points, distance_bucket",
    )
    .eq("assessment_id", id)
    .order("section", { ascending: true })
    .order("round", { ascending: true })
    .order("distance_m", { ascending: true })
    .order("delivery_index", { ascending: true });
  if (dErr) {
    console.error("[t20] deliveries fetch failed:", dErr);
    return { ok: false, reason: "error", error: dErr.message };
  }

  const player = a.player as
    | { first_name?: string | null; last_name?: string | null; display_name?: string | null; email?: string | null }
    | null;
  const assessor = a.assessor as
    | { first_name?: string | null; last_name?: string | null; display_name?: string | null }
    | null;

  const ui_state: AssessmentDetailAssessment["ui_state"] =
    a.status === "submitted" || a.status === "archived"
      ? "completed"
      : (deliveries ?? []).length > 0
        ? "in_progress"
        : "draft";

  const rows: DeliveryRow[] = (deliveries ?? []).map((d) => ({
    id: d.id,
    assessment_id: d.assessment_id,
    section: d.section,
    round: d.round,
    delivery_index: d.delivery_index,
    distance_m: d.distance_m,
    hand: d.hand as DeliveryRow["hand"],
    outcome: (d.outcome ?? {}) as Record<string, unknown>,
    points: Number(d.points),
    distance_bucket: d.distance_bucket as DeliveryRow["distance_bucket"],
  }));

  return {
    ok: true,
    data: {
      assessment: {
        id: a.id,
        club_id: a.club_id,
        player_id: a.profile_id,
        player_name: nameOf(player),
        player_email: player?.email ?? null,
        assessor_id: a.assessor_id,
        assessor_name: nameOf(assessor),
        assessor_accreditation_id: a.assessor_accreditation_id,
        assessed_on: a.assessed_on,
        green_type: a.green_type,
        green_speed: a.green_speed,
        status: a.status as DbAssessmentStatus,
        ui_state,
        total_score: Number(a.total_score),
        percentage: Number(a.percentage),
        grade: a.grade,
        rubric_version_id: a.rubric_version_id,
        rubric_version_label: rubricRow?.version ?? null,
        second_marker_name: a.second_marker_name,
        notes: parseNotes(a.notes),
        pdf_url: a.pdf_url,
        submitted_at: a.submitted_at,
      },
      deliveries: rows,
      rubric: rubricParsed.data,
    },
  };
}

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

/** 12-4 / N8: parse jsonb notes into the typed T20Notes shape.
 *  PostgREST returns jsonb columns as JS objects; the CHECK
 *  constraint t20_assessments_notes_shape pins keys to a known
 *  subset, so a defensive read here just narrows + guards against
 *  non-object values. */
function parseNotes(raw: unknown): T20Notes | null {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const result: T20Notes = {};
  if (typeof obj.strengths === "string" && obj.strengths.length > 0) {
    result.strengths = obj.strengths;
  }
  if (typeof obj.watch === "string" && obj.watch.length > 0) {
    result.watch = obj.watch;
  }
  if (typeof obj.focus === "string" && obj.focus.length > 0) {
    result.focus = obj.focus;
  }
  if (typeof obj.legacy === "string" && obj.legacy.length > 0) {
    result.legacy = obj.legacy;
  }
  return Object.keys(result).length > 0 ? result : null;
}
