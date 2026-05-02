import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { PlayerSectionHead } from "@/components/layout/PlayerSectionHead";
import { GradePill } from "@/components/t20/GradePill";
import { LengthDistributionChart } from "@/components/t20/LengthDistributionChart";
import {
  type AssessmentDetail,
  computeLengthDistribution,
  computeZoneCounts,
  rowsToDeliveries,
} from "@/lib/t20/assessment-detail";
import { GRADE_COLORS, gradeHeroGradient } from "@/lib/brand/grade";
import { formatDateLongZA } from "@/lib/format/dates";
import {
  type Rubric,
  SECTION_KEYS,
  type SectionKey,
} from "@/lib/t20/rubric";
import { aggregateAssessment, sectionMaxes } from "@/lib/t20/score";
import { cn } from "@/lib/utils";

import { HeatmapMount } from "./HeatmapMount";
import { RequestReassessmentButton } from "./RequestReassessmentButton";

// Phase 12.5 / 12.5-4 (audit id `player-t20-results-detail`):
// read-only player-facing variant of the admin t20 results view.
// Renders:
//
//   • Hero grade reveal (gradient + percentage + assessor + date)
//   • Section breakdown table — R1 / R2 / Total / % per section.
//     Columns collapse to "Total · %" at <600px per the audit's
//     mobile spec.
//   • Coach notes tiles (3: Strengths / Watch / Coach focus).
//     Read-only — no edit affordance, no Add CTA. Each tile
//     shows an empty state when its category is missing.
//   • Zone heatmap (drive + control + trail combined). Lazy-
//     loaded via next/dynamic so the /t20 hub bundle stays slim.
//
// Per the locked decision at 12.5-prep, amended at 12.5-4 QA:
//   • DROP hand-balance — coach analysis tool, not a player
//     motivation tool.
//   • KEEP length-distribution alongside heatmap — players read
//     "which lengths I bowled best at" intuitively, and the chart
//     visually balances the heatmap section. (Originally dropped
//     with hand-balance; restored after QA showed the heatmap
//     alone left the section visually unbalanced.)
//   • Re-assessment CTA: "Request re-assessment" → wires to the
//     existing requestT20Assessment action.

// Heatmap is lazy-loaded via the `<HeatmapMount>` Client wrapper —
// `next/dynamic({ ssr: false })` is Client-only in Next 16, so the
// dynamic import lives in HeatmapMount and PlayerResultsView stays
// a Server Component. The heatmap chunk loads off the initial
// /t20-hub bundle (player surfaces stay under the 484 KiB /play
// budget from 12-5).

const SECTION_LABELS: Record<SectionKey, string> = {
  jacks: "Jacks",
  targets: "Targets",
  drive: "Drive",
  control: "Control",
  trail: "Trail",
  speedhumps_asc: "Speedhumps Ascending",
  speedhumps_desc: "Speedhumps Descending",
};

type Props = {
  detail: AssessmentDetail;
  /** True when the player is a member of any club — gates the
   *  Request re-assessment CTA. */
  hasClubMembership: boolean;
};

