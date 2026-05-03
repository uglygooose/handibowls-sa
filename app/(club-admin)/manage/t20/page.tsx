import { Award, Sparkles } from "lucide-react";
import Link from "next/link";

import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { requireRole } from "@/lib/auth/role";

import { AssessmentsListClient } from "./_components/AssessmentsListClient";
import { getActiveRubric, listAssessmentsForClub } from "./_data";

// Phase 10 / 10-4 — `/manage/t20` Twenty 20 assessments list.
//
// Server Component composes the hero + stat cards + active-rubric pill,
// then hands off to a Client island (`<AssessmentsListClient />`) for
// the search / filter / card-grid surface. Pattern matches Phase 8's
// /manage/tournaments page — Server Component does the heavy fetch +
// derivation; the interactive bits live in a focused Client island.
//
// Stats computed server-side from the row set so the hero copy stays
// in sync with the cards. Avg. score shows "—" when no completed
// assessments exist (rather than "0.0%" or "NaN%") so the empty-state
// copy reads honestly.
//
// super_admin lands without a host club → empty card pointing at
// /platform/clubs (matches the precedent established by /manage/greens
// and /manage/overview).

export const metadata = {
  title: "Twenty 20 · HandiBowls",
};

export default async function ManageT20() {
  await requireRole(["club_admin", "super_admin"]);

  const [hostClub, listResult, rubricResult] = await Promise.all([
    getCurrentHostClub(),
    listAssessmentsForClub(),
    getActiveRubric(),
  ]);

  if (!listResult.ok) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 pb-24">
        <AdminPageHero
          eyebrow="Club admin"
          title="Twenty 20"
          subtitle="skills assessment"
          containerWidth="none"
        />
        <div className="rounded-[14px] border border-dashed border-border p-8 text-center">
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

  const rows = listResult.rows;
  const clubName = hostClub?.club_name ?? listResult.clubName;
  const splatterPreset = hostClub?.club_theme_preset ?? "atomic-red";

  const completedCount = rows.filter((r) => r.ui_state === "completed").length;
  const inProgressCount = rows.filter(
    (r) => r.ui_state === "in_progress",
  ).length;
  const goldCount = rows.filter((r) => r.grade === "gold").length;
  const completedRows = rows.filter((r) => r.ui_state === "completed");
  const avgPct =
    completedRows.length === 0
      ? null
      : completedRows.reduce((s, r) => s + r.percentage, 0) / completedRows.length;
  const avgPctLabel = avgPct === null ? "—" : `${avgPct.toFixed(1)}%`;
  const avgBand = avgPct === null
    ? "No completed yet"
    : avgPct >= 80
      ? "Gold band"
      : avgPct >= 65
        ? "Silver band"
        : avgPct >= 50
          ? "Bronze band"
          : "Reassess band";

  const activeRubricLabel =
    rubricResult.ok ? rubricResult.versionLabel : "no active rubric";

  const subtitle =
    rows.length === 0
      ? `Skills assessments at ${clubName}. None on the books yet — start the first one to get going.`
      : `Skills assessments at ${clubName}. ${rows.length} on the books · ${inProgressCount} live · ${goldCount} gold.`;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
      <AdminPageHero
        eyebrow={`Club admin · ${clubName}`}
        title="Twenty 20"
        subtitle="skills assessment"
        description={subtitle}
        speckle={{ seed: "t20-list-hero", density: "high", opacity: 0.07 }}
        splatter={[
          { preset: splatterPreset, variant: 1, size: "L", rotate: -14, opacity: 0.55 },
          { preset: splatterPreset, variant: 0, size: "M", rotate: 32, opacity: 0.4, bottom: -40, left: 128 },
        ]}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-slot="active-rubric-pill"
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary-500 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-on-primary"
            >
              <Sparkles className="size-3" aria-hidden="true" />
              Active rubric · {activeRubricLabel}
            </span>
            {rows.length > 0 && (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-bone px-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                <Award className="size-3" aria-hidden="true" />
                {completedCount} done · {inProgressCount} in capture
              </span>
            )}
          </div>
        }
        actions={
          <Link
            href="/manage/t20/new"
            data-slot="new-assessment-cta"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary-500 px-5 text-sm font-semibold text-on-primary shadow-sm hover:bg-primary-600"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            New Assessment
          </Link>
        }
        containerWidth="none"
      />

      {/* STAT CARDS — 4-up grid with left accent strip per design source */}
      <div
        data-slot="stat-cards"
        className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Completed"
          value={String(completedCount)}
          sub="this cycle"
          accent="var(--color-success-500)"
        />
        <StatCard
          label="In progress"
          value={String(inProgressCount)}
          sub="live capture"
          accent="var(--color-primary-500)"
        />
        <StatCard
          label="Gold tier"
          value={String(goldCount)}
          sub="≥ 80%"
          accent="#d4a000"
        />
        <StatCard
          label="Avg. score"
          value={avgPctLabel}
          sub={avgBand}
          accent="var(--color-ink)"
        />
      </div>

      {/* CLIENT-SIDE FILTER + GRID */}
      <AssessmentsListClient rows={rows} />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div
      data-slot="stat-card"
      data-stat={label.toLowerCase().replace(/\s+/g, "-").replace(/\./g, "")}
      className="relative overflow-hidden rounded-[14px] border border-border bg-bone px-5 py-4"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: accent }}
      />
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
        {label}
      </div>
      <div className="mt-0.5 font-display text-[30px] font-black leading-none tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-[12px] text-ink-muted">{sub}</div>
    </div>
  );
}
