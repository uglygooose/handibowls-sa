"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/role";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { createClient } from "@/lib/supabase/server";
import {
  type Delivery,
  aggregateAssessment,
  scoreDelivery,
} from "@/lib/t20/score";
import {
  type LineOutcome,
  RubricSchema,
  SECTION_KEYS,
} from "@/lib/t20/rubric";

import type { CreateAssessmentFormState } from "./_form-state";

// Phase 10 — Twenty 20 server actions for the admin capture flow.
//
// Six club-admin actions, locked from the brief:
//
//   createAssessment    — sets up the row before capture begins.
//                         Picks the active rubric version, writes
//                         status='draft', returns the new id.
//   startCapture        — no-op flag in v1; reserved for the future
//                         "we're now actively capturing" transition
//                         (e.g. lock-out edits to setup fields).
//                         Returns the assessment row + active rubric.
//   recordDelivery      — upsert one delivery row. Computes points
//                         server-side using the scoring engine + the
//                         assessment's pinned rubric version. Per-
//                         delivery autosave from the capture wizard.
//   completeRound       — assertion that a (section, round) tuple is
//                         done. Returns the running subtotal.
//   finalizeAssessment  — recomputes grand totals + grade, writes to
//                         the assessment row, flips status='submitted'.
//   addSecondMarker     — attaches a second-marker name + accred to
//                         a finalized assessment.
//
// Pattern follows the Phase 9 conventions: Zod gating + typed Result
// discriminated unions + revalidatePath on success.

const ACCREDITATION_PATTERN = /^[A-Z0-9-]{4,32}$/i;

const createAssessmentSchema = z.object({
  player_id: z.string().uuid(),
  assessor_id: z.string().uuid(),
  assessor_accreditation_id: z
    .string()
    .trim()
    .regex(ACCREDITATION_PATTERN, "Accreditation ID must be 4-32 alphanumeric characters."),
  assessed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  green_type: z.enum(["outdoor", "indoor", "tarred"]).optional(),
  green_speed: z.number().min(8).max(20).nullable().optional(),
});

export type CreateAssessmentInput = z.input<typeof createAssessmentSchema>;
export type CreateAssessmentResult =
  | { kind: "ok"; assessmentId: string }
  | { kind: "no_club" }
  | { kind: "no_active_rubric" }
  | { kind: "validation"; error: string }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

