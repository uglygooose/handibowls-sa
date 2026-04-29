import "server-only";

import { type Rubric, RubricSchema } from "@/lib/t20/rubric";
import { createClient } from "@/lib/supabase/server";

// Phase 10 / 10-8 — `/platform/rubrics` data layer.
//
// One fetcher: `listRubricVersions()` — every t20_rubric_versions row
// joined with the creator profile + assessment-count aggregate, sorted
// newest first.
//
// Status presentation
//
//   The schema carries a single `is_active` boolean (migration 007 +
//   the partial unique index `t20_rubric_versions_one_active`). The
//   design source's three statuses — active / draft / archived — map
//   onto the boolean as follows:
//
//     active   ← is_active = true
//     draft    ← is_active = false AND no assessments reference it
//     archived ← is_active = false AND ≥ 1 assessment references it
//
//   Rationale: a never-activated rubric is structurally a draft;
//   one that's been used and superseded is archived. The mapping
//   stays presentation-only — the engine doesn't care about the
//   distinction.
//
// Captures locked
//
//   The `assessmentCount` field counts every t20_assessments row
//   referencing the version, regardless of status. The activate
//   confirmation modal surfaces this so super_admin sees the
//   immutability boundary at a glance — once a capture is locked
//   to a rubric, it stays locked.

export type RubricVersionStatus = "active" | "draft" | "archived";

export type RubricVersionRow = {
  id: string;
  version: string;
  rubric: Rubric | null;
  status: RubricVersionStatus;
  isActive: boolean;
  activatedAt: string | null;
  createdAt: string;
  createdByName: string | null;
  assessmentCount: number;
};

export type ListRubricVersionsResult =
  | { ok: true; rows: RubricVersionRow[] }
  | { ok: false; reason: "error"; error: string };

export async function listRubricVersions(): Promise<ListRubricVersionsResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("t20_rubric_versions")
    .select(
      "id, version, rubric, is_active, activated_at, created_at, created_by, creator:profiles!created_by(first_name, last_name, display_name)",
    )
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[platform/rubrics] list versions failed:", error);
    return { ok: false, reason: "error", error: error.message };
  }

  const ids = (data ?? []).map((r) => r.id);
  const countMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: assessments } = await supabase
      .from("t20_assessments")
      .select("rubric_version_id")
      .in("rubric_version_id", ids);
    for (const a of assessments ?? []) {
      countMap.set(
        a.rubric_version_id,
        (countMap.get(a.rubric_version_id) ?? 0) + 1,
      );
    }
  }

  const rows: RubricVersionRow[] = (data ?? []).map((r) => {
    const parsed = RubricSchema.safeParse(r.rubric);
    const rubric = parsed.success ? parsed.data : null;
    const count = countMap.get(r.id) ?? 0;
    const status: RubricVersionStatus = r.is_active
      ? "active"
      : count > 0
        ? "archived"
        : "draft";
    const creator = r.creator as
      | {
          first_name?: string | null;
          last_name?: string | null;
          display_name?: string | null;
        }
      | null;
    return {
      id: r.id,
      version: r.version,
      rubric,
      status,
      isActive: r.is_active,
      activatedAt: r.activated_at,
      createdAt: r.created_at,
      createdByName: nameOf(creator),
      assessmentCount: count,
    };
  });

  return { ok: true, rows };
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
