import Link from "next/link";

import { cn } from "@/lib/utils";

import type { BookingDate } from "../_data";

// Phase 8e-1 — date carousel. Pure render: each pill is a Link to
// `/book?d=<iso>`, URL drives selection. No client state, no event
// handlers; can stay a Server Component.
//
// Visual contract per design source `player-styles-additions.css:175-183`
// and `player-pages.jsx:130-141`:
//
//   • horizontal scroll, snap-to-pill, no scrollbar
//   • each pill: 56px wide, 8x4 padding, 12-radius, 1.5px border
//   • day-of-week mono caps (10px) above day-number Barlow Condensed
//     (22px, 900 weight)
//   • active pill: ink background + ink-inverse text + ink border
//   • closed pill: 0.4 opacity + tiny "CLOSED" tag in danger-500

export type Props = {
  dates: BookingDate[];
};

export function DateStrip({ dates }: Props) {
  return (
    <section
      data-slot="date-strip"
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-0.5"
      aria-label="Pick a booking date"
    >
      {dates.map((d) => (
        <DatePill key={d.iso} date={d} />
      ))}
    </section>
  );
}

function DatePill({ date }: { date: BookingDate }) {
  const baseClasses = cn(
    "flex shrink-0 w-14 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-center transition-colors",
    "border-[1.5px]",
    date.closed && !date.is_selected && "opacity-40",
  );
  const variantClasses = date.is_selected
    ? "bg-ink text-ink-inverse border-ink"
    : "bg-bone text-ink border-border hover:border-ink/40";

  if (date.closed) {
    // Closed dates render as a non-interactive span — design's `disabled`
    // prevented the click; we skip the Link entirely so the URL can't
    // navigate to a closed date through keyboard either.
    return (
      <span
        aria-disabled="true"
        data-closed="true"
        data-iso={date.iso}
        className={cn(baseClasses, variantClasses, "cursor-not-allowed")}
      >
        <DowDay date={date} />
        <span
          className="font-mono text-[8px] font-bold uppercase tracking-[0.06em] text-danger-500"
          data-slot="off-tag"
        >
          Closed
        </span>
      </span>
    );
  }

  return (
    <Link
      href={`/book?d=${date.iso}`}
      data-iso={date.iso}
      data-selected={date.is_selected}
      aria-current={date.is_selected ? "date" : undefined}
      className={cn(baseClasses, variantClasses)}
    >
      <DowDay date={date} />
    </Link>
  );
}

function DowDay({ date }: { date: BookingDate }) {
  return (
    <>
      <span
        className={cn(
          "font-mono text-[10px] font-bold uppercase tracking-[0.06em]",
          date.is_selected ? "text-ink-inverse/70" : "text-ink-muted",
        )}
        data-slot="dow"
      >
        {date.dow}
      </span>
      <span
        className="font-display text-[22px] font-black leading-none tabular-nums"
        data-slot="day"
      >
        {date.day}
      </span>
    </>
  );
}
