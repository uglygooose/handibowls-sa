"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { BowlChip } from "@/components/brand/BowlChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ClubRow } from "../_data";

type Props = {
  rows: ClubRow[];
  page: number;
  pageSize: number;
  total: number;
  q: string;
  basePath: string;
};

// Phase 12 / 12-7: search input lives in `<ClubsSearchBar>` (sibling
// component, URL-driven). The table no longer maintains a client-side
// `globalFilter` — `rows` is the already-filtered + paginated set per
// the URL's `q` + `page`. Server-side filter scales to the full clubs
// dataset; pre-12-7 the `globalFilter` only matched rows on the active
// page.

export function ClubsTable({ rows, page, pageSize, total, q, basePath }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);

  const columns = useMemo<ColumnDef<ClubRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link
            href={`${basePath}/${row.original.id}`}
            className="font-medium text-ink hover:underline"
            data-testid={`club-row-${row.original.id}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "district_name",
        header: "District",
        cell: ({ getValue }) => (
          <span className="text-ink-muted">{(getValue() as string | null) ?? "—"}</span>
        ),
      },
      { accessorKey: "city", header: "City" },
      {
        id: "admin",
        header: "Admin",
        accessorFn: (row) => row.admin_display ?? row.admin_email ?? "",
        cell: ({ row }) => {
          const r = row.original;
          if (!r.admin_display && !r.admin_email) {
            return <span className="text-ink-muted">—</span>;
          }
          return (
            <div className="flex flex-col leading-tight">
              <span>{r.admin_display ?? r.admin_email}</span>
              {r.admin_display && r.admin_email && (
                <span className="text-xs text-ink-muted">{r.admin_email}</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "members_count",
        header: "Members",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "greens_count",
        header: "Greens",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "theme_preset",
        header: "Theme",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <BowlChip preset={row.original.theme_preset} size={24} />
            <span className="text-xs text-ink-muted">{row.original.theme_preset}</span>
          </div>
        ),
      },
      {
        accessorKey: "active",
        header: "Active",
        cell: ({ getValue }) => {
          const v = getValue() as boolean;
          return (
            <Badge variant={v ? "default" : "outline"}>
              {v ? "Active" : "Archived"}
            </Badge>
          );
        },
        filterFn: (row, id, value) => {
          if (value === "all" || value == null) return true;
          return String(row.getValue(id)) === String(value);
        },
      },
    ],
    [basePath],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className="flex flex-col gap-3" data-slot="clubs-table">
      <div className="flex items-center justify-end">
        <span className="text-xs text-ink-muted tabular-nums">
          {q ? `${rows.length} match · ${total} total` : `${total} clubs`}
        </span>
      </div>

      <div className="rounded-[14px] border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  // Phase 13 / 13-1 / commit 7: aria-sort on the TH + a
                  // descriptive aria-label on the sort-toggle button so SR
                  // users discover both the current sort state and the
                  // action the button will perform on click.
                  const ariaSort: "ascending" | "descending" | "none" | undefined =
                    canSort
                      ? sorted === "asc"
                        ? "ascending"
                        : sorted === "desc"
                          ? "descending"
                          : "none"
                      : undefined;
                  const headerLabel = header.isPlaceholder
                    ? ""
                    : String(
                        typeof header.column.columnDef.header === "string"
                          ? header.column.columnDef.header
                          : header.column.id,
                      );
                  const nextSort = sorted === "asc" ? "descending" : "ascending";
                  return (
                    <TableHead key={header.id} aria-sort={ariaSort}>
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          aria-label={
                            canSort
                              ? `Sort by ${headerLabel}, ${nextSort}`
                              : undefined
                          }
                          className={cn(
                            "inline-flex items-center gap-1 font-medium",
                            canSort && "cursor-pointer select-none",
                          )}
                          disabled={!canSort}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort &&
                            (sorted === "asc" ? (
                              <ArrowUp className="size-3" aria-hidden="true" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="size-3" aria-hidden="true" />
                            ) : (
                              <ArrowUpDown className="size-3 opacity-40" aria-hidden="true" />
                            ))}
                        </button>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-ink-muted">
                  {q ? `No clubs match “${q}”.` : "No clubs."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-testid={`row-${row.original.id}`}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-muted">
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          {/* Phase 13 / 13-1 / commit 7: aria-label includes page-context
              ("Previous page (Page X of Y)") so SR users get the sequence
              state without having to read the sibling "Page X of Y" span. */}
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link
              href={pageHref(Math.max(1, page - 1))}
              aria-label={`Previous page (Page ${page} of ${totalPages})`}
              aria-disabled={page <= 1}
              className={cn(page <= 1 && "pointer-events-none opacity-50")}
            >
              Previous
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
            <Link
              href={pageHref(Math.min(totalPages, page + 1))}
              aria-label={`Next page (Page ${page} of ${totalPages})`}
              aria-disabled={page >= totalPages}
              className={cn(page >= totalPages && "pointer-events-none opacity-50")}
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
