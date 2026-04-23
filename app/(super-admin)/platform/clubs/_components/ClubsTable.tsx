"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { BowlChip } from "@/components/brand/BowlChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  basePath: string;
};

export function ClubsTable({ rows, page, pageSize, total, basePath }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [globalFilter, setGlobalFilter] = useState("");

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
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-3" data-slot="clubs-table">
      <div className="flex items-center gap-2">
        <Input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Filter clubs…"
          aria-label="Filter clubs"
          className="max-w-sm"
        />
        <span className="ml-auto text-xs text-ink-muted tabular-nums">
          {table.getFilteredRowModel().rows.length} of {total}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1 font-medium",
                            canSort && "cursor-pointer select-none",
                          )}
                          disabled={!canSort}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort &&
                            (sorted === "asc" ? (
                              <ArrowUp className="size-3" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="size-3" />
                            ) : (
                              <ArrowUpDown className="size-3 opacity-40" />
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
                  No clubs match.
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
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link
              href={`${basePath}?page=${Math.max(1, page - 1)}`}
              aria-disabled={page <= 1}
              className={cn(page <= 1 && "pointer-events-none opacity-50")}
            >
              Previous
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
            <Link
              href={`${basePath}?page=${Math.min(totalPages, page + 1)}`}
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
