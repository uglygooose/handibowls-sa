import Link from "next/link";

import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { requireRole } from "@/lib/auth/role";

import { NewAssessmentForm } from "../_components/NewAssessmentForm";
import {
  getActiveRubric,
  getT20CandidatesForClub,
} from "../_data";

// Phase 10 / 10-5 — `/manage/t20/new` Twenty 20 setup form.
//
// Server Component composes the hero + the form-island handoff.
// Candidate roster (active club members + their last submitted
// assessment) is fetched server-side so the client form can render
// the player picker AND the player-history sidebar without a second
// roundtrip. Active rubric metadata feeds Section 4's reference card.
//
// Hero matches the design source (med-density speckle, single
// splatter accent rotated +18° at 260px). Hero copy is verbatim.
// Form lives in a Client island for the live state + useActionState
// flow.
//
// super_admin without a host club lands on the standard empty card.

export const metadata = {
  title: "Twenty 20 setup · HandiBowls",
};

export default async function ManageT20New() {
  await requireRole(["club_admin", "super_admin"]);

  const [hostClub, candidatesResult, rubricResult] = await Promise.all([
    getCurrentHostClub(),
    getT20CandidatesForClub(),
    getActiveRubric(),
  ]);

  if (!candidatesResult.ok) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
        <AdminPageHero
          eyebrow="Club admin"
          title="Twenty 20 setup"
          containerWidth="none"
        />
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-ink-muted">
            No club is in scope for this account. Use{" "}
            <Link
              href="/platform/clubs"
              className="font-medium text-ink underline"
            >
              Platform · Clubs
            </Link>{" "}
            to pick a club to manage.
          </p>
        </div>
      </div>
    );
  }

  const splatterPreset = hostClub?.club_theme_preset ?? "atomic-red";
  const today = todayIsoSAST();

  // Active rubric metadata for the form's reference card. When the
  // rubric fails to load we still render the form (the action
  // re-checks at submit time and surfaces `no_active_rubric`).
  const activeRubricLabel =
    rubricResult.ok ? rubricResult.versionLabel : "no active rubric";

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
      <AdminPageHero
        eyebrow="Club admin · New assessment"
        title="Twenty 20 setup"
        description="Confirm player, assessor, and conditions. Capture begins on the next screen and autosaves every delivery."
        speckle={{ seed: "t20-new-hero", density: "med", opacity: 0.06 }}
        splatter={{ preset: splatterPreset, variant: 0, size: "L", rotate: 18, opacity: 0.55 }}
        containerWidth="none"
      />

      <NewAssessmentForm
        candidates={candidatesResult.rows}
        defaultDate={today}
        activeRubricLabel={activeRubricLabel}
      />
    </div>
  );
}

/** Today's date in SAST as YYYY-MM-DD. SAST is UTC+2 with no DST so
 *  a fixed-offset anchor is correct year-round. */
function todayIsoSAST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
