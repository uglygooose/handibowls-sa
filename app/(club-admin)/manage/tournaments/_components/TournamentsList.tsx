"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  LayoutGrid,
  List,
  Plus,
  Search,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { Bowl } from "@/components/brand/Bowl";
import { cn } from "@/lib/utils";

import type {
  TournamentFormat,
  TournamentListRow,
  TournamentStatus,
  TournamentScope,
} from "../_data";
import { ScopeBadge } from "./ScopeBadge";
import { StatusPill, deriveDisplayState } from "./StatusPill";
import { TournamentCard } from "./TournamentCard";

const FORMAT_LABEL: Record<TournamentFormat, string> = {
  singles: "Singles",
  pairs: "Pairs",
  triples: "Triples",
  fours: "Fours",
  mixed_pairs: "Mixed Pairs",
};

const STRUCTURE_LABEL: Record<TournamentListRow["structure"], string> = {
  knockout: "Knockout",
  round_robin: "Round Robin",
  sectional: "Sectional",
  drawn_social: "Drawn / Social",
};

const STATUS_FILTER_OPTIONS: { id: DisplayState; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "open", label: "Open" },
  { id: "entries_closed", label: "Entries Closed" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const FORMAT_FILTER_OPTIONS: { id: TournamentFormat; label: string }[] = [
  { id: "singles", label: "Singles" },
  { id: "pairs", label: "Pairs" },
  { id: "triples", label: "Triples" },
  { id: "fours", label: "Fours" },
  { id: "mixed_pairs", label: "Mixed Pairs" },
];

const SCOPE_FILTER_OPTIONS: { id: TournamentScope | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "club", label: "Club" },
  { id: "district", label: "District" },
  { id: "national", label: "National" },
];

type DisplayState =
  | "draft"
  | "open"
  | "entries_closed"
  | "in_progress"
  | "completed"
  | "cancelled";

type ViewMode = "grid" | "list";

type Props = {
  tournaments: TournamentListRow[];
  clubName: string;
};

