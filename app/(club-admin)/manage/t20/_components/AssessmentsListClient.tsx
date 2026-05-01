"use client";

import { ClipboardList, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { AssessmentCard } from "@/components/t20/AssessmentCard";
import { EmptyState } from "@/components/layout/EmptyState";
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
// assessments have grades.
//
// Phase 12.5 / 12.5-3 (audit id `t20-list-empty-states`):
//
//   • Filter state lifted from `useState` to URL search params
//     (`?status=…&grade=…&q=…`) via `useRouter().replace` with a
//     debounced search input (300ms) so reload + share preserve
//     the filter set. Pattern matches `/platform/clubs` from
//     12-7's search-pagination fix.
//
//   • Two empty states migrated to the shared `<EmptyState>`
//     primitive shipped at 12.5-1. The "no captures yet" state
//     ships the audit's locked copy (lucide ClipboardList icon,
//     "NO ASSESSMENTS YET" eyebrow, "Capture your first
//     Twenty 20" headline, primary CTA → /manage/t20/new). The
//     "no-match" state uses the same primitive with a Search
//     icon and a "Clear filters" CTA.
//
// Per the locked decision at 12.5-prep: total-only empty state at
// v1 (not per-rubric) — the empty-state copy applies to the whole
// dataset, not a filtered slice that has rubric-specific zero
// captures.

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

const STATUS_VALUES = ["all", "draft", "in_progress", "completed"] as const;
const GRADE_VALUES = ["all", "gold", "silver", "bronze", "fail"] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];
type GradeFilter = (typeof GRADE_VALUES)[number];

const SEARCH_DEBOUNCE_MS = 300;

function readStatusParam(value: string | null): StatusFilter {
  return (STATUS_VALUES as readonly string[]).includes(value ?? "")
    ? (value as StatusFilter)
    : "all";
}

function readGradeParam(value: string | null): GradeFilter {
  return (GRADE_VALUES as readonly string[]).includes(value ?? "")
    ? (value as GradeFilter)
    : "all";
}

type Props = {
  rows: AssessmentListRow[];
};

export function AssessmentsListClient({ rows }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Read URL → seed local state. Local state is the visible truth
  // for the search input (so typing feels instant); the URL is
  // pushed on a debounce. Status + grade chips push immediately
  // since they're discrete choices.
  const urlStatus = readStatusParam(searchParams.get("status"));
  const urlGrade = readGradeParam(searchParams.get("grade"));
  const urlQuery = searchParams.get("q") ?? "";

  const [search, setSearch] = useState(urlQuery);
  const searchTimerRef = useRef<number | null>(null);

  // Re-sync search input when URL changes from elsewhere (back
  // button etc.). Status / grade are read directly from the URL
  // every render so they don't need a sync effect.
  useEffect(() => {
    setSearch(urlQuery);
  }, [urlQuery]);

  function buildHref(next: {
    status?: StatusFilter;
    grade?: GradeFilter;
    q?: string;
  }): string {
    const params = new URLSearchParams(searchParams.toString());
    const set = (key: string, value: string, defaultValue = "") => {
      if (!value || value === defaultValue) params.delete(key);
      else params.set(key, value);
    };
    if (next.status !== undefined) set("status", next.status, "all");
    if (next.grade !== undefined) set("grade", next.grade, "all");
    if (next.q !== undefined) set("q", next.q.trim());
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function pushUrl(next: {
    status?: StatusFilter;
    grade?: GradeFilter;
    q?: string;
  }) {
    startTransition(() => {
      router.replace(buildHref(next), { scroll: false });
    });
  }

  function setStatusFilter(value: StatusFilter) {
    pushUrl({ status: value });
  }

  function setGradeFilter(value: GradeFilter) {
    pushUrl({ grade: value });
  }

  function onSearchChange(next: string) {
    setSearch(next);
    if (searchTimerRef.current != null) {
      window.clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = window.setTimeout(() => {
      pushUrl({ q: next });
    }, SEARCH_DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (searchTimerRef.current != null) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  const filtered = useMemo(() => {
    const q = urlQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const name = (r.player_name ?? "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      if (urlStatus !== "all" && r.ui_state !== urlStatus) return false;
      if (urlGrade !== "all") {
        if (r.ui_state !== "completed") return false;
        if (r.grade !== urlGrade) return false;
      }
      return true;
    });
  }, [rows, urlQuery, urlStatus, urlGrade]);

  function clearFilters() {
    setSearch("");
    if (searchTimerRef.current != null) {
      window.clearTimeout(searchTimerRef.current);
    }
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  const hasData = rows.length > 0;
  const hasFiltered = filtered.length > 0;
  const filtersActive =
    urlQuery.trim().length > 0 ||
    urlStatus !== "all" ||
    urlGrade !== "all";

  return (
    <div data-slot="assessments-list-client" className="flex flex-col gap-3.5">
      {/* SEARCH */}
      <div data-slot="search-row" className="relative flex items-center">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 size-4 text-ink-muted"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
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
                  active={urlStatus === id}
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
              urlStatus !== "all" && urlStatus !== "completed"
            }
            className="min-w-0 border-l border-border pl-5"
          >
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
              Grade
            </div>
            <div className="flex flex-wrap gap-1.5">
              {GRADE_OPTIONS.map(([id, lbl]) => {
                const dim =
                  urlStatus !== "all" && urlStatus !== "completed";
                return (
                  <Chip
                    key={id}
                    active={urlGrade === id}
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
        <EmptyState
          icon={ClipboardList}
          eyebrow="NO ASSESSMENTS YET"
          title="Capture your first Twenty 20"
          body="Pick a player, run them through the 7 sections, sign off."
          primaryCta={{ label: "New assessment", href: "/manage/t20/new" }}
        />
      ) : !hasFiltered ? (
        <EmptyState
          icon={Search}
          eyebrow="No matches"
          title="No assessments match those filters."
          body="Try a different status or grade combination, or clear the search."
          primaryCta={{ label: "Clear filters", onClick: clearFilters }}
        />
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
