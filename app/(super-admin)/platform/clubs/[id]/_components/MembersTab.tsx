"use client";

import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { ClubMember } from "../_data";

function displayName(m: ClubMember) {
  const full = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
  return full || m.display_name || m.email || m.profile_id;
}

const ROW_HEIGHT = 48;

export function MembersTab({ members }: { members: ClubMember[] }) {
  const [filter, setFilter] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const rows = filter
    ? members.filter((m) => {
        const q = filter.toLowerCase();
        return (
          displayName(m).toLowerCase().includes(q) ||
          (m.email ?? "").toLowerCase().includes(q)
        );
      })
    : members;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-ink-muted">
        No members yet. Invite players from the admin flow once accepted.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-slot="members-tab">
      <div className="flex items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter members…"
          aria-label="Filter members"
          className="max-w-sm"
        />
        <span className="ml-auto text-xs text-ink-muted tabular-nums">
          {rows.length} of {members.length}
        </span>
      </div>
      {/* Phase 13 / 13-1 / commit 11: virtualized div-table → ARIA grid
          pattern (matches MembersTable + EntriesTab). role="grid" on
          the outer wrapper + role="row" + role="columnheader" on header
          + role="rowgroup" + tabIndex={0} on the scroll container +
          role="row" + role="gridcell" on virtualized rows. */}
      <div
        role="grid"
        aria-label="Club members"
        aria-rowcount={rows.length + 1}
        className="rounded-xl border border-border bg-card"
      >
        <div
          role="row"
          className="grid grid-cols-[1.5fr_2fr_8rem_6rem] items-center border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-muted"
        >
          <span role="columnheader">Name</span>
          <span role="columnheader">Email</span>
          <span role="columnheader">Joined</span>
          <span role="columnheader">Status</span>
        </div>
        <div
          ref={scrollRef}
          role="rowgroup"
          tabIndex={0}
          aria-label="Club members table body, scrollable"
          className="max-h-[480px] overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
          data-testid="members-scroll"
        >
          <div
            style={{ height: `${virtualizer.getTotalSize()}px` }}
            className="relative"
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const m = rows[vi.index];
              return (
                <div
                  key={m.profile_id}
                  role="row"
                  data-testid={`member-${m.profile_id}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${vi.start}px)`,
                    height: `${vi.size}px`,
                  }}
                  className={cn(
                    "grid grid-cols-[1.5fr_2fr_8rem_6rem] items-center border-b border-border/50 px-3 text-sm",
                    "hover:bg-muted/50",
                  )}
                >
                  <span role="gridcell" className="truncate font-medium">
                    {displayName(m)}
                    {m.is_primary && (
                      <span className="ml-1 text-xs text-ink-muted">(primary)</span>
                    )}
                  </span>
                  <span role="gridcell" className="truncate text-ink-muted">
                    {m.email ?? "—"}
                  </span>
                  <span role="gridcell" className="tabular-nums text-ink-muted">
                    {new Date(m.joined_at).toLocaleDateString()}
                  </span>
                  <span role="gridcell">
                    <Badge variant={m.status === "active" ? "default" : "outline"}>
                      {m.status}
                    </Badge>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
