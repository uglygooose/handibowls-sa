"use client";

import { ArrowRight, Clock } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { type BookingSlot, purposeLabel } from "../slots";
import { BookingSheet, type Slot } from "./BookingSheet";

// Phase 8e — slot list. Was Server Component in 8e-1; converted to
// Client in 8e-2 because the "Book this slot" CTA now opens a
// bottom-sheet form. The list owns one piece of state (currently
// open slot) so the sheet renders on top of the slot grid + closes
// cleanly via Cancel / submit / overlay-tap.
//
// Visual contract per design source `player-pages.jsx:147-162` +
// `player-styles-additions.css:185-196` is unchanged from 8e-1.

export type Props = {
  slots: BookingSlot[];
  clubName: string;
};

export function SlotList({ slots, clubName }: Props) {
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);

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
    <>
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
            <SlotCard
              key={s.starts_at}
              slot={s}
              onBook={() => setActiveSlot(toSlot(s))}
            />
          ))}
        </div>
      </section>

      {activeSlot && (
        <BookingSheet
          open={Boolean(activeSlot)}
          onOpenChange={(o) => {
            if (!o) setActiveSlot(null);
          }}
          slot={activeSlot}
          clubName={clubName}
        />
      )}
    </>
  );
}

function toSlot(s: BookingSlot): Slot {
  return {
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    starts_label: s.starts_label,
    ends_label: s.ends_label,
  };
}

function SlotCard({
  slot,
  onBook,
}: {
  slot: BookingSlot;
  onBook: () => void;
}) {
  const isFullyBooked = slot.available_rinks.length === 0;
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
          onClick={onBook}
          data-slot="book-cta"
          className={cn(
            "mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary-500 px-3",
            "text-[13px] font-extrabold uppercase tracking-[0.04em] text-on-primary",
            "shadow-sm transition-opacity hover:opacity-90",
          )}
        >
          Book this slot
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </article>
  );
}
