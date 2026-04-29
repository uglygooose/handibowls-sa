import { requireRole } from "@/lib/auth/role";

import { RubricsClient } from "./_components/RubricsClient";
import { listRubricVersions } from "./_data";

// Phase 10 / 10-8 — `/platform/rubrics` Twenty 20 rubric library.
//
// Super-admin only. The schema's `t20_rubric_versions` table is the
// version-controlled source of scoring truth: every t20_assessments
// row carries a `rubric_version_id` FK pinning it to whichever
// version was active at capture time. Activation is therefore a
// one-way door — assessments captured under v1 never re-grade
// against v2.
//
// Surface composition
//
//   Hero               Speckle + splatter, "Twenty 20 rubrics" h1 +
//                      strapline. Per super-admin convention the
//                      shell is Core Black (ThemeApplier).
//   UploadZone         Drag-drop affordance; client-side JSON parse +
//                      RubricSchema validation; on submit calls
//                      uploadRubricVersion (10-2 action) which re-
//                      validates and inserts as is_active=false.
//   DraftBanner        Prominent amber strip when ≥ 1 draft exists.
//                      "Compare changes" → diff modal · "Activate"
//                      → activate confirmation modal.
//   VersionsTable      All versions with status pill / uploader /
//                      captures-locked count / row-action menu.
//   PendingChangesPanel Permanent diff preview between active and
//                      first draft; mirrors the iconic side-by-side
//                      from the design source.

export const metadata = {
  title: "Twenty 20 rubrics · HandiBowls",
};

export default async function PlatformRubrics() {
  await requireRole(["super_admin"]);
  const result = await listRubricVersions();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-6">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            Platform · Rubric library
          </span>
          <h1 className="mt-1 font-display text-3xl font-extrabold italic tracking-tight">
            Twenty 20 rubrics
          </h1>
        </header>
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-ink-muted">
            Couldn&apos;t load rubric versions: {result.error}
          </p>
        </div>
      </div>
    );
  }

  return <RubricsClient rows={result.rows} />;
}
