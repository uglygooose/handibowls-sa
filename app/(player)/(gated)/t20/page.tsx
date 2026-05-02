import { Calendar, ChevronRight, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PlayerHero } from "@/components/layout/PlayerHero";
import { PlayerSectionHead } from "@/components/layout/PlayerSectionHead";
import { getAuthContext } from "@/lib/auth/role";
import { formatDateZA, formatTimeZA } from "@/lib/format/dates";

import { RequestAssessmentButton } from "./_components/RequestAssessmentButton";
import {
  getCurrentPlayerT20Profile,
  getUpcomingT20Assessments,
} from "./_data";

// Phase 12 / 12-1 — Player-side Twenty 20 hub. Replaces the Phase 10
// roadmap stub. Sections (per design source PageT20 in
// player-pages.jsx:182):
//   1. Hero — primary-club themed band with current grade pill +
//      tier ladder + "Request assessment" CTA (12-1 followup —
//      replaced the original 5-state Book-X-assessment CTA with a
//      single tier-agnostic request action wired to the
//      requestT20Assessment server action)
//   2. "What is Twenty 20?" explainer card (3 grid items)
//   3. Upcoming assessments — booked rows from `bookings` filtered
//      by for_profile_id = current player + purpose='t20_assessment'
//      + ends_at > now (12-1 followup migration 037)
//   4. All assessments — submitted-assessments list including the
//      latest (also surfaced in the hero); the list is the tap
//      target into /t20/[assessmentId] (additive over the design
//      source per L166 entry text). Pre-12.5-4-hotfix this list
//      excluded the latest via rows.slice(1) which made the new
//      detail view unreachable for 1-assessment players.

export const metadata = {
  title: "Twenty 20 · HandiBowls",
};

const TIER_ORDER = ["bronze", "silver", "gold", "platinum"] as const;
type Tier = (typeof TIER_ORDER)[number];
type TierStepState = "done" | "active" | "future";

const TIER_LABEL: Record<Tier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