export function PlayerResultsView({ detail, hasClubMembership }: Props) {
  const { assessment, deliveries, rubric } = detail;
  const score = aggregateAssessment(rubric, rowsToDeliveries(deliveries));
  const grade = score.grade;
  const heroBg = gradeHeroGradient(grade);
  const heroInk = GRADE_COLORS[grade].ink;

  const breakdown = buildBreakdown(rubric, score.sectionTotals);
  const zoneCounts = computeZoneCounts(deliveries);
  const lengthDist = computeLengthDistribution(deliveries);
  const notes = assessment.notes;

  return (
    <div className="pb-24">
      {/* Header — back link */}
      <div className="px-5 pt-4">
        <Link
          href="/t20"
          data-slot="back-to-hub"
          className="inline-flex h-9 items-center gap-1 rounded-md px-1.5 text-[13px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back to Twenty 20
        </Link>
      </div>

      {/* Hero — grade reveal */}
      <section
        data-slot="player-results-hero"
        data-grade={grade}
        className="relative isolate mx-auto mt-3 max-w-3xl overflow-hidden rounded-[20px] px-6 py-8 sm:mx-5 sm:px-9 sm:py-10"
        style={{
          background: heroBg,
          color: heroInk,
          boxShadow: "0 16px 32px -10px rgba(0,0,0,0.25)",
        }}
      >
        <div className="relative z-10 flex flex-col items-center gap-4 text-center">
          <span
            className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{ color: heroInk, opacity: 0.85 }}
          >
            Your Twenty 20 result
          </span>
          <GradePill grade={grade} size="lg" />
          <div
            className="mt-1 font-mono text-[14px] font-bold tracking-[0.04em] tabular-nums"
            style={{ color: heroInk, opacity: 0.95 }}
          >
            {score.percentage.toFixed(1)}%
          </div>
          <div
            className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[12px]"
            style={{ color: heroInk, opacity: 0.85 }}
          >
            {assessment.assessor_name && (
              <span data-slot="hero-assessor">
                Assessed by <strong>{assessment.assessor_name}</strong>
              </span>
            )}
            <span data-slot="hero-date">
              {formatDateLongZA(assessment.assessed_on)}
            </span>
            {assessment.rubric_version_label && (
              <span data-slot="hero-rubric">
                Rubric {assessment.rubric_version_label}
              </span>
            )}
          </div>
          <div className="mt-3">
            <RequestReassessmentButton disabled={!hasClubMembership} />
          </div>
        </div>
      </section>

      {/* Section breakdown */}
      <section
        data-slot="player-results-breakdown"
        className="mx-auto mt-6 max-w-3xl px-5"
      >
        <PlayerSectionHead>Section breakdown</PlayerSectionHead>
        <div className="overflow-hidden rounded-xl border border-border bg-bone">
          {/* Desktop / wide table */}
          <table
            data-slot="breakdown-table"
            className="hidden w-full border-collapse text-left text-[13px] sm:table"
          >
            <thead>
              <tr className="border-b border-border bg-surface-muted/50">
                <Th>Section</Th>
                <Th align="right">R1</Th>
                <Th align="right">R2</Th>
                <Th align="right">Total</Th>
                <Th align="right">%</Th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row) => (
                <tr
                  key={row.key}
                  data-slot="breakdown-row"
                  data-section={row.key}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <td className="px-3 py-2.5 font-medium">{row.label}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {row.r1}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {row.r2}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums">
                    {row.total}/{row.max}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-mono tabular-nums",
                      row.percent >= 80 && "text-success-700",
                      row.percent < 50 && "text-danger-500",
                    )}
                  >
                    {row.percent.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile collapsed table — Section + Total · % per audit spec */}
          <table
            data-slot="breakdown-table-mobile"
            className="w-full border-collapse text-left text-[13px] sm:hidden"
          >
            <tbody>
              {breakdown.map((row) => (
                <tr
                  key={row.key}
                  data-slot="breakdown-row-mobile"
                  data-section={row.key}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{row.label}</div>
                    <div className="font-mono text-[11px] text-ink-muted">
                      R1 {row.r1} · R2 {row.r2}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-mono font-bold tabular-nums">
                      {row.total}/{row.max}
                    </div>
                    <div
                      className={cn(
                        "font-mono text-[11px] tabular-nums",
                        row.percent >= 80 && "text-success-700",
                        row.percent < 50 && "text-danger-500",
                      )}
                    >
                      {row.percent.toFixed(0)}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Coach notes tiles — read-only */}
      <section
        data-slot="player-results-notes"
        className="mx-auto mt-6 max-w-3xl px-5"
      >
        <PlayerSectionHead>Notes from your coach</PlayerSectionHead>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <NoteTile
            data-slot="note-tile-strengths"
            kind="strengths"
            title="Strengths"
            body={notes?.strengths}
            emptyCopy="No strengths notes yet."
          />
          <NoteTile
            data-slot="note-tile-watch"
            kind="watch"
            title="Watch"
            body={notes?.watch}
            emptyCopy="No watch notes yet."
          />
          <NoteTile
            data-slot="note-tile-focus"
            kind="focus"
            title="Coach focus"
            body={notes?.focus}
            emptyCopy="No focus notes yet."
          />
        </div>
        {notes?.legacy && (
          <div
            data-slot="note-tile-legacy"
            className="mt-3 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-[13px] text-ink-muted"
          >
            <span className="eyebrow mb-1.5 block">Legacy notes</span>
            <p className="whitespace-pre-wrap">{notes.legacy}</p>
          </div>
        )}
      </section>

      {/* Charts — heatmap + length-distribution side-by-side at
          md+ (≥768px), stacked below (12.5-4 amendment Stage 2).
          Hand-balance stays out per the locked decision. The
          shared `<LengthDistributionChart>` uses `bg-primary-500`
          (theme-token-driven via the cascade); brand decoration
          on the chart bars is deferred to 12.5-6 — see
          `length-distribution-chart-brand-decoration` in
          DRIFT_LOG. */}
      <section
        data-slot="player-results-charts"
        className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-4 px-5 md:grid-cols-2"
      >
        <div data-slot="player-results-heatmap">
          <PlayerSectionHead>Where your bowls landed</PlayerSectionHead>
          <div className="rounded-xl border border-border bg-bone px-5 py-5">
            <HeatmapMount counts={zoneCounts} size={240} />
            <p
              data-slot="heatmap-note"
              className="mt-3 text-center text-[12px] text-ink-muted"
            >
              Drive, control, and trail deliveries combined.
            </p>
          </div>
        </div>
        <div data-slot="player-results-length">
          <PlayerSectionHead>Length distribution</PlayerSectionHead>
          <div className="rounded-xl border border-border bg-bone px-5 py-5">
            <LengthDistributionChart data={lengthDist} />
            <p
              data-slot="length-note"
              className="mt-3 text-center text-[12px] text-ink-muted"
            >
              Speedhumps deliveries — % on length per distance.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}


function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  );
}

