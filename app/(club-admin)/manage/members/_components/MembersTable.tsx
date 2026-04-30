"use client";

import { useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { MemberRow, MemberStatus } from "../_data";
import { ResendInviteButton } from "./ResendInviteButton";

type Props = { rows: MemberRow[] };

const ROW_HEIGHT = 52;
const HEADER_GRID = "minmax(180px,1.5fr) minmax(200px,1.7fr) 7rem 7rem 6rem 6rem 5.5rem 7rem 7rem";

const STATUS_LABEL: Record<MemberStatus, string> = {
  active: "Active",
  pending: "Pending",
  expired: "Expired",
};

const STATUS_VARIANT: Record<MemberStatus, "default" | "outline" | "secondary"> = {
  active: "default",
  pending: "secondary",
  expired: "outline",
};

const GRADING_LABEL: Record<string, string> = {
  skip: "Skip",
  third: "Third",
  second: "Second",
  lead: "Lead",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

function startCase(value: string | null): string {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export function MembersTable({ rows }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<MemberRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name ?? row.email,
        header: "Name",
        cell: ({ row }) => (
          <span className="truncate font-medium" data-testid={`member-row-${row.original.rowId}`}>
            {row.original.name ?? <span className="text-ink-muted">—</span>}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue }) => (
          <span className="truncate text-ink-muted">{(getValue() as string) || "—"}</span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-ink-muted">{(getValue() as string | null) ?? "—"}</span>
        ),
      },
      {
        accessorKey: "bsa_number",
        header: "BSA #",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-ink-muted">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "gender",
        header: "Gender",
        cell: ({ getValue }) => (
          <span className="text-ink-muted">{startCase(getValue() as string | null)}</span>
        ),
      },
      {
        accessorKey: "club_grading",
        header: "Grading",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return <span className="text-ink-muted">{v ? GRADING_LABEL[v] : "—"}</span>;
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row, getValue }) => {
          const s = getValue() as MemberStatus;
          const r = row.original;
          // 12-3 / A2: invite rows surface a Resend button next to the
          // status badge. Hidden on email_status='sent' (handled inside
          // the button); visible on null / 'failed' / 'skipped'.
          return (
            <span className="inline-flex items-center">
              <Badge variant={STATUS_VARIANT[s]}>{STATUS_LABEL[s]}</Badge>
              {r.kind === "invite" && r.invite_token && (
                <ResendInviteButton
                  token={r.invite_token}
                  emailStatus={r.invite_email_status}
                  recipientLabel={r.name ?? r.email}
                />
              )}
            </span>
          );
        },
      },
      {
        accessorKey: "novice_until",
        header: "Novice until",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-ink-muted">{formatDate(getValue() as string | null)}</span>
        ),
      },
      {
        accessorKey: "last_active",
        header: "Last active",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-ink-muted">{formatDate(getValue() as string | null)}</span>
        ),
      },
    ],
    [],
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
    getRowId: (row) => row.rowId,
    globalFilterFn: "includesString",
  });

  const visibleRows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  return (
    <div className="flex flex-col gap-3" data-slot="members-table">
      <div className="flex items-center gap-2">
        <Input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Filter members…"
          aria-label="Filter members"
          className="max-w-sm"
        />
        <span className="ml-auto text-xs text-ink-muted tabular-nums">
          {visibleRows.length} of {rows.length}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div
          className="grid items-center border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-muted"
          style={{ gridTemplateColumns: HEADER_GRID }}
        >
          {table.getHeaderGroups()[0].headers.map((header) => {
            const canSort = header.column.getCanSort();
            const sorted = header.column.getIsSorted();
            return (
              <button
                key={header.id}
                type="button"
                onClick={header.column.getToggleSortingHandler()}
                className={cn(
                  "flex items-center gap-1 text-left",
                  canSort && "cursor-pointer select-none hover:text-ink",
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
            );
          })}
        </div>

        {visibleRows.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm text-ink-muted">
            {rows.length === 0 ? "No members yet. Invite a player to get started." : "No members match."}
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="max-h-[640px] overflow-y-auto"
            data-testid="members-scroll"
          >
            <div
              style={{ height: `${virtualizer.getTotalSize()}px` }}
              className="relative"
            >
              {virtualizer.getVirtualItems().map((vi) => {
                const row = visibleRows[vi.index];
                return (
                  <div
                    key={row.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${vi.start}px)`,
                      height: `${vi.size}px`,
                      gridTemplateColumns: HEADER_GRID,
                    }}
                    className="grid items-center gap-x-2 border-b border-border/50 px-3 text-sm hover:bg-muted/40"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div key={cell.id} className="min-w-0">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
