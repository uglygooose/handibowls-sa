import { ScrollText } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDateTimeZA } from "@/lib/format/dates";
import { formatRelativeZA } from "@/lib/format/relative";

import type { AuditLogRow } from "../_data";

// Phase 9-3 — read-only audit-log panel for the admin overview.
//
// Server-rendered list of recent admin actions (currently only
// `force_cancel_booking` writes audit rows; future RPCs plug in by
// extending `audit_log_visible_to_admin` per migration 031). Sits
// alongside BookingsCalendarGrid on /manage/overview so admins see
// the cancel they just made appear in the trail without leaving the
// surface.
//
// Read scope is enforced by RLS — the `audit_log_visible_to_admin`
// helper resolves each row's club_id and gates against the caller's
// club_ids. The fetcher additionally narrows by the host club for
// multi-club admins. We render whatever the fetcher returns.
//
// Visual rhythm matches RinkHeatmap / BookingsCalendarGrid — bordered
// surface card, mono-caps headers, color-mix accent on the action
// pill (danger-tinted for cancellations).

const ACTION_LABEL: Record<string, string> = {
  force_cancel_booking: "Force-cancel",
};

type Props = {
  rows: AuditLogRow[];
  /** When true, show "Failed to load" rather than the empty-state. */
  errored?: boolean;
};

export function AuditLogPanel({ rows, errored = false }: Props) {
  return (
    <section
      data-slot="audit-log-panel"
      className="flex flex-col gap-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[18px] font-black uppercase italic tracking-tight">
            Recent admin actions
          </h2>
          <p className="text-[12.5px] text-ink-muted">
            Every admin override writes one row. Newest first.
          </p>
        </div>
        <span
          className="font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-subtle"
          data-slot="audit-row-count"
        >
          {rows.length} {rows.length === 1 ? "entry" : "entries"}
        </span>
      </header>

      <div
        data-slot="audit-log-wrap"
        className="overflow-hidden rounded-[14px] border border-border bg-surface"
      >
        {errored ? (
          <div
            data-slot="audit-log-error"
            className="px-4 py-8 text-center text-[13px] text-ink-muted"
          >
            <ScrollText
              className="mx-auto mb-2 size-5 text-ink-subtle"
              aria-hidden="true"
            />
            Couldn&apos;t load audit log right now. Refresh the page to retry.
          </div>
        ) : rows.length === 0 ? (
          <div
            data-slot="audit-log-empty"
            className="px-4 py-8 text-center text-[13px] text-ink-muted"
          >
            <ScrollText
              className="mx-auto mb-2 size-5 text-ink-subtle"
              aria-hidden="true"
            />
            No admin actions recorded yet — force-cancellations and other
            audited overrides will appear here.
          </div>
        ) : (
          <ul data-slot="audit-log-list" className="divide-y divide-border/60">
            {rows.map((row) => (
              <li
                key={row.id}
                data-slot="audit-log-row"
                data-row-id={row.row_id}
                data-action={row.action}
                className="grid grid-cols-[max-content_1fr_max-content] items-start gap-3 px-4 py-3"
              >
                <span
                  data-slot="audit-action-pill"
                  className={cn(
                    "inline-flex h-6 items-center rounded-md px-2",
                    "font-mono text-[10px] font-bold uppercase tracking-[0.06em]",
                    row.action === "force_cancel_booking"
                      ? "bg-danger-500/12 text-ink"
                      : "bg-surface-muted text-ink-muted",
                  )}
                >
                  {ACTION_LABEL[row.action] ?? row.action}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">
                    <span data-slot="performer-name">
                      {row.performer_name}
                    </span>
                    {row.reason && (
                      <>
                        {" "}
                        <span className="text-ink-muted">— {row.reason}</span>
                      </>
                    )}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-subtle">
                    booking · {row.row_id.slice(0, 8)}
                  </p>
                </div>
                <time
                  data-slot="audit-time"
                  dateTime={row.performed_at}
                  title={formatDateTimeZA(row.performed_at)}
                  className="font-mono text-[11px] tabular-nums text-ink-muted"
                >
                  {formatRelativeZA(row.performed_at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
