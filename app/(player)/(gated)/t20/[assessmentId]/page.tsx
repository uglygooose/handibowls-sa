import { notFound, redirect } from "next/navigation";

import { getCurrentMemberships } from "@/lib/auth/memberships";
import { getAuthContext } from "@/lib/auth/role";
import { getAssessmentDetail } from "@/lib/t20/assessment-detail";

import { PlayerResultsView } from "./_components/PlayerResultsView";

// Phase 12.5 / 12.5-4 (audit id `player-t20-results-detail`):
// player-facing read-only Twenty 20 results detail view. Player
// taps a past-assessments row in PageT20 (`/t20`) and lands here.
//
// Server Component. Reads the assessment + deliveries + rubric via
// the shared `getAssessmentDetail` fetcher (extracted to
// `lib/t20/assessment-detail.ts` in 12.5-4 commit 1). RLS gates the
// row visibility per the caller's session — the
// `t20_assessments_subject_read` policy from migration 010 (pinned
// by `tests/rls/t20.test.ts:27-48`) ensures a player only sees their
// own assessments.
//
// Defence-in-depth: even if RLS slipped, the explicit
// `assessment.player_id !== ctx.userId` 404 guard below blocks the
// player from reading another player's assessment by URL guessing.

export const metadata = {
  title: "Twenty 20 result · HandiBowls",
};

type Props = {
  params: Promise<{ assessmentId: string }>;
};

export default async function PlayerT20DetailPage({ params }: Props) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const { assessmentId } = await params;

  const result = await getAssessmentDetail(assessmentId);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    if (result.reason === "no-club") redirect("/t20");
    // "error" — surface a generic 404 rather than leak the row's
    // existence on a transient failure.
    notFound();
  }

  const detail = result.data;

  // Defence-in-depth: RLS enforces the same constraint, but a
  // belt-and-braces app-layer check makes the "your own
  // assessments only" rule explicit at the route boundary.
  if (detail.assessment.player_id !== ctx.userId) {
    notFound();
  }

  // Only fully-submitted assessments render the detail view. Drafts
  // and in-progress captures live in the admin capture wizard; a
  // player landing on a non-submitted row gets bounced back to the
  // hub (this should not happen via the linked past-list since the
  // hub only renders submitted rows, but URL-guessing is possible).
  if (detail.assessment.status !== "submitted") {
    redirect("/t20");
  }

  const memberships = await getCurrentMemberships();
  const hasClubMembership = memberships.length > 0;

  return (
    <PlayerResultsView
      detail={detail}
      hasClubMembership={hasClubMembership}
    />
  );
}
