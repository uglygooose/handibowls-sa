"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";

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
        header: "District ↕",
        cell: ({ getValue, row }) => (
          <strong
            className="font-semibold text-ink"
            data-testid={`district-name-${row.original.id}`}
          >
            {getValue() as string}
          </strong>
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
          <span className="font-mono font-semibold tabular-nums">
            {getValue() as number}
          </span>
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

  const visibleRows = table.getRowModel().rows;

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-bone" data-slot="districts-table">
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
          {visibleRows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-sm text-ink-muted"
              >
                No districts found.
              </td>
            </tr>
          ) : (
            visibleRows.map((row) => (
              <tr
                key={row.id}
                data-testid={`district-row-${row.original.id}`}
                className="h-16 border-b border-border last:border-b-0 hover:bg-[rgba(215,38,30,0.04)]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3.5 align-middle text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
