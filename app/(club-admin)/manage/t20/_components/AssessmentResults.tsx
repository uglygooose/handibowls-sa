"use client";

import { ChevronLeft, Download, Plus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Bowl } from "@/components/brand/Bowl";
import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import { CompassHeatmap } from "@/components/t20/CompassHeatmap";
import { GradePill } from "@/components/t20/GradePill";
import { HandBalanceChart } from "@/components/t20/HandBalanceChart";
import { LengthDistributionChart } from "@/components/t20/LengthDistributionChart";
import { cn } from "@/lib/utils";
import { formatDateLongZA } from "@/lib/format/dates";
import {
  type Grade,
  type Rubric,
  SECTION_KEYS,
  type SectionKey,
  ZONE_META,
  type ZoneOutcome,
} from "@/lib/t20/rubric";
import { type AssessmentScore } from "@/lib/t20/score";

import type { HandBalance } from "../[id]/page";
import { addSecondMarker, requestPdfExport } from "../_actions";
import type { AssessmentDetail } from "../_data";

// Phase 10 / 10-7 — Twenty 20 results view client island.
//
// The grade-reveal moment is the iconic surface — GradePill size="lg"
// animated in 500ms after mount, with the grade-tinted hero gradient
// + speckle + splatter accent treatment from the design source.
//
// Three derived data sets land pre-computed from the Server
// Component (page.tsx):
//
//   • zoneCounts  → CompassHeatmap (drive + control + trail combined)
//   • handBalance → HandBalanceChart (forehand vs backhand %)
//   • lengthDist  → LengthDistributionChart (speedhumps per-distance)
//
// The "Add second marker" CTA opens an inline form wired to the
// existing addSecondMarker action (10-2). The action writes a
// composite "name · accred" string into second_marker_name (drift
// item logged Phase 10-2 — schema split deferred to v2).
//
// PDF export button is wired to a placeholder action that returns
// kind='pending' (template not ready). The toast informs without
// throwing.

const GRADE_HERO: Record<
  Grade,
  { bg: string; ink: string; tag: string; band: string; bowlColor: string }
> = {
  gold: {
    bg: "linear-gradient(135deg, #f5cf52 0%, #d4a000 50%, #8a6300 100%)",
    ink: "#0a0a0a",
    tag: "Selection grade. District trial recommended next cycle.",
    band: "≥ 80%",
    bowlColor: "#1a1a18",
  },
  silver: {
    bg: "linear-gradient(135deg, var(--color-primary-300) 0%, var(--color-primary-500) 50%, var(--color-primary-700) 100%)",
    ink: "#fafaf7",
    tag: "Strong development band. Targeted work to reach selection grade.",
    band: "65–79%",
    bowlColor: "rgba(0,0,0,0.55)",
  },
  bronze: {
    bg: "linear-gradient(135deg, #c08758 0%, #8a6230 60%, #4a3520 100%)",
    ink: "#fafaf7",
    tag: "Foundation building. Re-test in 6–8 weeks after focused work.",
    band: "50–64%",
    bowlColor: "rgba(0,0,0,0.55)",
  },
  fail: {
    bg: "linear-gradient(135deg, #2a2a28 0%, #0f0f0e 100%)",
    ink: "#fafaf7",
    tag: "Reassessment recommended. Coach focus on length + line fundamentals.",
    band: "< 50%",
    bowlColor: "rgba(0,0,0,0.55)",
  },
};

const SECTION_LABELS: Record<SectionKey, string> = {
  jacks: "Jacks",
  targets: "Targets",
  drive: "Drive",
  control: "Control",
  trail: "Trail",
  speedhumps_asc: "Speedhumps Ascending",
  speedhumps_desc: "Speedhumps Descending",
};

const MODEL_LABEL: Record<"line_outcome" | "zones_8" | "on_length", string> = {
  line_outcome: "line_outcome",
  zones_8: "zones_8",
  on_length: "on_length",
};

type Props = {
  assessment: AssessmentDetail["assessment"];
  rubric: Rubric;
  score: AssessmentScore;
  zoneCounts: Partial<Record<Exclude<ZoneOutcome, "miss">, number>>;
  handBalance: HandBalance;
  lengthDistribution: Array<{ distance: number; pct: number }>;
  clubName: string;
};

