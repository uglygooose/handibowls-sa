"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Ban, Check, Download, MoreHorizontal, Plus, Printer, Search, Sparkles, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import type { EntryRow } from "../../_data";

// Virtualised entries table — 9 columns per design source.
//
//   #1  Checkbox        36px
//   #2  Seed            64px (editable inline; admin can re-seed pre-bracket)
//   #3  Player          avatar + display name
//   #4  Club            muted
//   #5  BSA #           mono / muted
//   #6  Position        muted (always "Skip" today; column carried for v2 multi-position teams)
//   #7  Paid            switch toggle (display-only — payments deferred to v2)
//   #8  Status          pill (Active / Withdrawn / Pending)
//   #9  Action menu     ghost icon
//
// Virtualisation matters at the entries-tab scale: sectional events can
// reach 200–400 entries. Row height is fixed at 56px to keep the
// virtualizer math simple. We render rows into a translated div stack
// inside the scroll container.

const ROW_HEIGHT = 56;
const TABLE_MIN_HEIGHT = 320;
const TABLE_MAX_HEIGHT = 640;

type Props = {
  entries: EntryRow[];
};

export function EntriesTab({ entries }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Inline-seed edits live in component state until the admin commits the
  // batch. Phase 7c-iii's bulk-save action takes the patch object verbatim.
  const [seedEdits, setSeedEdits] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.display_name.toLowerCase().includes(q) ||
        e.club_name.toLowerCase().includes(q) ||
        (e.bsa_number ?? "").toLowerCase().includes(q),
    );
  }, [entries, search]);

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((e) => e.id)));
  };
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {/* Header — title / subtitle + admin actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-black tracking-tight">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </h3>
          <p className="mt-1 text-[13px] text-ink-muted">
            Inline-seed editable until the bracket is generated. Bulk
            actions appear when rows are selected.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ActionButton variant="outline">
            <Download className="size-3.5" /> Export CSV
          </ActionButton>
          <ActionButton variant="outline">
            <Printer className="size-3.5" /> Print roster
          </ActionButton>
          <ActionButton variant="primary">
            <Plus className="size-3.5" /> Add entry
          </ActionButton>
        </div>
      </div>

      {/* Search + secondary action */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="search"
            placeholder="Search by name, club, or BSA number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-surface pl-11 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <ActionButton variant="secondary">
          <Sparkles className="size-3.5" /> Re-seed
        </ActionButton>
      </div>

      {/* Bulk action bar — shows only when rows are selected */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-ink px-4 py-2.5 text-ink-inverse">
          <span className="text-[13px] font-medium">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <BulkButton>
              <Check className="size-3.5" /> Mark paid
            </BulkButton>
            <BulkButton>
              <Ban className="size-3.5" /> Withdraw
            </BulkButton>
            <BulkButton tone="danger">
              <X className="size-3.5" /> Delete
            </BulkButton>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="px-2 text-[12px] font-medium text-ink-inverse/80 hover:text-ink-inverse"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table — virtualised */}
      <EntriesVirtualTable
        rows={filtered}
        selected={selected}
        toggleAll={toggleAll}
        toggleOne={toggleOne}
        allSelected={allSelected}
        someSelected={someSelected}
        seedEdits={seedEdits}
        onSeedEdit={(id, value) =>
          setSeedEdits((prev) => ({ ...prev, [id]: value }))
        }
      />

      <div className="px-1 text-[12px] text-ink-subtle">
        Virtualised · {filtered.length} of {entries.length} rows · TanStack Table
      </div>
    </div>
  );
}

// -------------------- virtual table --------------------

type VirtualProps = {
  rows: EntryRow[];
  selected: Set<string>;
  toggleAll: () => void;
  toggleOne: (id: string) => void;
  allSelected: boolean;
  someSelected: boolean;
  seedEdits: Record<string, string>;
  onSeedEdit: (id: string, value: string) => void;
};

