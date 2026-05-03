"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatDateZA } from "@/lib/format/dates";

import { GradePill } from "./GradePill";

import type { AssessmentListRow } from "@/app/(club-admin)/manage/t20/_data";

// Phase 10 — compact Twenty 20 assessment card for the list page.
//
// Three states:
//   completed   GradePill (sm) + total/percentage in the footer
//   in_progress "In Progress" pill + section progress hint
//   draft       "Draft" pill + dim treatment
//
// Hover lifts the card 2px and tints the border with the active
// club preset (primary-500). The card is a Link to the assessment's
// detail surface — completed → results, in_progress → capture,
// draft → edit (capture surface handles draft hydration).
//
// Player initials are first letter of first name + first of last;
// when both are absent, fall back to "?". Designed for tap targets
// on tablet (40px avatar, 44px+ row height).

type Props = {
  row: AssessmentListRow;
  className?: string;
};

export function AssessmentCard({ row, className }: Props) {
  const initials = initialsFor(row.player_name);
  const name = row.player_name ?? "Unknown player";

  const href =
    row.ui_state === "completed"
      ? `/manage/t20/${row.id}`
      : `/manage/t20/${row.id}/capture`;

  return (
    <Link
      href={href}
      data-slot="assessment-card"
      data-assessment-id={row.id}
      data-state={row.ui_state}
      className={cn(
        "group relative block overflow-hidden rounded-[14px] border border-border bg-bone p-0 transition",
        "hover:-translate-y-0.5 hover:border-primary-500 hover:shadow-[0_12px_24px_-10px_rgba(0,0,0,0.18)]",
        row.ui_state === "draft" && "opacity-90",
        className,
      )}
    >
      <div className="flex flex-col gap-3.5 p-4 px-5">
        {/* Header — avatar + name + state pill */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              data-slot="player-avatar"
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink font-display text-[14px] font-black text-ink-inverse"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="font-semibold leading-tight text-[15px]">
                {name}
              </div>
              <div className="font-mono text-[11.5px] text-ink-muted tabular-nums">
                {formatDateZA(row.assessed_on)}
              </div>
            </div>
          </div>
          <StatePill row={row} />
        </div>

        {/* Footer — assessor + score (varies by state) */}
        <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
          <div>
            <div
              data-slot="assessor-eyebrow"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle"
            >
              Assessor
            </div>
            <div className="text-[13px] leading-tight">
              {row.assessor_name ?? "Unknown"}
            </div>
          </div>
          {row.ui_state === "completed" && (
            <div className="text-right" data-slot="score">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                Total
              </div>
              <div className="font-mono text-[14px] font-bold tabular-nums">
                {row.total_score} / 320
                <span className="ml-1.5 text-ink-muted">
                  · {row.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          )}
          {row.ui_state === "in_progress" && (
            <div className="text-right" data-slot="progress-hint">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                Progress
              </div>
              <div className="font-mono text-[12.5px] font-semibold">
                In capture
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function StatePill({ row }: { row: AssessmentListRow }) {
  if (row.ui_state === "completed" && row.grade) {
    return <GradePill grade={row.grade} size="sm" />;
  }
  if (row.ui_state === "in_progress") {
    return (
      <span
        data-slot="state-pill"
        data-state="in_progress"
        className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-primary-500/12 px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-primary-600"
      >
        <span
          aria-hidden="true"
          className="size-1.5 animate-pulse rounded-full bg-primary-500"
        />
        In progress
      </span>
    );
  }
  return (
    <span
      data-slot="state-pill"
      data-state="draft"
      className="inline-flex h-[22px] items-center rounded-full bg-surface-muted px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted"
    >
      Draft
    </span>
  );
}

function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return letters || "?";
}