export async function createAssessment(
  input: CreateAssessmentInput,
): Promise<CreateAssessmentResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };

  const club = await getCurrentHostClub();
  if (!club) return { kind: "no_club" };

  const parsed = createAssessmentSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "validation", error: firstZodError(parsed.error) };
  }

  const supabase = await createClient();
  const { data: rubric } = await supabase
    .from("t20_rubric_versions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!rubric) return { kind: "no_active_rubric" };

  const { data, error } = await supabase
    .from("t20_assessments")
    .insert({
      club_id: club.club_id,
      profile_id: parsed.data.player_id,
      assessor_id: parsed.data.assessor_id,
      assessor_accreditation_id: parsed.data.assessor_accreditation_id,
      assessed_on: parsed.data.assessed_on,
      green_type: parsed.data.green_type ?? null,
      green_speed: parsed.data.green_speed ?? null,
      rubric_version_id: rubric.id,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) {
    return { kind: "error", error: error?.message ?? "Insert failed" };
  }
  revalidatePath("/manage/t20", "page");
  return { kind: "ok", assessmentId: data.id };
}

const recordDeliverySchema = z
  .object({
    assessment_id: z.string().uuid(),
    section: z.enum([
      "jacks",
      "targets",
      "drive",
      "control",
      "trail",
      "speedhumps_asc",
      "speedhumps_desc",
    ]),
    round: z.number().int().min(1).max(2),
    delivery_index: z.number().int().min(1).max(8),
    distance_m: z.number().int().min(20).max(40).nullable(),
    hand: z.enum(["fore", "back"]).nullable(),
    distance_bucket: z.enum(["<10cm", "10-30cm", "30cm+"]).nullable().optional(),
    outcome: z.union([
      z.object({
        kind: z.literal("line_outcome"),
        line: z.enum(["on_line", "narrow", "wide"]),
      }),
      z.object({ kind: z.literal("zones_8"), zone: z.union([z.number().int().min(1).max(8), z.literal("miss")]) }),
      z.object({ kind: z.literal("on_length"), on_length: z.boolean() }),
    ]),
  })
  .strict();

export type RecordDeliveryInput = z.input<typeof recordDeliverySchema>;
export type RecordDeliveryResult =
  | { kind: "ok"; deliveryId: string; points: number }
  | { kind: "rubric_section_mismatch" }
  | { kind: "validation"; error: string }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

export async function recordDelivery(
  input: RecordDeliveryInput,
): Promise<RecordDeliveryResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };
  const parsed = recordDeliverySchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "validation", error: firstZodError(parsed.error) };
  }
  const supabase = await createClient();

  const { data: a, error: aErr } = await supabase
    .from("t20_assessments")
    .select("id, rubric:t20_rubric_versions!rubric_version_id(rubric)")
    .eq("id", parsed.data.assessment_id)
    .maybeSingle();
  if (aErr || !a) {
    return { kind: "error", error: aErr?.message ?? "Assessment not found" };
  }
  const rubricRow = a.rubric as { rubric?: unknown } | null;
  const rubricParsed = RubricSchema.safeParse(rubricRow?.rubric);
  if (!rubricParsed.success) {
    return { kind: "error", error: "Rubric not loadable for this assessment." };
  }
  const rubric = rubricParsed.data;
  const expectedModel = rubric.sections[parsed.data.section].model;
  const got = parsed.data.outcome.kind;
  if (
    (expectedModel === "line_outcome" && got !== "line_outcome") ||
    (expectedModel === "zones_8" && got !== "zones_8") ||
    (expectedModel === "on_length" && got !== "on_length")
  ) {
    return { kind: "rubric_section_mismatch" };
  }

  const delivery: Delivery =
    got === "line_outcome"
      ? {
          section: parsed.data.section as "jacks" | "targets",
          round: parsed.data.round as 1 | 2,
          delivery_index: parsed.data.delivery_index,
          distance_m: parsed.data.distance_m,
          outcome: {
            section_model: "line_outcome",
            value: parsed.data.outcome.line as LineOutcome,
          },
        }
      : got === "zones_8"
        ? {
            section: parsed.data.section as "drive" | "control" | "trail",
            round: parsed.data.round as 1 | 2,
            delivery_index: parsed.data.delivery_index,
            distance_m: parsed.data.distance_m,
            outcome: {
              section_model: "zones_8",
              value: parsed.data.outcome.zone === "miss"
                ? "miss"
                : (parsed.data.outcome.zone as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8),
            },
          }
        : {
            section: parsed.data.section as
              | "speedhumps_asc"
              | "speedhumps_desc",
            round: parsed.data.round as 1 | 2,
            delivery_index: parsed.data.delivery_index,
            distance_m: parsed.data.distance_m,
            outcome: {
              section_model: "on_length",
              value: parsed.data.outcome.on_length,
            },
          };

  const points = scoreDelivery(rubric, delivery);

  const outcomePayload =
    got === "line_outcome"
      ? { line: parsed.data.outcome.line }
      : got === "zones_8"
        ? { zone: parsed.data.outcome.zone }
        : { on_length: parsed.data.outcome.on_length };

  const { data: existing } = await supabase
    .from("t20_deliveries")
    .select("id")
    .eq("assessment_id", parsed.data.assessment_id)
    .eq("section", parsed.data.section)
    .eq("round", parsed.data.round)
    .eq("delivery_index", parsed.data.delivery_index)
    .eq("distance_m", parsed.data.distance_m ?? -1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("t20_deliveries")
      .update({
        outcome: outcomePayload,
        hand: parsed.data.hand,
        distance_bucket: parsed.data.distance_bucket ?? null,
        points,
      })
      .eq("id", existing.id);
    if (error) return { kind: "error", error: error.message };
    return { kind: "ok", deliveryId: existing.id, points };
  }
  const { data: ins, error: insErr } = await supabase
    .from("t20_deliveries")
    .insert({
      assessment_id: parsed.data.assessment_id,
      section: parsed.data.section,
      round: parsed.data.round,
      delivery_index: parsed.data.delivery_index,
      distance_m: parsed.data.distance_m,
      hand: parsed.data.hand,
      distance_bucket: parsed.data.distance_bucket ?? null,
      outcome: outcomePayload,
      points,
    })
    .select("id")
    .single();
  if (insErr || !ins) {
    return { kind: "error", error: insErr?.message ?? "Insert failed" };
  }
  return { kind: "ok", deliveryId: ins.id, points };
}

