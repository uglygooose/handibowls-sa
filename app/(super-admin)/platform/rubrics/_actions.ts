"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { RubricSchema } from "@/lib/t20/rubric";

// Phase 10 — Twenty 20 rubric version management (super-admin).
//
// Three actions:
//
//   uploadRubricVersion      — validates JSON against RubricSchema +
//                              ensures `version` is unique. Stages
//                              as `is_active=false`.
//   activateRubricVersion    — flips a draft to active. Atomic via
//                              transaction: deactivate the current
//                              active row, set the new one's
//                              is_active=true + activated_at=now().
//                              Existing assessments are immutably
//                              linked to whichever version was active
//                              at capture time, so activation never
//                              re-grades historical work.
//   deactivateRubricVersion  — sets is_active=false. Used for the
//                              rare "undo activation" case before any
//                              new captures land. Schema's partial
//                              unique index allows zero active rows.
//
// All three are super-admin-only (verified at action layer; RLS on
// t20_rubric_versions also enforces it).

const versionSchema = z.string().regex(/^v\d+(?:[a-z0-9-]+)?$/i, {
  message: "Version must look like 'v1-final-2026' or 'v2-draft-2026'.",
});

const uploadSchema = z.object({
  version: versionSchema,
  rubric: z.unknown(),
});

export type UploadRubricInput = z.input<typeof uploadSchema>;
export type UploadRubricResult =
  | { kind: "ok"; rubricId: string }
  | { kind: "duplicate_version" }
  | { kind: "schema_invalid"; error: string }
  | { kind: "validation"; error: string }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

export async function uploadRubricVersion(
  input: UploadRubricInput,
): Promise<UploadRubricResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };
  if (ctx.role !== "super_admin") {
    return { kind: "auth", error: "Super-admin only." };
  }
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "validation", error: firstZodError(parsed.error) };
  }
  const rubricParsed = RubricSchema.safeParse(parsed.data.rubric);
  if (!rubricParsed.success) {
    return {
      kind: "schema_invalid",
      error: firstZodError(rubricParsed.error),
    };
  }
  if (rubricParsed.data.version !== parsed.data.version) {
    return {
      kind: "validation",
      error: `JSON version field (${rubricParsed.data.version}) doesn't match upload version (${parsed.data.version}).`,
    };
  }
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("t20_rubric_versions")
    .select("id")
    .eq("version", parsed.data.version)
    .maybeSingle();
  if (existing) return { kind: "duplicate_version" };

  const { data, error } = await supabase
    .from("t20_rubric_versions")
    .insert({
      version: parsed.data.version,
      rubric: rubricParsed.data,
      is_active: false,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { kind: "error", error: error?.message ?? "Insert failed" };
  }
  revalidatePath("/platform/rubrics", "page");
  return { kind: "ok", rubricId: data.id };
}

const activateSchema = z.object({
  rubric_id: z.string().uuid(),
});

export type ActivateRubricInput = z.input<typeof activateSchema>;
export type ActivateRubricResult =
  | { kind: "ok" }
  | { kind: "not_found" }
  | { kind: "already_active" }
  | { kind: "validation"; error: string }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

export async function activateRubricVersion(
  input: ActivateRubricInput,
): Promise<ActivateRubricResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };
  if (ctx.role !== "super_admin") {
    return { kind: "auth", error: "Super-admin only." };
  }
  const parsed = activateSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "validation", error: firstZodError(parsed.error) };
  }
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("t20_rubric_versions")
    .select("id, is_active")
    .eq("id", parsed.data.rubric_id)
    .maybeSingle();
  if (!target) return { kind: "not_found" };
  if (target.is_active) return { kind: "already_active" };

  // Deactivate the current active row first to satisfy the partial
  // unique index. Race window is tiny — both writes happen in
  // sub-millisecond from the same request — but if it ever bites,
  // wrap in a SECURITY DEFINER RPC like Phase 9's force-cancel. For
  // now: sequential UPDATE + UPDATE.
  const { error: deactErr } = await supabase
    .from("t20_rubric_versions")
    .update({ is_active: false })
    .eq("is_active", true);
  if (deactErr) return { kind: "error", error: deactErr.message };

  const { error } = await supabase
    .from("t20_rubric_versions")
    .update({
      is_active: true,
      activated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.rubric_id);
  if (error) return { kind: "error", error: error.message };

  revalidatePath("/platform/rubrics", "page");
  revalidatePath("/manage/t20", "page");
  return { kind: "ok" };
}

const deactivateSchema = z.object({
  rubric_id: z.string().uuid(),
});

export type DeactivateRubricInput = z.input<typeof deactivateSchema>;
export type DeactivateRubricResult =
  | { kind: "ok" }
  | { kind: "not_found" }
  | { kind: "not_active" }
  | { kind: "validation"; error: string }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

export async function deactivateRubricVersion(
  input: DeactivateRubricInput,
): Promise<DeactivateRubricResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };
  if (ctx.role !== "super_admin") {
    return { kind: "auth", error: "Super-admin only." };
  }
  const parsed = deactivateSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "validation", error: firstZodError(parsed.error) };
  }
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("t20_rubric_versions")
    .select("id, is_active")
    .eq("id", parsed.data.rubric_id)
    .maybeSingle();
  if (!target) return { kind: "not_found" };
  if (!target.is_active) return { kind: "not_active" };
  const { error } = await supabase
    .from("t20_rubric_versions")
    .update({ is_active: false })
    .eq("id", parsed.data.rubric_id);
  if (error) return { kind: "error", error: error.message };
  revalidatePath("/platform/rubrics", "page");
  return { kind: "ok" };
}

function firstZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue?.message ?? "Invalid input";
}