function NoteTile({
  kind,
  title,
  body,
  emptyCopy,
  ...rest
}: {
  kind: "strengths" | "watch" | "focus";
  title: string;
  body: string | undefined;
  emptyCopy: string;
  "data-slot"?: string;
}) {
  const empty = !body;
  return (
    <article
      data-kind={kind}
      data-empty={empty}
      className={cn(
        "rounded-xl border bg-bone px-4 py-3.5",
        empty
          ? "border-dashed border-border text-ink-muted"
          : "border-border text-ink",
      )}
      {...rest}
    >
      <div className="eyebrow mb-1.5">{title}</div>
      {empty ? (
        <p className="text-[13px]">{emptyCopy}</p>
      ) : (
        <p className="whitespace-pre-wrap text-[13px] leading-[1.5]">{body}</p>
      )}
    </article>
  );
}

// Aggregations — local helpers (mirror the admin variants;
// kept inline rather than extracted to lib because the player view
// uses a slightly tighter row shape than the admin breakdown).

type BreakdownRow = {
  key: SectionKey;
  label: string;
  r1: number;
  r2: number;
  total: number;
  max: number;
  percent: number;
};

function buildBreakdown(
  rubric: Rubric,
  sectionTotals: ReturnType<typeof aggregateAssessment>["sectionTotals"],
): BreakdownRow[] {
  const maxes = sectionMaxes(rubric);
  return SECTION_KEYS.map((k) => {
    const t = sectionTotals.find((s) => s.section === k);
    const max = maxes[k];
    const total = t?.earned ?? 0;
    const r1 = t?.r1 ?? 0;
    const r2 = t?.r2 ?? 0;
    const percent = max > 0 ? (total / max) * 100 : 0;
    return {
      key: k,
      label: SECTION_LABELS[k],
      r1,
      r2,
      total,
      max,
      percent,
    };
  });
}

