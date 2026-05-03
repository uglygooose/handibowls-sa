"use client";

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

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { DistrictWithCount } from "../_data";

type Props = {
  rows: DistrictWithCount[];
};

export function DistrictsTable({ rows }: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  const columns = useMemo<ColumnDef<DistrictWithCount>[]>(
    () => [
      {
        accessorKey: "name",
        header: "District",
        cell: ({ getValue }) => (
          <span className="font-medium text-ink">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "province",
        header: "Province",
        cell: ({ getValue }) => (
          <span className="text-ink-muted">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "clubs_count",
        header: "Clubs",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue() as number}</span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-3" data-slot="districts-table">
      <div className="flex items-center">
        <span className="ml-auto text-xs text-ink-muted tabular-nums">
          {rows.length} districts
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
                  // Phase 13 / 13-1 / commit 7: same a11y wiring as
                  // ClubsTable — aria-sort on TH, descriptive aria-label
                  // on the sort-toggle button.
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
                <TableCell
                  colSpan={columns.length}
                  className="py-10 text-center text-ink-muted"
                >
                  No districts found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-testid={`district-row-${row.original.id}`}
                >
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
    </div>
  );
}
