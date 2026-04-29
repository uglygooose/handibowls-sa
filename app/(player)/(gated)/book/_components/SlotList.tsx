import { ArrowRight, Clock } from "lucide-react";

import { cn } from "@/lib/utils";

import type { BookingSlot } from "../_data";
import { purposeLabel } from "../_data";

// Phase 8e-1 — read-only slot list. Renders the day's five 2-hour
// blocks per design source `player-pages.jsx:147-162`:
//
//   • slot card with time row (mono, 16px) + rink chips
//   • "Book this slot" CTA appears only when at least one rink is
//     available
//   • fully-booked slots render dimmed with "BOOKED · <purpose>"
//
// "Book this slot" is a Phase 8e-2 hand-off — it stays disabled and
// inert in this round so the read-only flow ships first. The button
// preserves visual rhythm so the page doesn't reflow when 8e-2
// wires the BookingSheet.

export type Props = {
  slots: BookingSlot[];
};

export function SlotList({ slots }: Props) {
  if (slots.length === 0) {
    return (
      <div
        data-slot="slot-list-empty"
        className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-[13px] text-ink-muted"
      >
        No slots available — date may be closed for bookings.
      </div>
    );
  }

  const openCount = slots.filter((s) => s.available_rinks.length > 0).length;

  return (
    <section data-slot="slot-list">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-[18px] font-black uppercase italic tracking-tight">
          Available slots
        </h3>
        <span
          data-slot="open-count"
          className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted"
        >
          {openCount} open
        </span>
      </header>

      <div className="flex flex-col gap-2">
        {slots.map((s) => (
          <SlotCard key={s.starts_at} slot={s} />
        ))}
      </div>
    </section>
  );
}

function SlotCard({ slot }: { slot: BookingSlot }) {
  const isFullyBooked = slot.available_rinks.length === 0;
  // For fully-booked slots, surface the FIRST booking's purpose (design
  // shows just one label even when multiple bookings overlap). Falls
  // back to "Booked" when somehow a slot is fully booked but the
  // bookings_in_slot list is empty (shouldn't happen — defensive).
  const firstBooking = slot.bookings_in_slot[0];

  return (
    <article
      data-slot="slot-card"
      data-fully-booked={isFullyBooked}
      data-starts-at={slot.starts_at}
      className={cn(
        "rounded-xl border border-border bg-bone p-3",
        isFullyBooked && "bg-surface-muted opacity-70",
      )}
    >
      <div
        data-slot="slot-time"
        className="mb-2 flex items-center gap-2 font-mono text-[16px] font-extrabold tabular-nums text-ink"
      >
        <Clock className="size-3.5" aria-hidden="true" />
        <span>
          {slot.starts_label} – {slot.ends_label}
        </span>
      </div>

      <div data-slot="slot-rinks" className="flex flex-wrap items-center gap-1.5">
        {isFullyBooked ? (
          <span
            data-slot="booked-tag"
            className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted"
          >
            Booked
            {firstBooking && ` · ${purposeLabel(firstBooking.purpose)}`}
          </span>
        ) : (
          slot.available_rinks.map((r) => (
            <span
              key={r.id}
              data-slot="rink-chip"
              className="rounded-md bg-primary-500/12 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.04em] text-primary-600"
            >
              {r.label}
            </span>
          ))
        )}
      </div>

      {!isFullyBooked && (
        <button
          type="button"
          disabled
          data-slot="book-cta"
          aria-disabled="true"
          title="Booking opens in the next checkpoint"
          className={cn(
            "mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary-500 px-3",
            "text-[13px] font-extrabold uppercase tracking-[0.04em] text-on-primary",
            "shadow-sm transition-opacity",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          Book this slot
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </article>
  );
}
