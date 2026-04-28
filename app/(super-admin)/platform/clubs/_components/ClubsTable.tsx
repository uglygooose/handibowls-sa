"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type FilterFn,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";

import { BowlChip } from "@/components/brand/BowlChip";
import { StatusPill } from "@/components/brand/StatusPill";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/layout/EmptyState";
import { FilterChip } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import { THEME_PRESETS, type ThemePreset } from "@/components/brand/theme-presets";
import { cn } from "@/lib/utils";

import type { ClubRow } from "../_data";

type Props = {
  rows: ClubRow[];
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
};

type StatusFilter = "all" | "active" | "inactive";

const NEXT_STATUS: Record<StatusFilter, StatusFilter> = {
  all: "active",
  active: "inactive",
  inactive: "all",
};

const arrayIncludesFilter: FilterFn<ClubRow> = (row, columnId, filterValue) => {
  if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
  return filterValue.includes(row.getValue(columnId));
};

// Pretty-print a theme-preset id ("ocean-green" → "Ocean Green").
function themeLabel(preset: ThemePreset): string {
  return preset
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function ClubsTable({ rows, page, pageSize, total, basePath }: Props) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState<string[]>([]);
  const [themeFilter, setThemeFilter] = useState<ThemePreset[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Defer the values that drive TanStack's filter pipeline so typing into
  // the search input remains responsive while the table recomputes at a
  // lower priority. Without this, every keystroke synchronously re-renders
  // 19 rows × 8 cells × cell-fn JSX before the input's next character
  // paints — perceptible as a freeze on slower devices.
  const deferredGlobalFilter = useDeferredValue(globalFilter);
  const deferredDistrictFilter = useDeferredValue(districtFilter);
  const deferredThemeFilter = useDeferredValue(themeFilter);
  const deferredStatusFilter = useDeferredValue(statusFilter);

  // Memoise the columnFilters array. Passing a fresh array literal as
  // state to TanStack busts its internal slice memoisation and forces the
  // filtered-row-model to recompute on every render — not just when
  // filters change. Reference is stable as long as the deferred filter
  // values are stable.
  const columnFilters = useMemo(
    () => [
      { id: "district", value: deferredDistrictFilter },
      { id: "theme_preset", value: deferredThemeFilter },
      { id: "active", value: deferredStatusFilter },
    ],
    [deferredDistrictFilter, deferredThemeFilter, deferredStatusFilter],
  );

  const districtOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((r) => r.district_name)
            .filter((d): d is string => Boolean(d)),
        ),
      ).sort(),
    [rows],
  );

  const columns = useMemo<ColumnDef<ClubRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Club ↕",
        cell: ({ row }) => (
          <div className="flex flex-col leading-tight">
            <strong
              className="font-semibold text-ink"
              data-testid={`club-row-${row.original.id}`}
            >
              {row.original.name}
            </strong>
            <span className="font-mono text-[11px] tracking-[0.04em] text-ink-subtle">
              {row.original.short_name ?? "—"}
            </span>
          </div>
        ),
      },
      {
        id: "district",
        accessorFn: (row) => row.district_name ?? "",
        header: "District",
        cell: ({ getValue }) => (
          <span className="text-ink-muted">{(getValue() as string) || "—"}</span>
        ),
        filterFn: arrayIncludesFilter,
      },
      {
        accessorKey: "city",
        header: "City",
        cell: ({ getValue }) => <span>{(getValue() as string) || "—"}</span>,
      },
      {
        id: "admin",
        accessorFn: (row) => row.admin_display ?? row.admin_email ?? "",
        header: "Admin",
        cell: ({ row }) => {
          const r = row.original;
          if (!r.admin_display && !r.admin_email) {
            return <span className="text-ink-muted">—</span>;
          }
          const initials = (r.admin_display ?? r.admin_email ?? "")
            .split(/\s+|@/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() ?? "")
            .join("");
          return (
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted font-display text-xs font-bold text-ink">
                {initials || "?"}
              </div>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[13px] font-medium">
                  {r.admin_display ?? r.admin_email}
                </span>
                {r.admin_display && r.admin_email && (
                  <span className="truncate font-mono text-[11px] text-ink-subtle">
                    {r.admin_email}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "members_count",
        header: "Members ↕",
        cell: ({ getValue }) => (
          <span className="font-mono font-semibold tabular-nums">
            {getValue() as number}
          </span>
        ),
      },
      {
        accessorKey: "greens_count",
        header: "Greens",
        cell: ({ getValue }) => (
          <span className="font-mono font-semibold tabular-nums">
            {getValue() as number}
          </span>
        ),
      },
      {
        accessorKey: "theme_preset",
        header: "Theme",
        cell: ({ row }) => <BowlChip preset={row.original.theme_preset} size={28} />,
        filterFn: arrayIncludesFilter,
      },
      {
        accessorKey: "active",
        header: "Status",
        cell: ({ getValue }) => (
          <StatusPill status={(getValue() as boolean) ? "active" : "inactive"} />
        ),
        filterFn: (row, id, value) => {
          if (value === "all" || value == null) return true;
          const want = value === "active";
          return Boolean(row.getValue(id)) === want;
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      globalFilter: deferredGlobalFilter,
      columnFilters,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visibleRows = table.getRowModel().rows;
  const hasActiveFilter =
    districtFilter.length > 0 ||
    themeFilter.length > 0 ||
    statusFilter !== "all" ||
    globalFilter.length > 0;

  const clearFilters = () => {
    setDistrictFilter([]);
    setThemeFilter([]);
    setStatusFilter("all");
    setGlobalFilter("");
  };

  return (
    <div className="flex flex-col gap-4" data-slot="clubs-table">
      {/* Big search input per design — 52px tall, magnifying glass on the
          left, full-width. */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-subtle"
          aria-hidden="true"
        />
        <Input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search clubs by name, district, or admin..."
          aria-label="Search clubs"
          className="h-13 rounded-[12px] border-[1.5px] border-border bg-bone pl-12 text-[15px] focus-visible:border-primary-500"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <FilterChip active={districtFilter.length > 0} count={districtFilter.length}>
              <Filter className="size-3.5" aria-hidden="true" />
              District
            </FilterChip>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-80 w-72 overflow-y-auto"
          >
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
              Filter by district
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {districtOptions.length === 0 && (
              <div className="px-3 py-4 text-xs text-ink-subtle">
                No districts in the visible page.
              </div>
            )}
            {districtOptions.map((district) => (
              <DropdownMenuCheckboxItem
                key={district}
                checked={districtFilter.includes(district)}
                onCheckedChange={(checked) =>
                  setDistrictFilter((prev) =>
                    checked
                      ? [...prev, district]
                      : prev.filter((d) => d !== district),
                  )
                }
                onSelect={(e) => e.preventDefault()}
              >
                {district}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <FilterChip
          active={statusFilter !== "all"}
          onClick={() => setStatusFilter((s) => NEXT_STATUS[s])}
        >
          Status: {statusFilter}
        </FilterChip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <FilterChip active={themeFilter.length > 0} count={themeFilter.length}>
              <Filter className="size-3.5" aria-hidden="true" />
              Theme
            </FilterChip>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
              Filter by theme
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {THEME_PRESETS.map((preset) => (
              <DropdownMenuCheckboxItem
                key={preset}
                checked={themeFilter.includes(preset)}
                onCheckedChange={(checked) =>
                  setThemeFilter((prev) =>
                    checked
                      ? [...prev, preset]
                      : prev.filter((t) => t !== preset),
                  )
                }
                onSelect={(e) => e.preventDefault()}
                className="gap-2"
              >
                <BowlChip preset={preset} size={20} />
                <span>{themeLabel(preset)}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasActiveFilter && (
          <FilterChip variant="dashed" onClick={clearFilters}>
            <X className="size-3.5" aria-hidden="true" />
            Clear
          </FilterChip>
        )}
      </div>

      {/* Table or empty state */}
      {visibleRows.length === 0 ? (
        <EmptyState
          title="No clubs match."
          description={
            <>
              Try a different search or{" "}
              <button
                type="button"
                onClick={clearFilters}
                className="font-medium text-ink underline underline-offset-2 hover:text-primary-500"
              >
                clear filters
              </button>
              .
            </>
          }
          bowlPreset="atomic-red"
          idSuffix="clubs-empty"
        />
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-border bg-bone">
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        className={cn(
                          "border-b border-border bg-surface px-4 py-3.5 text-left",
                          "font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-subtle",
                          canSort && "cursor-pointer select-none hover:text-ink",
                        )}
                        onClick={
                          canSort
                            ? header.column.getToggleSortingHandler()
                            : undefined
                        }
                      >
                        {header.isPlaceholder ? null : (
                          <span className="inline-flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {canSort &&
                              (sorted === "asc" ? (
                                <ArrowUp className="size-3" aria-hidden="true" />
                              ) : sorted === "desc" ? (
                                <ArrowDown className="size-3" aria-hidden="true" />
                              ) : (
                                <ArrowUpDown
                                  className="size-3 opacity-40"
                                  aria-hidden="true"
                                />
                              ))}
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  data-testid={`row-${row.original.id}`}
                  onClick={() => router.push(`${basePath}/${row.original.id}`)}
                  className={cn(
                    "h-16 cursor-pointer border-b border-border transition-colors",
                    "hover:bg-[rgba(215,38,30,0.04)]",
                    "last:border-b-0",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3.5 align-middle text-sm"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination row per design */}
          <div className="flex items-center justify-between border-t border-border bg-surface px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-subtle">
            <span>
              Showing {(page - 1) * pageSize + 1}–{(page - 1) * pageSize + visibleRows.length}{" "}
              of {total}
            </span>
            <div className="flex gap-1">
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={page <= 1}
                className="size-8 rounded-md p-0"
              >
                <Link
                  href={`${basePath}?page=${Math.max(1, page - 1)}`}
                  aria-label="Previous page"
                  aria-disabled={page <= 1}
                  className={cn(page <= 1 && "pointer-events-none opacity-50")}
                >
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                className="size-8 rounded-md p-0"
              >
                <Link
                  href={`${basePath}?page=${Math.min(totalPages, page + 1)}`}
                  aria-label="Next page"
                  aria-disabled={page >= totalPages}
                  className={cn(
                    page >= totalPages && "pointer-events-none opacity-50",
                  )}
                >
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