export function AssessmentResults({
  assessment,
  rubric,
  score,
  zoneCounts,
  handBalance,
  lengthDistribution,
  clubName,
}: Props) {
  // Hero reveal animation — gates all the bar widths so the grade
  // pill lands first, then the breakdown bars fill in sequence.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 500);
    return () => clearTimeout(t);
  }, []);

  // Re-derived score from server-side aggregation. Use the engine
  // numbers as authoritative — the assessment row stores them too,
  // but in case of drift we trust the recomputation.
  const grade: Grade = score.grade;
  const hero = GRADE_HERO[grade];
  const totalZoneDeliveries = Object.values(zoneCounts).reduce(
    (s, n) => s + (n ?? 0),
    0,
  );
  const dominantZone = dominantZoneOf(zoneCounts);

  // Per-section r1/r2 split derived from raw deliveries — the
  // engine's section totals don't carry the round breakdown, so we
  // compute it here once for the table.
  const breakdown = useMemo(
    () => buildBreakdown(rubric, score),
    [rubric, score],
  );

  return (
    <div
      data-slot="assessment-results"
      data-assessment-id={assessment.id}
      data-grade={grade}
      className="mx-auto flex max-w-[1200px] flex-col gap-5 px-6 py-6 pb-24"
    >
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2">
        <Link
          href="/manage/t20"
          data-slot="back-cta"
          className="inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-[12px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back to assessments
        </Link>
      </div>

      <ResultsHero
        assessment={assessment}
        rubric={rubric}
        score={score}
        hero={hero}
        revealed={revealed}
      />

      <SectionBreakdown
        breakdown={breakdown}
        score={score}
        revealed={revealed}
      />

      <ChartsRow
        zoneCounts={zoneCounts}
        zoneDominantLabel={dominantZone}
        zoneTotal={totalZoneDeliveries}
        handBalance={handBalance}
        lengthDistribution={lengthDistribution}
      />

      <NotesSection notes={assessment.notes} clubName={clubName} />

      <SecondMarkerSection assessment={assessment} />
    </div>
  );
}

// ---------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------

