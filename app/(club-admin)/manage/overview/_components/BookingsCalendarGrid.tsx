"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import type { BookingCalendarRow } from "../_data";
import {
  CALENDAR_DAYS,
  CALENDAR_DAY_LABELS,
  CALENDAR_HOURS,
  sastHourOf,
  sastIsoDateOf,
  shiftIso,
  shortDayLabel,
  todayIsoSAST,
  weekDateRange,
} from "../week";

import { BookingDetailSheet } from "./BookingDetailSheet";

// Phase 9-2 — `/manage/overview` Bookings tab calendar.
//
// 7-col (Mon..Sun SAST) × 16-row (06:00..21:00) grid. Bookings are
// keyed by `${sastDate}__${sastHour}` so multi-rink bookings at the
// same hour stack vertically inside their cell. Cancelled bookings
// render with a muted strike-through chip — admin ops want them
// visible (audit trail), not removed.
//
// Tap a chip → BookingDetailSheet opens with the row + force-cancel
// form. The sheet is lifted to this component so multiple chips share
// one sheet instance (cleaner than per-chip render).

type Props = {
  bookings: BookingCalendarRow[];
  mondayIso: string;
  clubName: string;
};

const PURPOSE_LABEL: Record<BookingCalendarRow["purpose"], string> = {
  roll_up: "Roll-up",
  practice: "Practice",
  coaching: "Coaching",
  match: "Match",
  social: "Social",
  t20_assessment: "Twenty 20 assessment",
};

