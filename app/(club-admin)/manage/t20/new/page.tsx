import Link from "next/link";

import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
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
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-6">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            Club admin
          </span>
          <h1 className="mt-1 font-display text-3xl font-extrabold italic tracking-tight">
            Twenty 20 setup
          </h1>
        </header>
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
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-6 py-8 pb-24">
      {/* HERO — speckle backing + single splatter accent matching design */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface px-8 py-7">
        <div className="pointer-events-none absolute inset-0 z-0">
          <SpeckleLayer seed="t20-new-hero" density="med" opacity={0.06} />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-10 z-0 opacity-[0.55]"
        >
          <SplatterAccent
            preset={splatterPreset}
            variant={0}
            size={260}
            rotate={18}
          />
        </div>
        <div className="relative z-10 flex min-h-[128px] flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Club admin · New assessment
            </div>
            <h1 className="mt-1.5 font-display text-[48px] font-black italic leading-[1.05] tracking-tight">
              Twenty 20 setup
            </h1>
            <p className="mt-2 max-w-[64ch] text-[14px] text-ink-muted">
              Confirm player, assessor, and conditions. Capture begins on
              the next screen and autosaves every delivery.
            </p>
          </div>
        </div>
      </div>

      {/* FORM ISLAND */}
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