const completeRoundSchema = z.object({
  assessment_id: z.string().uuid(),
  section: z.enum([
    "jacks",
    "targets",
    "drive",
    "control",
    "trail",
    "speedhumps_asc",
    "speedhumps_desc",
  ]),
  round: z.number().int().min(1).max(2),
});

export type CompleteRoundInput = z.input<typeof completeRoundSchema>;
export type CompleteRoundResult =
  | { kind: "ok"; sectionRoundEarned: number; sectionEarned: number }
  | { kind: "validation"; error: string }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

export async function completeRound(
  input: CompleteRoundInput,
): Promise<CompleteRoundResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };
  const parsed = completeRoundSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "validation", error: firstZodError(parsed.error) };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("t20_deliveries")
    .select("section, round, points")
    .eq("assessment_id", parsed.data.assessment_id)
    .eq("section", parsed.data.section);
  if (error) return { kind: "error", error: error.message };

  const sectionEarned = (data ?? []).reduce(
    (s, r) => s + Number(r.points ?? 0),
    0,
  );
  const sectionRoundEarned = (data ?? [])
    .filter((r) => r.round === parsed.data.round)
    .reduce((s, r) => s + Number(r.points ?? 0), 0);
  return { kind: "ok", sectionRoundEarned, sectionEarned };
}

// 12-4 hotfix: notes shape aligned with migration 041's jsonb column
// + editAssessmentNotesSchema (defined later in this file). The
// previous `z.string().optional()` was a pre-migration leftover —
// any caller passing notes-as-string would hit the
// t20_assessments_notes_shape CHECK constraint at SQL time. The
// wizard never exercises this path today, but the type mismatch
// is a real latent bug.
const finalizeSchema = z.object({
  assessment_id: z.string().uuid(),
  notes: z
    .object({
      strengths: z.string().max(2500).optional(),
      watch: z.string().max(2500).optional(),
      focus: z.string().max(2500).optional(),
      legacy: z.string().max(2500).optional(),
    })
    .optional(),
});

export type FinalizeAssessmentInput = z.input<typeof finalizeSchema>;
export type FinalizeAssessmentResult =
  | {
      kind: "ok";
      total_score: number;
      percentage: number;
      grade: "gold" | "silver" | "bronze" | "fail";
    }
  | { kind: "no_deliveries" }
  | { kind: "validation"; error: string }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

