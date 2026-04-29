import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/role";

import { CaptureWizard } from "../../_components/CaptureWizard";
import { getAssessmentDetail } from "../../_data";

// Phase 10 / 10-6 — `/manage/t20/[id]/capture` Twenty 20 capture
// wizard. The highest-stakes UX in this phase: a coach drives this
// on a tablet at the green for ~25 minutes, scoring 14 section-
// rounds in real time.
//
// Server Component fetches the assessment + every existing delivery
// row + the assessment's pinned rubric. The Client wizard hydrates
// from this snapshot, computes the resume point (next incomplete
// section-round), and writes per-delivery via the recordDelivery
// server action that 10-2 already shipped.
//
// Resume support: an assessment with prior captures lands at the
// next incomplete (section, round). All recorded deliveries pre-
// fill on entry — coaches can scroll back and re-capture any cell.
//
// 'submitted' assessments redirect to the results view so the
// wizard never lets a finalised assessment back into edit. The
// finalize action (called from the wizard footer) sets
// status='submitted' which prevents re-entry.
//
// super_admin can drive a club's capture too — same role gate as
// the rest of /manage/t20.

export const metadata = {
  title: "Twenty 20 capture · HandiBowls",
};

type RouteParams = { id: string };

export default async function ManageT20Capture({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  await requireRole(["club_admin", "super_admin"]);
  const { id } = await params;

  const result = await getAssessmentDetail(id);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    // no-club / error — surface as 404 to match the role-gate
    // semantics. The capture surface is meaningful only when the
    // assessment is reachable + editable; anything else is a 404.
    notFound();
  }

  const { assessment, deliveries, rubric } = result.data;

  // Finalised assessments shouldn't re-enter the wizard. The DB
  // status enum carries 'submitted' for finalized; the results view
  // owns post-finalize editing (notes, second marker). Surface a
  // 404 here so the wizard never silently lets a coach edit a
  // finalised score.
  if (assessment.status === "submitted" || assessment.status === "archived") {
    notFound();
  }

  return (
    <CaptureWizard
      assessment={assessment}
      deliveries={deliveries}
      rubric={rubric}
    />
  );
}