function EntriesVirtualTable({
  rows,
  selected,
  toggleAll,
  toggleOne,
  allSelected,
  someSelected,
  seedEdits,
  onSeedEdit,
}: VirtualProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<EntryRow>[]>(
    () => [
      {
        id: "checkbox",
        header: () => (
          <input
            type="checkbox"
            aria-label="Select all entries"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
            className="size-4 cursor-pointer"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.display_name}`}
            checked={selected.has(row.original.id)}
            onChange={() => toggleOne(row.original.id)}
            className="size-4 cursor-pointer"
          />
        ),
        size: 36,
      },
      {
        id: "seed",
        header: "Seed",
        cell: ({ row }) => {
          const id = row.original.id;
          const value =
            seedEdits[id] ?? (row.original.seed != null ? String(row.original.seed) : "");
          return (
            <input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(e) => onSeedEdit(id, e.target.value)}
              aria-label={`Seed for ${row.original.display_name}`}
              className="h-8 w-12 rounded-md border border-border bg-surface px-1.5 text-center font-mono text-[13px] tabular-nums focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          );
        },
        size: 64,
      },
      {
        id: "player",
        header: "Player",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar name={row.original.display_name} id={row.original.id} />
            <span className="font-semibold">{row.original.display_name}</span>
          </div>
        ),
      },
      {
        id: "club",
        header: "Club",
        cell: ({ row }) => (
          <span className="text-ink-muted">{row.original.club_name}</span>
        ),
      },
      {
        id: "bsa",
        header: "BSA #",
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-ink-muted">
            {row.original.bsa_number ?? "—"}
          </span>
        ),
        size: 100,
      },
      {
        id: "position",
        header: "Position",
        cell: () => <span className="text-[12px] text-ink-muted">Skip</span>,
        size: 80,
      },
      {
        id: "paid",
        header: "Paid",
        cell: ({ row }) => (
          <PaidSwitch
            id={row.original.id}
            checked={row.original.paid_placeholder}
          />
        ),
        size: 64,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.withdrawn ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-warning-500 ring-1 ring-inset ring-warning-500/30">
              Withdrawn
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-success-500 ring-1 ring-inset ring-success-500/30">
              Active
            </span>
          ),
        size: 110,
      },
      {
        id: "menu",
        header: "",
        cell: () => (
          <button
            type="button"
            aria-label="Entry actions"
            className="inline-flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
        ),
        size: 48,
      },
    ],
    [
      allSelected,
      someSelected,
      selected,
      seedEdits,
      onSeedEdit,
      toggleAll,
      toggleOne,
    ],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const totalHeight = virtualizer.getTotalSize();
  const virtualRows = virtualizer.getVirtualItems();
  const dynamicHeight = Math.min(
    Math.max(rows.length * ROW_HEIGHT, TABLE_MIN_HEIGHT),
    TABLE_MAX_HEIGHT,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* Sticky header */}
      <div
        role="row"
        className="grid items-center gap-2 border-b border-border bg-surface-muted/50 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted"
        style={{ gridTemplateColumns: gridTemplate(columns) }}
      >
        {table.getHeaderGroups()[0]!.headers.map((h) => (
          <div key={h.id} role="columnheader">
            {h.isPlaceholder
              ? null
              : flexRender(h.column.columnDef.header, h.getContext())}
          </div>
        ))}
      </div>

      {/* Scrollable virtual body */}
      <div
        ref={scrollRef}
        role="rowgroup"
        className="overflow-y-auto"
        style={{ height: dynamicHeight }}
      >
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 py-12 text-center">
            <p className="text-[13px] text-ink-muted">
              No entries match the current search.
            </p>
          </div>
        ) : (
          <div
            style={{ height: `${totalHeight}px`, position: "relative" }}
          >
            {virtualRows.map((vr) => {
              const row = table.getRowModel().rows[vr.index];
              if (!row) return null;
              const isSelected = selected.has(row.original.id);
              return (
                <div
                  key={row.id}
                  role="row"
                  data-testid={`entry-row-${row.original.id}`}
                  data-selected={isSelected}
                  className={cn(
                    "absolute left-0 right-0 grid items-center gap-2 border-b border-border/60 px-4 text-[13px] last:border-b-0",
                    isSelected ? "bg-primary-500/5" : "hover:bg-surface-muted/40",
                  )}
                  style={{
                    gridTemplateColumns: gridTemplate(columns),
                    height: `${ROW_HEIGHT}px`,
                    transform: `translateY(${vr.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      role="cell"
                      className="flex items-center"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------- helpers --------------------

function gridTemplate(columns: ColumnDef<EntryRow>[]): string {
  return columns
    .map((c) => {
      const w = (c as { size?: number }).size;
      return w ? `${w}px` : "1fr";
    })
    .join(" ");
}

function Avatar({ name, id }: { name: string; id: string }) {
  // Deterministic hue from id so the avatar colour is stable across renders.
  const hue = hashHue(id);
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-7 items-center justify-center rounded-full font-display text-[11px] font-bold text-white"
      style={{ background: `hsl(${hue} 28% 22%)` }}
    >
      {initials || "?"}
    </span>
  );
}

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

function PaidSwitch({ id, checked }: { id: string; checked: boolean }) {
  // Display-only for now — payments wiring deferred to v2 (see drift).
  return (
    <label
      className="relative inline-flex h-5 w-9 cursor-pointer items-center"
      title="Payment tracking coming soon"
      htmlFor={`paid-${id}`}
    >
      <input
        id={`paid-${id}`}
        type="checkbox"
        defaultChecked={checked}
        className="peer sr-only"
        disabled
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-surface-muted ring-1 ring-inset ring-border peer-checked:bg-primary-500"
      />
      <span
        aria-hidden="true"
        className="relative ml-0.5 size-4 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-4"
      />
    </label>
  );
}

function ActionButton({
  variant,
  children,
}: {
  variant: "primary" | "secondary" | "outline";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
        variant === "primary" &&
          "bg-primary-500 text-[color:var(--color-on-primary)] hover:bg-primary-600",
        variant === "secondary" &&
          "border border-border bg-surface-muted text-ink hover:bg-surface-muted/70",
        variant === "outline" &&
          "border border-border bg-surface text-ink hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

function BulkButton({
  tone = "default",
  children,
}: {
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium",
        tone === "danger"
          ? "bg-danger-500 text-[color:var(--color-on-primary)] hover:bg-danger-500/90"
          : "bg-[#1a1a1a] text-ink-inverse hover:bg-[#262626]",
      )}
    >
      {children}
    </button>
  );
}