export async function finalizeAssessment(
  input: FinalizeAssessmentInput,
): Promise<FinalizeAssessmentResult> {
  // ====== TEMPORARY DIAGNOSTIC LOGGING — Phase 12 / 12-4 hotfix =====
  // Captures the root cause of the live finalize failure surfaced
  // during 12-4 manual QA. Every error-returning branch logs a tagged
  // line so the dev server console shows exactly where the action
  // bails. REVERT after the fix lands.
  const dlog = (where: string, payload: unknown) =>
    console.error(`[t20.finalize:${where}]`, payload);
  // ==================================================================

  const ctx = await getAuthContext();
  if (!ctx) {
    dlog("auth", { reason: "no auth context", input });
    return { kind: "auth", error: "Not authenticated" };
  }
  const parsed = finalizeSchema.safeParse(input);
  if (!parsed.success) {
    dlog("validation", {
      issues: parsed.error.issues,
      input,
    });
    return { kind: "validation", error: firstZodError(parsed.error) };
  }
  const supabase = await createClient();

  const { data: a, error: aErr } = await supabase
    .from("t20_assessments")
    .select("id, rubric:t20_rubric_versions!rubric_version_id(rubric)")
    .eq("id", parsed.data.assessment_id)
    .maybeSingle();
  if (aErr || !a) {
    dlog("assessment_fetch", {
      reason: aErr ? "supabase error" : "no row (RLS-denied or missing)",
      aErr,
      assessment_id: parsed.data.assessment_id,
      ctx_userId: ctx.userId,
      ctx_role: ctx.role,
    });
    return { kind: "error", error: aErr?.message ?? "Assessment not found" };
  }

  const rubricRow = a.rubric as { rubric?: unknown } | null;
  const rubricParsed = RubricSchema.safeParse(rubricRow?.rubric);
  if (!rubricParsed.success) {
    dlog("rubric_parse", {
      issues: rubricParsed.error.issues,
      rubricRow_present: rubricRow != null,
      rubric_present: rubricRow?.rubric != null,
      rubric_typeof: typeof rubricRow?.rubric,
    });
    return { kind: "error", error: "Rubric not loadable for this assessment." };
  }
  const rubric = rubricParsed.data;

  const { data: rows, error: rowsErr } = await supabase
    .from("t20_deliveries")
    .select("section, round, delivery_index, distance_m, outcome, hand")
    .eq("assessment_id", parsed.data.assessment_id);
  if (rowsErr) {
    dlog("deliveries_fetch", {
      rowsErr,
      assessment_id: parsed.data.assessment_id,
    });
    // Drop through to no_deliveries / process so the existing return
    // shape stays stable; the log captures the cause.
  }
  if (!rows || rows.length === 0) {
    dlog("no_deliveries", {
      rowsErr,
      rows_value: rows,
      rows_length: rows?.length ?? null,
      assessment_id: parsed.data.assessment_id,
    });
    return { kind: "no_deliveries" };
  }

  const deliveries: Delivery[] = rows.map((r) => {
    const outcome = (r.outcome ?? {}) as Record<string, unknown>;
    if (SECTION_KEYS.indexOf(r.section as never) >= 0 && r.section in rubric.sections) {
      const model = rubric.sections[r.section as keyof typeof rubric.sections].model;
      if (model === "line_outcome") {
        return {
          section: r.section,
          round: r.round as 1 | 2,
          delivery_index: r.delivery_index,
          distance_m: r.distance_m,
          outcome: {
            section_model: "line_outcome",
            value: (outcome.line ?? null) as LineOutcome | null,
          },
        };
      }
      if (model === "zones_8") {
        const z = outcome.zone;
        return {
          section: r.section,
          round: r.round as 1 | 2,
          delivery_index: r.delivery_index,
          distance_m: r.distance_m,
          outcome: {
            section_model: "zones_8",
            value:
              z === "miss"
                ? "miss"
                : typeof z === "number"
                  ? (z as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
                  : null,
          },
        };
      }
      return {
        section: r.section,
        round: r.round as 1 | 2,
        delivery_index: r.delivery_index,
        distance_m: r.distance_m,
        outcome: {
          section_model: "on_length",
          value: typeof outcome.on_length === "boolean" ? outcome.on_length : null,
        },
      };
    }
    // Fallback — shouldn't happen because section is enum-constrained.
    return {
      section: r.section,
      round: r.round as 1 | 2,
      delivery_index: r.delivery_index,
      distance_m: r.distance_m,
      outcome: { section_model: "line_outcome", value: null },
    };
  });

  const result = aggregateAssessment(rubric, deliveries);

  const updatePayload = {
    total_score: result.earned,
    percentage: Number(result.percentage.toFixed(2)),
    grade: result.grade,
    status: "submitted",
    submitted_at: new Date().toISOString(),
    notes: parsed.data.notes ?? null,
  };
  dlog("update_attempt", {
    assessment_id: parsed.data.assessment_id,
    payload: updatePayload,
    notes_typeof: typeof updatePayload.notes,
  });

  const { error: upErr, data: upData, count: upCount } = await supabase
    .from("t20_assessments")
    .update(updatePayload)
    .eq("id", parsed.data.assessment_id)
    .select("id, status, percentage, grade, submitted_at");
  if (upErr) {
    dlog("update_error", {
      upErr,
      // Postgres-level details if PostgREST surfaced them
      code: (upErr as { code?: string }).code ?? null,
      details: (upErr as { details?: string }).details ?? null,
      hint: (upErr as { hint?: string }).hint ?? null,
      message: upErr.message,
      payload: updatePayload,
    });
    return { kind: "error", error: upErr.message };
  }
  if (!upData || upData.length === 0) {
    // Silent RLS denial — UPDATE matched no rows. Surface as error
    // so the wizard's "Save failed" state actually fires (otherwise
    // we'd return ok and the user would see no progress).
    dlog("update_silent_rls", {
      upData,
      upCount,
      assessment_id: parsed.data.assessment_id,
      ctx_userId: ctx.userId,
      ctx_role: ctx.role,
      ctx_clubIds: ctx.clubIds,
    });
    return {
      kind: "error",
      error:
        "UPDATE matched no rows — likely RLS denial. Verify your club admin assignment is current.",
    };
  }

  revalidatePath("/manage/t20", "page");
  revalidatePath(`/manage/t20/${parsed.data.assessment_id}`, "page");
  return {
    kind: "ok",
    total_score: result.earned,
    percentage: result.percentage,
    grade: result.grade,
  };
}

const addSecondMarkerSchema = z.object({
  assessment_id: z.string().uuid(),
  marker_name: z.string().trim().min(1).max(120),
  marker_accreditation_id: z
    .string()
    .trim()
    .regex(ACCREDITATION_PATTERN, "Accreditation ID must be 4-32 alphanumeric characters."),
});

export type AddSecondMarkerInput = z.input<typeof addSecondMarkerSchema>;
export type AddSecondMarkerResult =
  | { kind: "ok" }
  | { kind: "validation"; error: string }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

export async function addSecondMarker(
  input: AddSecondMarkerInput,
): Promise<AddSecondMarkerResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };
  const parsed = addSecondMarkerSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "validation", error: firstZodError(parsed.error) };
  }
  const supabase = await createClient();
  // The schema column is `second_marker_name` (text). Per Phase 10
  // brief, accreditation ID for the second marker is captured but not
  // a column today — embedded in the name field as "Name · ACCRED"
  // pending a v2 schema split. Flagged for follow-up.
  const composed = `${parsed.data.marker_name} · ${parsed.data.marker_accreditation_id}`;
  const { error } = await supabase
    .from("t20_assessments")
    .update({ second_marker_name: composed })
    .eq("id", parsed.data.assessment_id);
  if (error) return { kind: "error", error: error.message };
  revalidatePath(`/manage/t20/${parsed.data.assessment_id}`, "page");
  return { kind: "ok" };
}

