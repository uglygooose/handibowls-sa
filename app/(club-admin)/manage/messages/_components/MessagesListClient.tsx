"use client";

import { Filter, Inbox, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { formatDateTimeZA, formatDateZA } from "@/lib/format/dates";
import { cn } from "@/lib/utils";

import type { MessageListRow } from "../_data";

// Phase 11 / 11-3a — Client island for the /manage/messages list.
//
// Five status chips per the brief: All / Draft / Queued / Sent /
// Failed. Search field filters by subject substring (case-
// insensitive) so an admin scanning a long list of broadcasts can
// find one by topic.
//
// Two empty states match the precedent set by /manage/t20:
//   no-data        zero broadcasts at this club → speckled hero
//                  panel with "Compose your first message" CTA
//   no-match       data exists but filters exclude everything →
//                  filter icon + Clear filters CTA
//
// Row rendering favours information density over playful flourish
// — admin surface, not a player surface. Status pill colour-codes
// terminal vs in-flight states; audience scope is rendered inline
// so an admin can scan recipient targeting at a glance.

const STATUS_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["all", "All"],
  ["draft", "Draft"],
  ["queued", "Queued"],
  ["sent", "Sent"],
  ["failed", "Failed"],
] as const;

type StatusFilter = "all" | "draft" | "queued" | "sent" | "failed";

type Props = {
  rows: MessageListRow[];
};

export function MessagesListClient({ rows }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.subject.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
  }

  const hasData = rows.length > 0;
  const hasFiltered = filtered.length > 0;
  const filtersActive =
    search.trim().length > 0 || statusFilter !== "all";

  if (!hasData) {
    return <EmptyDataState />;
  }

  return (
    <div data-slot="messages-list-client" className="flex flex-col gap-3.5">
      {/* SEARCH + FILTER ROW */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by subject…"
            aria-label="Search messages"
            data-slot="messages-search"
            className={cn(
              "h-11 w-full rounded-lg border border-border bg-bone px-3.5 text-[14px]",
              "placeholder:text-ink-muted",
              "focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10",
            )}
          />
        </div>
        <div
          data-slot="messages-status-chips"
          className="flex flex-wrap gap-1.5"
        >
          {STATUS_OPTIONS.map(([id, label]) => {
            const active = statusFilter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setStatusFilter(id as StatusFilter)}
                data-slot="status-chip"
                data-value={id}
                data-active={active}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] transition-colors",
                  active
                    ? "border-ink bg-ink text-ink-inverse"
                    : "cursor-pointer border-border bg-bone text-ink-muted hover:border-ink/40 hover:text-ink",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ROWS / EMPTY-FILTERED */}
      {hasFiltered ? (
        <ul
          data-slot="messages-rows"
          className="flex flex-col gap-2"
        >
          {filtered.map((row) => (
            <MessageRow key={row.id} row={row} />
          ))}
        </ul>
      ) : (
        <EmptyFilteredState
          filtersActive={filtersActive}
          onClearFilters={clearFilters}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Row — single broadcast summary
// ---------------------------------------------------------------------

function MessageRow({ row }: { row: MessageListRow }) {
  const audience = audienceLabel(row);
  const dateLabel = primaryDateLabel(row);
  return (
    <li
      data-slot="message-row"
      data-status={row.status}
      className="rounded-xl border border-border bg-bone px-4 py-3.5 transition-colors hover:border-ink/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={row.status} />
            <span
              data-slot="audience-label"
              className="font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-muted"
            >
              {audience}
            </span>
            <span className="font-mono text-[10.5px] text-ink-subtle">
              · {row.recipient_count}{" "}
              {row.recipient_count === 1 ? "recipient" : "recipients"}
            </span>
          </div>
          <h3
            data-slot="message-subject"
            className="mt-1.5 truncate font-display text-[18px] font-bold italic tracking-tight"
          >
            {row.subject}
          </h3>
          {row.body_preview && (
            <p
              data-slot="message-preview"
              className="mt-0.5 line-clamp-2 text-[13px] text-ink-muted"
            >
              {row.body_preview}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-subtle">
            <span data-slot="message-date">{dateLabel}</span>
            {row.sender_name && (
              <span>· by {row.sender_name}</span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: MessageListRow["status"] }) {
  const styles = {
    draft: { bg: "var(--color-surface-muted)", ink: "var(--color-ink-muted)" },
    queued: { bg: "var(--color-primary-500)", ink: "var(--color-on-primary)" },
    sent: { bg: "var(--color-success-500)", ink: "#ffffff" },
    failed: { bg: "var(--color-danger-500)", ink: "#ffffff" },
  }[status];
  return (
    <span
      data-slot="status-pill"
      data-status={status}
      style={{ backgroundColor: styles.bg, color: styles.ink }}
      className="inline-flex h-5 items-center rounded-full px-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em]"
    >
      {status}
    </span>
  );
}

function audienceLabel(row: MessageListRow): string {
  if (row.audience_kind === "all_members") return "All members";
  if (row.audience_kind === "tournament_entrants") {
    return row.audience_tournament_name
      ? `Tournament · ${row.audience_tournament_name}`
      : "Tournament entrants";
  }
  return `Custom · ${row.audience_custom_count} selected`;
}

function primaryDateLabel(row: MessageListRow): string {
  if (row.status === "sent" && row.sent_at) {
    return `Sent ${formatDateTimeZA(row.sent_at)}`;
  }
  if (row.status === "queued" && row.scheduled_at) {
    return `Scheduled ${formatDateTimeZA(row.scheduled_at)}`;
  }
  if (row.status === "queued") {
    return `Queued ${formatDateTimeZA(row.created_at)}`;
  }
  if (row.status === "failed") {
    return `Failed ${formatDateTimeZA(row.created_at)}`;
  }
  return `Created ${formatDateZA(row.created_at)}`;
}

// ---------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------

function EmptyDataState() {
  return (
    <div
      data-slot="messages-empty-data"
      className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-surface px-8 py-12 text-center"
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        <SpeckleLayer seed="messages-empty" density="med" opacity={0.05} />
      </div>
      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-primary-500/10 text-primary-500"
        >
          <MessageSquare className="size-6" />
        </span>
        <h2 className="font-display text-[24px] font-black italic tracking-tight">
          No broadcasts yet.
        </h2>
        <p className="text-[14px] text-ink-muted">
          Send your members an in-app broadcast — practice reminders,
          tournament announcements, or anything you&rsquo;d normally pin to
          the clubhouse noticeboard.
        </p>
        <Link
          href="/manage/messages/new"
          data-slot="empty-cta"
          className="mt-2 inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary-500 px-5 text-sm font-semibold text-on-primary hover:bg-primary-600"
        >
          Compose your first message
        </Link>
      </div>
    </div>
  );
}

function EmptyFilteredState({
  filtersActive,
  onClearFilters,
}: {
  filtersActive: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div
      data-slot="messages-empty-filtered"
      className="rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center"
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-ink-muted"
        >
          <Inbox className="size-5" />
        </span>
        <h2 className="font-display text-[20px] font-black italic tracking-tight">
          No matches.
        </h2>
        <p className="text-[13px] text-ink-muted">
          {filtersActive
            ? "No broadcasts match the current filter combination."
            : "Nothing here yet."}
        </p>
        {filtersActive && (
          <button
            type="button"
            onClick={onClearFilters}
            data-slot="clear-filters-cta"
            className={cn(
              "mt-1 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-bone px-3 text-sm font-medium text-ink",
              "hover:bg-surface-muted",
            )}
          >
            <Filter className="size-3.5" aria-hidden="true" />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