export default async function T20Page() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const [profile, upcoming] = await Promise.all([
    getCurrentPlayerT20Profile(),
    getUpcomingT20Assessments(),
  ]);
  const heroTheme = profile.latest?.club_theme ?? profile.primary_club_theme;
  const ladder = computeLadder(profile.latest?.grade ?? null);
  const heroCopy = heroCopyFor(profile.latest);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-4 pb-24">
      {/* Hero — primary-club themed band, contained inside the
          centered wrapper per bundle's `.t20-hero` (rounded-[20px]
          + p-[18px] + bg-primary-500). 12.5-6.5 Stage B: dropped
          the previous `sm:mx-5 sm:my-5` responsive margin (bundle
          has no responsive margin-add) and snapped padding from
          `px-5 py-6` to the bundle's flat 18px via PlayerHero. */}
      <PlayerHero
        titleSize="grade"
        eyebrow={heroCopy.eyebrow}
        title={heroCopy.gradeText}
        speckle={{
          preset: heroTheme,
          seedKey: `t20-hero-${ctx.userId}`,
          intensity: "bold",
          borderRadius: 20,
        }}
        splatter={{
          preset: heroTheme,
          variant: 1,
          size: "S",
          right: -22,
          bottom: -22,
          opacity: 0.45,
        }}
      >
        <span className="mt-2.5 block font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-white/85">
          {heroCopy.subline}
        </span>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {ladder.map(({ tier, state }) => (
            <TierStep key={tier} tier={tier} state={state} />
          ))}
        </div>

        <div className="mt-3.5">
          <RequestAssessmentButton />
        </div>
        <span className="mt-1.5 block text-center font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white/70">
          Sends an in-app message to your club admins
        </span>
      </PlayerHero>

      <div className="flex flex-col gap-5">
        {/* "What is Twenty 20?" explainer */}
        <PlayerSectionHead>What is Twenty 20?</PlayerSectionHead>
        <div className="rounded-xl border border-border bg-surface px-5 py-5">
          <p className="m-0 mb-3 text-[13.5px] leading-[1.5] text-ink-muted">
            Twenty 20 is the official handicap and grading system for South
            African bowls. Your grade affects which tournaments you can enter
            and how handicap points are applied.
          </p>
          <ul className="m-0 grid list-none gap-2.5 p-0">
            <ExplainItem
              icon={<Trophy className="size-4 text-accent-ink" aria-hidden="true" />}
              title="Better matchmaking"
              body="Even pairings, fewer mismatches"
            />
            <ExplainItem
              icon={<Target className="size-4 text-accent-ink" aria-hidden="true" />}
              title="Track progress"
              body="Watch your grade improve over time"
            />
            <ExplainItem
              icon={<Calendar className="size-4 text-accent-ink" aria-hidden="true" />}
              title="Re-assess yearly"
              body="Your club hosts assessments seasonally"
            />
          </ul>
        </div>

        {/* Upcoming assessments — booked rows or empty state */}
        <PlayerSectionHead>Upcoming assessments</PlayerSectionHead>
        {upcoming.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {upcoming.map((u) => (
              <li
                key={u.id}
                className="rounded-xl border border-border bg-bone px-4 py-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-primary-600">
                    {formatDateZA(u.starts_at)} · {formatTimeZA(u.starts_at)}
                  </span>
                  <span className="rounded-full bg-primary-500/10 px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-primary-600">
                    Twenty 20
                  </span>
                </div>
                <div className="mt-1 font-display text-[15px] font-bold tracking-tight">
                  {u.club_name ?? "Your club"}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">
                  {[
                    u.green_name && u.rink_number != null
                      ? `${u.green_name} · Rink ${u.rink_number}`
                      : u.green_name,
                    u.scheduler_name && `Scheduled by ${u.scheduler_name}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {u.notes && (
                  <p className="mt-2 m-0 text-[13px] text-ink-muted">{u.notes}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-surface px-5 py-5 text-[13px] text-ink-muted">
            <p className="m-0 mb-1 font-display text-[15px] font-bold tracking-tight text-ink">
              No assessments scheduled.
            </p>
            <p className="m-0">
              Tap &ldquo;Request assessment&rdquo; above and a club admin will
              schedule your next slot.
            </p>
          </div>
        )}

        {/* All assessments — additive over design source per L166.
            12.5-4: row tap navigates to the player results detail
            view at `/t20/[assessmentId]` (audit id
            `player-t20-results-detail`).
            12.5-4 hotfix: list now includes the latest assessment
            (previously excluded via rows.slice(1)) so players with
            exactly 1 submitted assessment have a tap target into
            the detail view. Heading renamed "Past" → "All" since
            the latest is no longer past. */}
        {profile.history.length > 0 && (
          <>
            <PlayerSectionHead>All assessments</PlayerSectionHead>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {profile.history.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/t20/${a.id}`}
                    data-slot="past-assessment-row"
                    data-assessment-id={a.id}
                    className="block rounded-xl border border-border bg-bone px-4 py-3 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-primary-600">
                        {formatDateZA(a.assessed_on)}
                      </span>
                      {a.grade && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] ${gradePillClass(a.grade)}`}
                        >
                          {a.grade}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="font-display text-[15px] font-bold tracking-tight">
                        {a.club_name ?? "Unknown club"}
                      </div>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 text-ink-muted"
                      />
                    </div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">
                      {a.percentage.toFixed(1)}%
                      {a.assessor_name ? ` · ${a.assessor_name}` : ""}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function TierStep({ tier, state }: { tier: Tier; state: TierStepState }) {
  const wrap =
    state === "active"
      ? "rounded-lg bg-white px-1 py-2 text-center text-primary-600"
      : "rounded-lg bg-white/10 px-1 py-2 text-center";
  const dot =
    state === "active"
      ? "mx-auto mb-1 size-2.5 rounded-full bg-primary-500"
      : state === "done"
        ? "mx-auto mb-1 size-2.5 rounded-full bg-white/70"
        : "mx-auto mb-1 size-2.5 rounded-full bg-white/30";
  return (
    <div className={wrap}>
      <span aria-hidden="true" className={`block ${dot}`} />
      <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em]">
        {TIER_LABEL[tier]}
      </span>
    </div>
  );
}

function ExplainItem({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-bold tracking-tight">{title}</span>
        <span className="text-[12px] text-ink-muted">{body}</span>
      </span>
    </li>
  );
}

// ---- pure logic helpers (covered by tests/app/player/t20-page.test.ts) ----

export function computeLadder(
  grade: "gold" | "silver" | "bronze" | "fail" | null,
): ReadonlyArray<{ tier: Tier; state: TierStepState }> {
  // No grade yet, or fail → ladder shows nothing achieved; bronze is the
  // next aspirational step.
  if (grade === null || grade === "fail") {
    return TIER_ORDER.map((tier) => ({ tier, state: "future" as const }));
  }
  // Active grade in {bronze, silver, gold}. Lower tiers render `done`,
  // the matched tier renders `active`, higher tiers render `future`.
  // Platinum is always `future` (aspirational — see DRIFT_LOG: Player
  // /t20 ladder Platinum tier is aspirational).
  const activeIdx = TIER_ORDER.indexOf(grade as Tier);
  return TIER_ORDER.map((tier, idx) => ({
    tier,
    state:
      idx < activeIdx ? "done" : idx === activeIdx ? "active" : "future",
  }));
}

export function heroCopyFor(
  latest: {
    grade: "gold" | "silver" | "bronze" | "fail" | null;
    assessed_on: string;
  } | null,
): {
  eyebrow: string;
  gradeText: string;
  subline: string;
} {
  if (!latest || latest.grade === null) {
    return {
      eyebrow: "Your Twenty 20 grade",
      gradeText: "UNGRADED",
      subline: "No assessment recorded · request your first",
    };
  }
  if (latest.grade === "fail") {
    return {
      eyebrow: "Your Twenty 20 grade",
      gradeText: "RETRY",
      subline: `Last assessed ${formatDateZA(latest.assessed_on)} · request a retry`,
    };
  }
  return {
    eyebrow: "Your Twenty 20 grade",
    gradeText: latest.grade.toUpperCase(),
    subline: `Earned ${formatDateZA(latest.assessed_on)} · valid 12 mo`,
  };
}

function gradePillClass(grade: "gold" | "silver" | "bronze" | "fail"): string {
  if (grade === "gold") return "bg-[#F5B700] text-ink border border-[#F5B700]/60";
  if (grade === "silver")
    return "bg-surface-muted text-ink border border-border";
  if (grade === "bronze")
    return "bg-[#B45309]/10 text-[#7C2D12] border border-[#B45309]/30";
  return "bg-danger-500/10 text-danger-500 border border-danger-500/30";
}