// startCapture is a placeholder for the future "now actively
// capturing" flag — v1 has no such state, so this resolves to a
// validation pass + the active-rubric handoff that the capture
// wizard needs.
const startCaptureSchema = z.object({
  assessment_id: z.string().uuid(),
});

export type StartCaptureInput = z.input<typeof startCaptureSchema>;
export type StartCaptureResult =
  | { kind: "ok"; rubricVersionLabel: string }
  | { kind: "not_found" }
  | { kind: "validation"; error: string }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

export async function startCapture(
  input: StartCaptureInput,
): Promise<StartCaptureResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };
  const parsed = startCaptureSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "validation", error: firstZodError(parsed.error) };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("t20_assessments")
    .select("rubric:t20_rubric_versions!rubric_version_id(version)")
    .eq("id", parsed.data.assessment_id)
    .maybeSingle();
  if (error) return { kind: "error", error: error.message };
  if (!data) return { kind: "not_found" };
  const rubric = data.rubric as { version?: string } | null;
  return { kind: "ok", rubricVersionLabel: rubric?.version ?? "unknown" };
}

function firstZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue?.message ?? "Invalid input";
}

// Phase 10 / 10-5 — useActionState wrapper for the New form.
//
// Bridges the form-data world (HTML form inputs) and the structured
// `createAssessment` input shape. Returns a typed FormState the
// Client form can render directly:
//
//   ok                → never reached by the caller — we redirect()
//                       inline to /manage/t20/<id>/capture so the
//                       form submission flow ends on the capture
//                       wizard.
//   any other kind    → returned as-is for the Client form to surface.
//
// The redirect happens BEFORE the return so the success path never
// hits the form's render. Next 16's `redirect()` throws an internal
// signal — useActionState handles it transparently.

