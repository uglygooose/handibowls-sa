import { AdminPageHero } from "@/components/layout/AdminPageHero";
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
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
        <AdminPageHero
          eyebrow="Platform · Rubric library"
          title="Twenty 20 rubrics"
          containerWidth="none"
        />
        <div className="rounded-[14px] border border-dashed border-border p-8 text-center">
          <p className="text-sm text-ink-muted">
            Couldn&apos;t load rubric versions: {result.error}
          </p>
        </div>
      </div>
    );
  }

  return <RubricsClient rows={result.rows} />;
}