export function TournamentsList({ tournaments, clubName }: Props) {
  // URL-state filters — survive reload + are shareable. router.replace
  // (not push) so filter tweaks don't pollute history. Mirrors the Phase-4
  // /platform/clubs pattern.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const initial = useMemo(() => parseFiltersFromUrl(searchParams), [searchParams]);
  const [search, setSearch] = useState(initial.q);
  const [filterStatus, setFilterStatus] = useState<Set<DisplayState>>(initial.status);
  const [filterFormat, setFilterFormat] = useState<Set<TournamentFormat>>(initial.format);
  const [filterScope, setFilterScope] = useState<TournamentScope | "all">(initial.scope);
  const [view, setView] = useState<ViewMode>(initial.view);

  // Push state changes back to the URL (debounced for the search input
  // since it fires on every keystroke). On every render, derive what the
  // URL ought to be and replace iff it differs.
  const writeUrl = useCallback(
    (next: {
      q: string;
      status: Set<DisplayState>;
      format: Set<TournamentFormat>;
      scope: TournamentScope | "all";
      view: ViewMode;
    }) => {
      const params = new URLSearchParams();
      if (next.q.trim()) params.set("q", next.q.trim());
      if (next.status.size > 0) params.set("status", Array.from(next.status).sort().join(","));
      if (next.format.size > 0) params.set("format", Array.from(next.format).sort().join(","));
      if (next.scope !== "all") params.set("scope", next.scope);
      if (next.view !== "grid") params.set("view", next.view);
      const qs = params.toString();
      const target = qs ? `${pathname}?${qs}` : pathname;
      // Avoid no-op replacements that would still trigger React re-renders.
      const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      if (current === target) return;
      startTransition(() => {
        router.replace(target, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  // Debounce the URL sync of `search` so each keystroke doesn't slam
  // history.replaceState. 200ms feels responsive without being noisy.
  useEffect(() => {
    const id = window.setTimeout(() => {
      writeUrl({
        q: search,
        status: filterStatus,
        format: filterFormat,
        scope: filterScope,
        view,
      });
    }, 200);
    return () => window.clearTimeout(id);
  }, [search, filterStatus, filterFormat, filterScope, view, writeUrl]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tournaments.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q)) return false;
      if (filterStatus.size > 0) {
        const display = deriveDisplayState(t);
        if (!filterStatus.has(display)) return false;
      }
      if (filterFormat.size > 0 && !filterFormat.has(t.format)) return false;
      if (filterScope !== "all" && t.scope !== filterScope) return false;
      return true;
    });
  }, [tournaments, search, filterStatus, filterFormat, filterScope]);

  const toggleStatus = (id: DisplayState) =>
    setFilterStatus((prev) => toggleSet(prev, id));
  const toggleFormat = (id: TournamentFormat) =>
    setFilterFormat((prev) => toggleSet(prev, id));

  return (
    <div className="flex flex-col gap-3.5">
      {/* Search */}
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="search"
          placeholder="Search tournaments by name, format, or date…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 w-full rounded-xl border border-border bg-surface pl-11 pr-12 text-sm text-ink placeholder:text-ink-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 inline-flex -translate-y-1/2 items-center rounded-md border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
        >
          /
        </span>
      </div>

      {/* Filter card — 4 groups separated by left-border dividers. */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 rounded-xl border border-border bg-surface p-4">
        <FilterGroup label="Status">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <Chip
                key={opt.id}
                active={filterStatus.has(opt.id)}
                onClick={() => toggleStatus(opt.id)}
              >
                {opt.label}
              </Chip>
            ))}
          </div>
        </FilterGroup>

        <Divider />

        <FilterGroup label="Format">
          <div className="flex flex-wrap gap-1.5">
            {FORMAT_FILTER_OPTIONS.map((opt) => (
              <Chip
                key={opt.id}
                active={filterFormat.has(opt.id)}
                onClick={() => toggleFormat(opt.id)}
              >
                {opt.label}
              </Chip>
            ))}
          </div>
        </FilterGroup>

        <Divider />

        <FilterGroup label="Scope">
          <div className="flex flex-wrap gap-1.5">
            {SCOPE_FILTER_OPTIONS.map((opt) => (
              <Chip
                key={opt.id}
                active={filterScope === opt.id}
                onClick={() => setFilterScope(opt.id)}
              >
                {opt.label}
              </Chip>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="View" className="ml-auto">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={view === "grid"} onClick={() => setView("grid")}>
              <LayoutGrid className="size-3.5" aria-hidden="true" />
              Grid
            </Chip>
            <Chip active={view === "list"} onClick={() => setView("list")}>
              <List className="size-3.5" aria-hidden="true" />
              List
            </Chip>
          </div>
        </FilterGroup>
      </div>

      {/* Result-count row */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          {filtered.length} of {tournaments.length} tournaments
        </div>
        <div className="flex items-center gap-2 text-[13px] text-ink-muted">
          <span>Sort:</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-ink hover:bg-surface-muted"
          >
            Newest first
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Body — empty state, grid, or list. */}
      {filtered.length === 0 ? (
        <EmptyState
          isFiltered={
            search.length > 0 ||
            filterStatus.size > 0 ||
            filterFormat.size > 0 ||
            filterScope !== "all"
          }
          clubName={clubName}
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4">
          {filtered.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      ) : (
        <ListView tournaments={filtered} />
      )}
    </div>
  );
}

// -------------------- url-state parsing --------------------

const STATUS_VALUES: ReadonlySet<DisplayState> = new Set([
  "draft",
  "open",
  "entries_closed",
  "in_progress",
  "completed",
  "cancelled",
]);
const FORMAT_VALUES: ReadonlySet<TournamentFormat> = new Set([
  "singles",
  "pairs",
  "triples",
  "fours",
  "mixed_pairs",
]);
const SCOPE_VALUES: ReadonlySet<TournamentScope> = new Set([
  "club",
  "district",
  "provincial",
  "national",
]);

function parseFiltersFromUrl(sp: ReturnType<typeof useSearchParams>): {
  q: string;
  status: Set<DisplayState>;
  format: Set<TournamentFormat>;
  scope: TournamentScope | "all";
  view: ViewMode;
} {
  const q = sp.get("q") ?? "";
  const statusParam = sp.get("status") ?? "";
  const formatParam = sp.get("format") ?? "";
  const scopeParam = sp.get("scope") ?? "all";
  const viewParam = sp.get("view") ?? "grid";

  const status = new Set(
    statusParam
      .split(",")
      .filter((s): s is DisplayState => STATUS_VALUES.has(s as DisplayState)),
  );
  const format = new Set(
    formatParam
      .split(",")
      .filter((s): s is TournamentFormat => FORMAT_VALUES.has(s as TournamentFormat)),
  );
  const scope: TournamentScope | "all" =
    scopeParam !== "all" && SCOPE_VALUES.has(scopeParam as TournamentScope)
      ? (scopeParam as TournamentScope)
      : "all";
  const view: ViewMode = viewParam === "list" ? "list" : "grid";
  return { q, status, format, scope, view };
}

// -------------------- helpers --------------------

function toggleSet<T>(prev: Set<T>, id: T): Set<T> {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function FilterGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div
      aria-hidden="true"
      className="h-12 w-px self-center bg-border"
    />
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-active={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
        active
          ? "border-primary-500 bg-primary-500 text-[color:var(--color-on-primary)]"
          : "border-border bg-surface text-ink-muted hover:border-ink-subtle hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

// -------------------- list view (TanStack Table — 8 columns) --------------------

function ListView({ tournaments }: { tournaments: TournamentListRow[] }) {
  const columns = useMemo<ColumnDef<TournamentListRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Tournament",
        cell: ({ row }) => (
          <div className="font-display text-[15px] font-bold leading-tight">
            {row.original.name}
          </div>
        ),
      },
      {
        accessorKey: "format",
        header: "Format",
        cell: ({ row }) => (
          <span className="text-ink-muted">
            {FORMAT_LABEL[row.original.format]}
          </span>
        ),
      },
      {
        accessorKey: "structure",
        header: "Structure",
        cell: ({ row }) => (
          <span className="text-ink-muted">
            {STRUCTURE_LABEL[row.original.structure]}
          </span>
        ),
      },
      {
        accessorKey: "scope",
        header: "Scope",
        cell: ({ row }) => <ScopeBadge scope={row.original.scope} />,
      },
      {
        accessorKey: "starts_at",
        header: "Starts",
        cell: ({ row }) => (
          <span className="font-mono text-[12px] tabular-nums text-ink-muted">
            {row.original.starts_at
              ? new Date(row.original.starts_at).toLocaleDateString("en-ZA", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—"}
          </span>
        ),
      },
      {
        id: "entries",
        header: "Entries",
        cell: ({ row }) => (
          <span className="font-mono text-[13px] tabular-nums">
            {row.original.entries_count}
            {row.original.max_entries != null && (
              <span className="text-ink-subtle">
                {" / "}
                {row.original.max_entries}
              </span>
            )}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusPill tournament={row.original} />,
      },
      {
        id: "action",
        header: "",
        cell: ({ row }) => (
          <Link
            href={`/manage/tournaments/${row.original.id}`}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-muted hover:text-ink"
          >
            Manage
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: tournaments,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[920px] border-collapse text-left text-[13px]">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr
              key={hg.id}
              className="border-b border-border bg-surface-muted/40"
            >
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted"
                >
                  {h.isPlaceholder
                    ? null
                    : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              data-testid={`tournament-row-${row.original.id}`}
              className="cursor-pointer border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-muted/40"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------------------- empty state --------------------

function EmptyState({
  isFiltered,
  clubName,
}: {
  isFiltered: boolean;
  clubName: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <Bowl preset="atomic-red" size={120} seed={clubName} emblem={false} />
      <div className="flex flex-col items-center gap-1">
        <h3 className="font-display text-2xl font-black tracking-tight">
          {isFiltered ? "No tournaments match." : "No tournaments yet."}
        </h3>
        <p className="max-w-md text-[13px] text-ink-muted">
          {isFiltered
            ? "Try clearing some filters, or kick off a new one."
            : `${clubName} hasn't run any tournaments yet. Create one to start managing entries, draws, and scoring.`}
        </p>
      </div>
      <Link
        href="/manage/tournaments/new"
        className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary-500 px-5 text-sm font-semibold text-[color:var(--color-on-primary)] shadow-sm hover:bg-primary-600"
      >
        <Plus className="size-4" aria-hidden="true" />
        New Tournament
      </Link>
    </div>
  );
}

// -------------------- icon helper --------------------
// Used by the (currently unused) FormatIcon helper if we surface it later.
// Keeping the lucide imports above stable so future additions don't churn imports.
export const __formatIcons = { User, Users, Calendar };