export async function createAssessmentFromForm(
  _prev: CreateAssessmentFormState,
  formData: FormData,
): Promise<CreateAssessmentFormState> {
  const player_id = String(formData.get("player_id") ?? "");
  const assessor_id = String(formData.get("assessor_id") ?? "");
  const assessor_accreditation_id = String(
    formData.get("assessor_accreditation_id") ?? "",
  );
  const assessed_on = String(formData.get("assessed_on") ?? "");
  const greenTypeRaw = String(formData.get("green_type") ?? "");
  const green_type =
    greenTypeRaw === "outdoor" ||
    greenTypeRaw === "indoor" ||
    greenTypeRaw === "tarred"
      ? (greenTypeRaw as "outdoor" | "indoor" | "tarred")
      : undefined;
  const greenSpeedRaw = String(formData.get("green_speed") ?? "").trim();
  let green_speed: number | null | undefined;
  if (greenSpeedRaw === "") {
    green_speed = null;
  } else {
    const n = Number(greenSpeedRaw);
    if (!Number.isFinite(n)) {
      return {
        kind: "validation",
        error: "Green speed must be a number (e.g. 13.2).",
      };
    }
    green_speed = n;
  }

  const result = await createAssessment({
    player_id,
    assessor_id,
    assessor_accreditation_id,
    assessed_on,
    green_type,
    green_speed,
  });

  if (result.kind === "ok") {
    redirect(`/manage/t20/${result.assessmentId}/capture`);
  }

  // Optional second-marker fields land separately via addSecondMarker
  // because the schema requires the assessment to exist first. The
  // form submits both in one go; we capture them client-side and
  // dispatch the second action after redirect rehydration. For v1
  // we only persist the primary fields here — second-marker plumbing
  // wires through 10-7 results view's `Add second marker` flow.
  return result;
}

// Phase 10 / 10-7 — placeholder PDF export action.
//
// The results view ships a visible Export PDF button (per design
// source) that's wired to this action. The actual PDF template +
// renderer is a separate Claude Design follow-up — until that
// lands, this returns kind='pending' so the UI can surface a
// "PDF generation pending" toast without throwing.
//
// When the template ships:
//   1. Replace the body with a real renderer call (e.g. @react-pdf
//      or a server endpoint that streams the PDF).
//   2. Persist the resulting URL to t20_assessments.pdf_url so
//      future "Download PDF" clicks short-circuit to the cached
//      file.
//   3. Update the result kinds to surface a download URL on success.