export function BookingsCalendarGrid({
  bookings,
  mondayIso,
  clubName,
}: Props) {
  const [selected, setSelected] = useState<BookingCalendarRow | null>(null);

  const dates = useMemo(() => weekDateRange(mondayIso), [mondayIso]);
  const todayIso = todayIsoSAST();

  // Group bookings into a cell map. Key shape: `${dateIso}__${hour}`.
  // A booking spans every hour cell its [starts_at, ends_at) overlaps.
  // For Phase 9-2 we render the booking once at its starts_at hour
  // only — the chip carries the time range textually, so duplicating
  // it across rows would just clutter the grid. Multi-hour spans are
  // legible from the chip's "06:00–08:00" sub-text.
  const cellMap = useMemo(() => {
    const map = new Map<string, BookingCalendarRow[]>();
    for (const b of bookings) {
      const date = sastIsoDateOf(b.starts_at);
      const hour = sastHourOf(b.starts_at);
      // Bookings outside our display range are ignored — they exist
      // (e.g. a 22:30 social booking) but the grid stops at 21:00 to
      // match the editor's display window.
      if (hour < CALENDAR_HOURS[0] || hour > CALENDAR_HOURS[CALENDAR_HOURS.length - 1]) {
        continue;
      }
      const key = `${date}__${hour}`;
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    return map;
  }, [bookings]);

  const prevWeek = shiftIso(mondayIso, -7);
  const nextWeek = shiftIso(mondayIso, 7);
  const todayWeek = todayIso; // page handler snaps to Monday-of via parseWeekParam

  const totalBooked = bookings.filter((b) => b.status === "booked").length;
  const totalCancelled = bookings.filter((b) => b.status === "cancelled").length;

  return (
    <section
      data-slot="bookings-calendar"
      data-monday={mondayIso}
      className="flex flex-col gap-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[18px] font-black uppercase italic tracking-tight">
            Bookings
          </h2>
          <p className="text-[12.5px] text-ink-muted">
            Week of {shortDayLabel(mondayIso)} – {shortDayLabel(shiftIso(mondayIso, 6))}
            {" · "}
            <span
              className="font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-subtle"
              data-slot="booking-totals"
            >
              {totalBooked} booked · {totalCancelled} cancelled
            </span>
          </p>
        </div>
        <nav
          aria-label="Week navigation"
          data-slot="week-nav"
          className="flex items-center gap-1.5"
        >
          <Link
            href={`/manage/overview?w=${prevWeek}`}
            data-slot="week-prev"
            data-week={prevWeek}
            aria-label="Previous week"
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-bone px-2.5",
              "text-[12px] font-extrabold uppercase tracking-[0.04em] text-ink",
              "hover:bg-surface-muted",
            )}
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Prev
          </Link>
          <Link
            href={`/manage/overview?w=${todayWeek}`}
            data-slot="week-today"
            className={cn(
              "inline-flex h-9 items-center rounded-lg border border-border bg-bone px-3",
              "text-[12px] font-extrabold uppercase tracking-[0.04em] text-ink",
              "hover:bg-surface-muted",
            )}
          >
            Today
          </Link>
          <Link
            href={`/manage/overview?w=${nextWeek}`}
            data-slot="week-next"
            data-week={nextWeek}
            aria-label="Next week"
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-bone px-2.5",
              "text-[12px] font-extrabold uppercase tracking-[0.04em] text-ink",
              "hover:bg-surface-muted",
            )}
          >
            Next
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <div
        data-slot="bookings-grid-wrap"
        className="overflow-x-auto rounded-xl border border-border bg-surface"
      >
        <table
          className="w-full min-w-[860px] border-collapse text-left text-[13px]"
          data-slot="bookings-grid"
        >
          <thead>
            <tr className="border-b border-border bg-surface-muted/50">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-surface-muted/50 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted"
              >
                Time
              </th>
              {CALENDAR_DAYS.map((dow, i) => {
                const dateIso = dates[i];
                const isToday = dateIso === todayIso;
                return (
                  <th
                    key={dow}
                    scope="col"
                    data-slot="day-header"
                    data-date={dateIso}
                    data-today={isToday ? "true" : "false"}
                    className={cn(
                      "px-2 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.16em]",
                      isToday ? "text-primary-600" : "text-ink-muted",
                    )}
                  >
                    <div>{CALENDAR_DAY_LABELS[i]}</div>
                    <div className="mt-0.5 font-display text-[11px] font-extrabold not-italic tracking-tight text-ink">
                      {dateIso.slice(8, 10)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {CALENDAR_HOURS.map((hour) => (
              <tr
                key={hour}
                className="border-b border-border/60 last:border-b-0"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-bone px-3 py-2 font-mono text-[11px] font-semibold tabular-nums text-ink-muted"
                >
                  {pad2(hour)}:00
                </th>
                {CALENDAR_DAYS.map((dow, i) => {
                  const dateIso = dates[i];
                  const key = `${dateIso}__${hour}`;
                  const cellBookings = cellMap.get(key) ?? [];
                  return (
                    <td
                      key={dow}
                      data-slot="bookings-cell"
                      data-date={dateIso}
                      data-hour={hour}
                      data-count={cellBookings.length}
                      className="border-l border-border/60 align-top"
                    >
                      {cellBookings.length === 0 ? (
                        <div className="h-12" />
                      ) : (
                        <div className="flex flex-col gap-1 p-1">
                          {cellBookings.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              data-slot="booking-chip"
                              data-booking-id={b.id}
                              data-status={b.status}
                              onClick={() => setSelected(b)}
                              className={cn(
                                "flex flex-col gap-0.5 rounded-md border px-1.5 py-1 text-left",
                                "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
                                b.status === "cancelled"
                                  ? "border-danger-500/40 bg-danger-500/8 text-ink-muted"
                                  : "border-primary-500/40 bg-primary-500/12 text-ink",
                              )}
                            >
                              <span
                                className={cn(
                                  "font-mono text-[9.5px] font-bold uppercase tracking-[0.06em]",
                                  b.status === "cancelled"
                                    ? "text-ink line-through"
                                    : "text-primary-600",
                                )}
                              >
                                {PURPOSE_LABEL[b.purpose]} · {b.rink_label}
                              </span>
                              <span
                                className={cn(
                                  "truncate text-[11.5px] font-medium",
                                  b.status === "cancelled" && "line-through",
                                )}
                              >
                                {b.booker_name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
        {clubName} · times in SAST · cancelled bookings shown for audit visibility.
      </p>

      <BookingDetailSheet
        booking={selected}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