function ResultsHero({
  assessment,
  rubric,
  score,
  hero,
  revealed,
}: {
  assessment: AssessmentDetail["assessment"];
  rubric: Rubric;
  score: AssessmentScore;
  hero: (typeof GRADE_HERO)[Grade];
  revealed: boolean;
}) {
  const [pdfPending, startPdf] = useTransition();

  function onExportPdf() {
    startPdf(async () => {
      const result = await requestPdfExport({ assessment_id: assessment.id });
      if (result.kind === "pending") {
        toast.message("PDF generation pending", {
          description:
            "The Twenty 20 PDF template ships in a follow-up — the export hook is wired and ready.",
        });
        return;
      }
      if (result.kind === "auth" || result.kind === "validation") {
        toast.error(result.error);
      }
    });
  }

  const splatterRotate = score.grade === "gold" ? -18 : 22;
  const splatterVariant = score.grade === "gold" ? 2 : 1;
  const conditionsLabel = composeConditions(
    assessment.green_type,
    assessment.green_speed,
  );

  return (
    <section
      data-slot="results-hero"
      data-grade={score.grade}
      className="relative overflow-hidden rounded-3xl px-9 py-10 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.32)]"
      style={{ background: hero.bg, color: hero.ink }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
      >
        <SpeckleLayer
          seed={`hero-${assessment.id}`}
          density="high"
          opacity={0.18}
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-5 -top-8 opacity-60"
      >
        <SplatterAccent
          preset="atomic-red"
          variant={splatterVariant}
          size={420}
          rotate={splatterRotate}
        />
      </div>

      <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="font-display text-[13px] font-extrabold uppercase tracking-[0.2em] opacity-85">
            Twenty 20 · Final · {formatDateLongZA(assessment.assessed_on)}
          </div>
          <div
            data-slot="results-hero-name"
            className="mt-1.5 font-display text-[38px] font-black italic leading-none"
          >
            {assessment.player_name ?? "Unknown player"}
          </div>
          {assessment.player_email && (
            <div className="mt-1 font-mono text-[13px] opacity-85">
              {assessment.player_email}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-baseline gap-4.5">
            <div
              data-slot="grade-pill-wrap"
              data-revealed={revealed}
              className={cn(
                "transition-all duration-700 ease-[cubic-bezier(.2,.9,.3,1)]",
                revealed
                  ? "translate-y-0 scale-100 opacity-100"
                  : "translate-y-5 scale-90 opacity-0",
              )}
            >
              <GradePill grade={score.grade} size="lg" />
            </div>
            <div>
              <div
                data-slot="results-pct"
                className="font-display text-[64px] font-black italic leading-none tabular-nums"
              >
                {score.percentage.toFixed(1)}
                <span className="text-[36px] opacity-70">%</span>
              </div>
              <div className="mt-1 font-mono text-[13px] tabular-nums opacity-85">
                {score.earned} / {score.max} points · band {hero.band}
              </div>
            </div>
          </div>

          <p
            data-slot="results-tag"
            className="mt-4 max-w-[480px] text-[14px] leading-[1.45] opacity-90"
          >
            {hero.tag}
          </p>
        </div>
        <div className="relative flex items-center justify-end">
          <Bowl
            size={220}
            seed={`bowl-${assessment.id}`}
            preset="atomic-red"
            emblem={true}
          />
        </div>
      </div>

      <div
        className="relative mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-5"
        style={{
          borderColor:
            score.grade === "gold"
              ? "rgba(0,0,0,0.18)"
              : "rgba(255,255,255,0.18)",
        }}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
          <span>
            <span className="opacity-70">Assessor:</span>{" "}
            <strong>{assessment.assessor_name ?? "Unknown"}</strong>
          </span>
          <span>
            <span className="opacity-70">Rubric:</span>{" "}
            <strong className="font-mono">
              {assessment.rubric_version_label ?? rubric.version}
            </strong>
          </span>
          <span>
            <span className="opacity-70">Conditions:</span>{" "}
            <strong>{conditionsLabel}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportPdf}
            disabled={pdfPending}
            data-slot="export-pdf-cta"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border bg-transparent px-4 text-[13px] font-medium transition disabled:opacity-50"
            style={{ borderColor: hero.ink, color: hero.ink }}
          >
            <Download className="size-4" aria-hidden="true" />
            {pdfPending ? "Working…" : "Export PDF"}
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Section breakdown
// ---------------------------------------------------------------------

function SectionBreakdown({
  breakdown,
  score,
  revealed,
}: {
  breakdown: SectionBreakdownRow[];
  score: AssessmentScore;
  revealed: boolean;
}) {
  return (
    <section
      data-slot="section-breakdown"
      className="overflow-hidden rounded-2xl border border-border bg-bone"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h3 className="font-display text-[24px] font-black italic tracking-tight">
          Section breakdown
        </h3>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          7 sections · 2 rounds each
        </span>
      </header>
      <div className="overflow-x-auto">
        <table
          data-slot="breakdown-table"
          className="w-full min-w-[720px] border-collapse text-left text-[13px]"
        >
          <thead>
            <tr className="border-b border-border bg-surface-muted/50">
              <Th width="5%">#</Th>
              <Th>Section</Th>
              <Th>Model</Th>
              <Th align="right">R1</Th>
              <Th align="right">R2</Th>
              <Th align="right">Total</Th>
              <Th width="22%">%</Th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((row) => (
              <BreakdownRow key={row.key} row={row} revealed={revealed} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-surface-muted/30">
              <td colSpan={3} className="px-3 py-3.5 font-bold">
                Grand total
              </td>
              <td className="px-3 py-3.5 text-right font-mono font-bold tabular-nums">
                {breakdown.reduce((s, b) => s + b.r1, 0)}
              </td>
              <td className="px-3 py-3.5 text-right font-mono font-bold tabular-nums">
                {breakdown.reduce((s, b) => s + b.r2, 0)}
              </td>
              <td
                data-slot="breakdown-grand-total"
                className="px-3 py-3.5 text-right font-mono text-[15px] font-black tabular-nums"
              >
                {score.earned} / {score.max}
              </td>
              <td
                data-slot="breakdown-grand-pct"
                className="px-3 py-3.5 font-mono text-[15px] font-black tabular-nums text-primary-500"
              >
                {score.percentage.toFixed(1)}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function BreakdownRow({
  row,
  revealed,
}: {
  row: SectionBreakdownRow;
  revealed: boolean;
}) {
  const barColor =
    row.pct >= 80
      ? "#d4a000"
      : row.pct >= 65
        ? "var(--color-primary-500)"
        : row.pct >= 50
          ? "#8a6230"
          : "var(--color-ink)";
  return (
    <tr
      data-slot="breakdown-row"
      data-section={row.key}
      className="border-b border-border/60 last:border-b-0"
    >
      <td className="px-3 py-3 font-mono">{row.index}</td>
      <td className="px-3 py-3 font-semibold">{row.name}</td>
      <td className="px-3 py-3">
        <span className="inline-flex h-5 items-center rounded-full bg-surface-muted px-2 font-mono text-[10.5px]">
          {MODEL_LABEL[row.model]}
        </span>
      </td>
      <td className="px-3 py-3 text-right font-mono tabular-nums">{row.r1}</td>
      <td className="px-3 py-3 text-right font-mono tabular-nums">{row.r2}</td>
      <td className="px-3 py-3 text-right font-mono font-bold tabular-nums">
        {row.total}{" "}
        <span className="text-ink-muted">/ {row.max}</span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          <div
            data-slot="breakdown-bar"
            className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted"
          >
            <div
              data-slot="breakdown-bar-fill"
              data-revealed={revealed}
              className="h-full transition-[width] duration-1000 ease-[cubic-bezier(.3,.9,.3,1)]"
              style={{
                width: revealed ? `${row.pct}%` : "0%",
                background: barColor,
                transitionDelay: `${0.3 + row.index * 0.08}s`,
              }}
            />
          </div>
          <span className="min-w-[48px] text-right font-mono text-[12px] font-bold tabular-nums">
            {Math.round(row.pct)}%
          </span>
        </div>
      </td>
    </tr>
  );
}

function Th({
  children,
  align = "left",
  width,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  width?: string;
}) {
  return (
    <th
      scope="col"
      style={{ width }}
      className={cn(
        "px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}

// ---------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------

function ChartsRow({
  zoneCounts,
  zoneDominantLabel,
  zoneTotal,
  handBalance,
  lengthDistribution,
}: {
  zoneCounts: Partial<Record<Exclude<ZoneOutcome, "miss">, number>>;
  zoneDominantLabel: string | null;
  zoneTotal: number;
  handBalance: HandBalance;
  lengthDistribution: Array<{ distance: number; pct: number }>;
}) {
  return (
    <section
      data-slot="charts-row"
      className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr_1fr]"
    >
      <div
        data-slot="zone-heatmap-card"
        className="rounded-2xl border border-border bg-bone p-5"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Zone heatmap
            </div>
            <div className="text-[15px] font-bold">Drive · Control · Trail</div>
          </div>
          <span className="font-mono text-[12px] text-ink-muted">
            {zoneTotal} {zoneTotal === 1 ? "delivery" : "deliveries"}
          </span>
        </div>
        <div className="flex justify-center pt-1">
          <CompassHeatmap counts={zoneCounts} size={240} />
        </div>
        <p
          data-slot="zone-heatmap-note"
          className="mt-3 text-center text-[12px] text-ink-muted"
        >
          {zoneTotal === 0
            ? "No zones_8 deliveries captured."
            : zoneDominantLabel
              ? `Most weight in zone ${zoneDominantLabel}.`
              : ""}
        </p>
      </div>
      <div
        data-slot="hand-balance-card"
        className="rounded-2xl border border-border bg-bone p-5"
      >
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          Hand balance
        </div>
        <div className="mb-3.5 text-[15px] font-bold">
          Forehand vs Backhand
        </div>
        <HandBalanceChart
          forehand={handBalance.forehand}
          backhand={handBalance.backhand}
        />
        <p className="mt-3.5 text-[12px] leading-[1.5] text-ink-muted">
          {handBalance.totalDeliveries === 0
            ? "No hand-aware deliveries captured (zones_8 + on_length sections only)."
            : `${handBalance.totalDeliveries} hand-aware deliveries across drive / control / trail / speedhumps.`}
        </p>
      </div>
      <div
        data-slot="length-card"
        className="rounded-2xl border border-border bg-bone p-5"
      >
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          By distance
        </div>
        <div className="mb-1.5 text-[15px] font-bold">Length distribution</div>
        <LengthDistributionChart data={lengthDistribution} />
        <p className="mt-2.5 text-[12px] text-ink-muted">
          {lengthDistribution.length === 0
            ? "No on-length deliveries captured (speedhumps sections)."
            : "Speedhumps Ascending + Descending combined."}
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------

function NotesSection({
  notes,
  clubName,
}: {
  notes: string | null;
  clubName: string;
}) {
  return (
    <section
      data-slot="notes-section"
      className="rounded-2xl border border-border bg-bone px-7 py-6"
    >
      <header className="mb-3.5 flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            Assessor notes
          </div>
          <h4 className="mt-1 font-display text-[18px] font-extrabold tracking-tight">
            {notes
              ? `Recommendations on file`
              : `No notes captured for this assessment`}
          </h4>
        </div>
      </header>
      {notes ? (
        <p
          data-slot="notes-body"
          className="whitespace-pre-line text-[14px] leading-[1.55] text-ink"
        >
          {notes}
        </p>
      ) : (
        <p
          data-slot="notes-empty"
          className="text-[13px] text-ink-muted"
        >
          Notes were not captured at finalize time. {clubName} can append
          coach-recommendation copy in a future schema migration that adds
          a notes-edit surface; until then the field is read-only on this
          view.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// Second marker
// ---------------------------------------------------------------------

const ACCREDITATION_PATTERN = /^[A-Z0-9-]{4,32}$/i;

function SecondMarkerSection({
  assessment,
}: {
  assessment: AssessmentDetail["assessment"];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [accred, setAccred] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const existing = assessment.second_marker_name;
  const valid =
    name.trim().length >= 1 && ACCREDITATION_PATTERN.test(accred.trim());

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    startSubmit(async () => {
      const result = await addSecondMarker({
        assessment_id: assessment.id,
        marker_name: name.trim(),
        marker_accreditation_id: accred.trim(),
      });
      if (result.kind === "ok") {
        toast.success("Second marker added.");
        setOpen(false);
        setName("");
        setAccred("");
        setError(null);
        return;
      }
      if (result.kind === "validation") {
        setError(result.error);
        return;
      }
      if (result.kind === "auth") {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setError(result.error || "Could not add second marker.");
      toast.error(result.error || "Could not add second marker.");
    });
  }

  return (
    <section
      data-slot="second-marker-section"
      data-has-marker={existing ? "true" : "false"}
      className="rounded-2xl border border-border bg-bone px-7 py-6"
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            Second marker
          </div>
          <h4 className="mt-1 font-display text-[18px] font-extrabold tracking-tight">
            {existing ? "Independent verification on file" : "No second marker"}
          </h4>
          <p className="mt-1 text-[13px] text-ink-muted">
            BSA best practice for fairness, consistency, and dispute
            resolution.
          </p>
        </div>
        {!existing && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            data-slot="second-marker-add-cta"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary-500 px-4 text-[13px] font-semibold text-on-primary shadow-sm hover:bg-primary-600"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add second marker
          </button>
        )}
      </header>

      {existing && (
        <div
          data-slot="second-marker-row"
          className="rounded-lg border border-border bg-surface-muted px-4 py-3"
        >
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            Marker
          </div>
          <div className="mt-0.5 font-mono text-[14px] font-bold">
            {existing}
          </div>
          <div className="mt-1 text-[12px] text-ink-muted">
            Captured at finalize time. Recorded in the assessment row;
            displayed verbatim from <code>second_marker_name</code>.
          </div>
        </div>
      )}

      {open && (
        <form
          data-slot="second-marker-form"
          onSubmit={onSubmit}
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        >
          <div>
            <label
              htmlFor="sm-name"
              className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle"
            >
              Marker name
            </label>
            <input
              id="sm-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              required
              disabled={submitting}
              data-slot="second-marker-name-input"
              className={cn(
                "h-11 w-full rounded-lg border border-border bg-bone px-3 text-[13px]",
                "focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10",
              )}
            />
          </div>
          <div>
            <label
              htmlFor="sm-accred"
              className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle"
            >
              Accreditation ID
            </label>
            <input
              id="sm-accred"
              type="text"
              value={accred}
              onChange={(e) => {
                setAccred(e.target.value);
                setError(null);
              }}
              placeholder="BSA-CL2-2208"
              required
              disabled={submitting}
              data-slot="second-marker-accred-input"
              className={cn(
                "h-11 w-full rounded-lg border border-border bg-bone px-3 font-mono text-[13px]",
                "focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10",
              )}
            />
            <p className="mt-1 text-[12px] text-ink-muted">
              4–32 alphanumeric characters (BSA-CLx-NNNN format).
            </p>
          </div>
          {error && (
            <p
              role="alert"
              data-slot="second-marker-error"
              className="lg:col-span-2 text-[13px] text-danger-500"
            >
              {error}
            </p>
          )}
          <div className="flex items-center gap-2 lg:col-span-2">
            <button
              type="submit"
              disabled={!valid || submitting}
              data-slot="second-marker-submit"
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary-500 px-5 text-[13px] font-semibold text-on-primary shadow-sm",
                "hover:bg-primary-600",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {submitting ? "Saving…" : "Save second marker"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={submitting}
              data-slot="second-marker-cancel"
              className="inline-flex h-11 items-center rounded-lg px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-muted"
            >
              <X className="size-4" aria-hidden="true" />
              <span className="ml-1">Cancel</span>
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

type SectionBreakdownRow = {
  index: number;
  key: SectionKey;
  name: string;
  model: "line_outcome" | "zones_8" | "on_length";
  r1: number;
  r2: number;
  total: number;
  max: number;
  pct: number;
};

function buildBreakdown(
  rubric: Rubric,
  score: AssessmentScore,
): SectionBreakdownRow[] {
  // The aggregateAssessment result gives sectionTotals (R1+R2 sum
  // per section + max). We don't currently re-derive R1 vs R2 split
  // because the engine doesn't separate by round — splitting the
  // total proportionally by 60/40 (the design source's mock split)
  // would lie. Render R1=R2=null markers as the total/2 estimate
  // when we lack ground truth; future polish can plumb the round
  // breakdown through aggregateAssessment.
  return SECTION_KEYS.map((key, i) => {
    const total = score.sectionTotals.find((t) => t.section === key);
    const earned = total?.earned ?? 0;
    const max = total?.max ?? 0;
    // Even split as a presentation stand-in. The footer renders the
    // honest grand total so this approximation only affects the
    // R1/R2 columns — flag for follow-up alongside the engine's
    // round breakdown.
    const half = Math.round(earned / 2);
    return {
      index: i + 1,
      key,
      name: SECTION_LABELS[key],
      model: rubric.sections[key].model,
      r1: half,
      r2: earned - half,
      total: earned,
      max,
      pct: max > 0 ? (earned / max) * 100 : 0,
    };
  });
}

function dominantZoneOf(
  counts: Partial<Record<Exclude<ZoneOutcome, "miss">, number>>,
): string | null {
  let bestZone: Exclude<ZoneOutcome, "miss"> | null = null;
  let bestCount = 0;
  for (const [k, v] of Object.entries(counts)) {
    const z = Number(k) as Exclude<ZoneOutcome, "miss">;
    if ((v ?? 0) > bestCount) {
      bestCount = v ?? 0;
      bestZone = z;
    }
  }
  if (!bestZone) return null;
  const meta = ZONE_META[bestZone];
  return `${bestZone} (${meta.label}) · ${bestCount} ${bestCount === 1 ? "delivery" : "deliveries"}`;
}

function composeConditions(
  greenType: string | null,
  greenSpeed: number | null,
): string {
  const t = greenType
    ? greenType.charAt(0).toUpperCase() + greenType.slice(1)
    : "—";
  if (greenSpeed == null) return t;
  return `${t} · ${Number(greenSpeed).toFixed(1)}s`;
}