export type RequestPdfExportInput = { assessment_id: string };
export type RequestPdfExportResult =
  | { kind: "pending"; reason: "template_not_ready" }
  | { kind: "auth"; error: string }
  | { kind: "validation"; error: string };

const requestPdfExportSchema = z.object({
  assessment_id: z.string().uuid(),
});

export async function requestPdfExport(
  input: RequestPdfExportInput,
): Promise<RequestPdfExportResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };
  const parsed = requestPdfExportSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "validation", error: firstZodError(parsed.error) };
  }
  // No-op until the PDF template ships. Surface a typed pending so
  // the UI knows the action was reachable but the work is deferred.
  return { kind: "pending", reason: "template_not_ready" };
}

// ---------------------------------------------------------------------
// 12-4 / M2 + N8 — editAssessmentNotes (categorised)
// ---------------------------------------------------------------------
//
// Coach-side write path for `t20_assessments.notes`. Migration 041
// reshaped the column to jsonb with optional keys (strengths /
// watch / focus / legacy). Authorization flows through RLS (migration
// 010 ships t20_assessments_club_admin_rw + t20_assessments_assessor_rw)
// so the host club's admins AND the assessor who created the row
// can update. We don't re-check ownership here; RLS rejects foreign
// rows with a 42501 surfaced as result.kind='forbidden' below.
//
// Each category is free-text up to 2500 chars. Empty string per
// category is stored as the key absent from the jsonb (sparse).
// All categories empty → notes set to NULL so the read-side empty
// state renders cleanly. The 'legacy' key is read-only from the UI
// but the action accepts it via the schema for completeness — the
// UI never submits it.

const NOTES_CATEGORY_MAX = 2500;

const editAssessmentNotesSchema = z.object({
  assessment_id: z.string().uuid(),
  notes: z
    .object({
      strengths: z.string().max(NOTES_CATEGORY_MAX).optional(),
      watch: z.string().max(NOTES_CATEGORY_MAX).optional(),
      focus: z.string().max(NOTES_CATEGORY_MAX).optional(),
      legacy: z.string().max(NOTES_CATEGORY_MAX).optional(),
    })
    .optional(),
});

export type T20NotesInput = z.input<typeof editAssessmentNotesSchema>["notes"];
export type EditAssessmentNotesInput = z.input<typeof editAssessmentNotesSchema>;
export type EditAssessmentNotesResult =
  | { kind: "ok"; notes: T20NotesInput | null }
  | { kind: "auth"; error: string }
  | { kind: "validation"; error: string }
  | { kind: "not_found" }
  | { kind: "forbidden"; error: string }
  | { kind: "error"; error: string };

export async function editAssessmentNotes(
  input: EditAssessmentNotesInput,
): Promise<EditAssessmentNotesResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };

  const parsed = editAssessmentNotesSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "validation", error: firstZodError(parsed.error) };
  }

  // Build the persist value: trim each category, drop empty strings,
  // collapse to NULL when no category remains. Sparse object means
  // category-absent === "no notes for that category."
  const incoming = parsed.data.notes ?? {};
  const cleaned: Record<string, string> = {};
  for (const k of ["strengths", "watch", "focus", "legacy"] as const) {
    const v = incoming[k];
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length > 0) cleaned[k] = trimmed;
    }
  }
  const persistValue: Record<string, string> | null =
    Object.keys(cleaned).length > 0 ? cleaned : null;

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("t20_assessments")
    .update({ notes: persistValue, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.assessment_id)
    .select("id, notes")
    .single();

  if (error) {
    if (error.code === "PGRST116" || /Row Level Security|RLS/i.test(error.message)) {
      return { kind: "forbidden", error: "Not authorized to edit this assessment." };
    }
    return { kind: "error", error: error.message };
  }
  if (!data) return { kind: "not_found" };

  revalidatePath("/manage/t20");
  revalidatePath(`/manage/t20/${parsed.data.assessment_id}`);
  return {
    kind: "ok",
    notes: data.notes as T20NotesInput | null,
  };
}
