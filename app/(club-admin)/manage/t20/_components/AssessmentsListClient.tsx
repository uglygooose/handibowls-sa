"use client";

import { Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AssessmentCard } from "@/components/t20/AssessmentCard";
import { Bowl } from "@/components/brand/Bowl";
import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { cn } from "@/lib/utils";

import type { AssessmentListRow } from "../_data";

// Phase 10 / 10-4 — Client-side search + filter island for the
// /manage/t20 assessments list.
//
// Three filter dimensions, each with the design's chip pattern:
//   status   all | draft | in_progress | completed
//   grade    all | gold | silver | bronze | fail
//   search   substring match against player_name (case-insensitive)
//
// The grade chips are visually de-emphasised (data-disabled) when
// the status filter excludes 'completed' — only completed
// assessments have grades. Click still works (future-proofing for
// when an admin flips status back to 'all') but the muted treatment
// nudges the assessor toward a consistent filter combination.
//
// Three empty states match the design source:
//   no-data       data set is empty entirely → big bowl + "start the
//                 first one" hero treatment
//   no-match      filtered set is empty but data exists → search
//                 icon + "Clear filters" CTA
//
// Both empty states render with speckle to keep visual continuity
// with the page hero.

const STATUS_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["all", "All"],
  ["draft", "Draft"],
  ["in_progress", "In progress"],
  ["completed", "Completed"],
] as const;

const GRADE_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["all", "All"],
  ["gold", "Gold"],
  ["silver", "Silver"],
  ["bronze", "Bronze"],
  ["fail", "Reassess"],
] as const;

type StatusFilter = "all" | "draft" | "in_progress" | "completed";
type GradeFilter = "all" | "gold" | "silver" | "bronze" | "fail";

type Props = {
  rows: AssessmentListRow[];
};

export function AssessmentsListClient({ rows }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const name = (r.player_name ?? "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      if (statusFilter !== "all" && r.ui_state !== statusFilter) return false;
      if (gradeFilter !== "all") {
        if (r.ui_state !== "completed") return false;
        if (r.grade !== gradeFilter) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, gradeFilter]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setGradeFilter("all");
  }

  const hasData = rows.length > 0;
  const hasFiltered = filtered.length > 0;
  const filtersActive =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    gradeFilter !== "all";

  return (
    <div data-slot="assessments-list-client" className="flex flex-col gap-3.5">
      {/* SEARCH */}
      <div
        data-slot="search-row"
        className="relative flex items-center"
      >
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 size-4 text-ink-muted"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by player, assessor, or date…"
          aria-label="Search assessments"
          data-slot="search-input"
          className={cn(
            "h-11 w-full rounded-lg border border-border bg-bone pl-10 pr-3.5 text-[14px]",
            "placeholder:text-ink-muted",
            "focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10",
          )}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 hidden h-6 items-center rounded-md border border-border bg-surface-muted px-2 font-mono text-[11px] text-ink-muted sm:inline-flex"
        >
          /
        </span>
      </div>

      {/* FILTER CARD */}
      <div
        data-slot="filter-card"
        className="rounded-xl border border-border bg-bone px-5 py-3.5"
      >
        <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
          <div data-slot="status-filter" className="min-w-0">
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
              Status
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map(([id, lbl]) => (
                <Chip
                  key={id}
                  active={statusFilter === id}
                  onClick={() => setStatusFilter(id as StatusFilter)}
                  data-slot="status-chip"
                  data-value={id}
                >
                  {lbl}
                </Chip>
              ))}
            </div>
          </div>

          <div
            data-slot="grade-filter"
            data-disabled={
              statusFilter !== "all" && statusFilter !== "completed"
            }
            className="min-w-0 border-l border-border pl-5"
          >
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
              Grade
            </div>
            <div className="flex flex-wrap gap-1.5">
              {GRADE_OPTIONS.map(([id, lbl]) => {
                const dim =
                  statusFilter !== "all" && statusFilter !== "completed";
                return (
                  <Chip
                    key={id}
                    active={gradeFilter === id}
                    dim={dim}
                    onClick={() => setGradeFilter(id as GradeFilter)}
                    data-slot="grade-chip"
                    data-value={id}
                  >
                    {lbl}
                  </Chip>
                );
              })}
            </div>
          </div>

          {filtersActive && (
            <div className="ml-auto self-end">
              <button
                type="button"
                onClick={clearFilters}
                data-slot="clear-filters-cta"
                className="inline-flex h-9 items-center rounded-lg border border-border bg-bone px-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted hover:bg-surface-muted"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* COUNT EYEBROW */}
      <div className="flex items-baseline justify-between gap-3">
        <span
          data-slot="result-count"
          className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle"
        >
          {filtered.length} of {rows.length}
        </span>
      </div>

      {/* EMPTY STATES + CARD GRID */}
      {!hasData ? (
        <EmptyNoData />
      ) : !hasFiltered ? (
        <EmptyNoMatch onClear={clearFilters} />
      ) : (
        <ul
          data-slot="assessments-grid"
          className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {filtered.map((row) => (
            <li key={row.id}>
              <AssessmentCard row={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ChipProps = {
  active: boolean;
  dim?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  "data-slot"?: string;
  "data-value"?: string;
};

function Chip({ active, dim = false, onClick, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      data-dim={dim}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3.5 font-display text-[12px] font-extrabold uppercase tracking-[0.04em] transition",
        active
          ? "border-ink bg-ink text-ink-inverse"
          : "border-border bg-bone text-ink hover:border-ink/40",
        dim && !active && "opacity-60",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function EmptyNoData() {
  return (
    <div
      data-slot="empty-no-data"
      className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-bone px-8 py-24 text-center"
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        <SpeckleLayer seed="t20-empty-1" density="med" opacity={0.05} />
      </div>
      <div className="relative z-10">
        <div className="mx-auto w-[140px]">
          <Bowl size={140} seed="empty-t20" preset="atomic-red" emblem={true} />
        </div>
        <h3 className="mt-5 font-display text-[34px] font-black italic leading-tight tracking-tight">
          No assessments yet — start the first one.
        </h3>
        <p className="mx-auto mt-2 max-w-[58ch] text-[14px] text-ink-muted">
          Twenty 20 captures a player&apos;s complete skills profile across
          7 sections and 16 deliveries per section. Roughly 45 minutes per
          player, on the green.
        </p>
        <Link
          href="/manage/t20/new"
          data-slot="empty-no-data-cta"
          className="mt-5 inline-flex h-12 items-center gap-2 rounded-lg bg-primary-500 px-6 text-[14px] font-semibold text-on-primary shadow-sm hover:bg-primary-600"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Start the first assessment
        </Link>
      </div>
    </div>
  );
}

function EmptyNoMatch({ onClear }: { onClear: () => void }) {
  return (
    <div
      data-slot="empty-no-match"
      className="rounded-2xl border border-dashed border-border bg-bone px-8 py-14 text-center"
    >
      <Search
        aria-hidden="true"
        className="mx-auto size-10 text-ink-subtle"
      />
      <h3 className="mt-4 font-display text-[24px] font-black italic leading-tight tracking-tight">
        No assessments match those filters.
      </h3>
      <p className="mx-auto mt-1.5 max-w-[44ch] text-[13.5px] text-ink-muted">
        Try a different status or grade combination.
      </p>
      <button
        type="button"
        onClick={onClear}
        data-slot="empty-no-match-cta"
        className="mt-5 inline-flex h-11 items-center rounded-lg border border-border bg-surface px-5 text-[13px] font-medium text-ink hover:bg-surface-muted"
      >
        Clear filters
      </button>
    </div>
  );
}
