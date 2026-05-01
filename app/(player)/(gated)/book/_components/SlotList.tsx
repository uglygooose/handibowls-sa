"use client";

import { ArrowRight, Clock } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { PlayerSectionHead } from "@/components/layout/PlayerSectionHead";
import { cn } from "@/lib/utils";

import { type BookingSlot, purposeLabel } from "../slots";
import type { Slot } from "./BookingSheet";

// Phase 8e — slot list. Was Server Component in 8e-1; converted to
// Client in 8e-2 because the "Book this slot" CTA now opens a
// bottom-sheet form. The list owns one piece of state (currently
// open slot) so the sheet renders on top of the slot grid + closes
// cleanly via Cancel / submit / overlay-tap.
//
// Visual contract per design source `player-pages.jsx:147-162` +
// `player-styles-additions.css:185-196` is unchanged from 8e-1.
//
// Phase 12 / 12-5: BookingSheet is `next/dynamic({ ssr: false })`-
// loaded so its bundle (form + react-hook-form usage + booking
// action wiring) lives in a separate chunk that only fetches when
// a player taps "Book this slot". /book's initial Client Component
// payload drops accordingly.

const BookingSheet = dynamic(
  () =>
    import("./BookingSheet").then((m) => ({ default: m.BookingSheet })),
  { ssr: false },
);

export type Props = {
  slots: BookingSlot[];
  clubName: string;
  /** Total active rinks at the club. When zero, render the
   *  "no rinks configured" empty state instead of the slot grid —
   *  prevents the Finding 18 rendering where every slot showed
   *  "Booked" because available_rinks could never be non-empty. */
  allRinksCount: number;
};

export function SlotList({ slots, clubName, allRinksCount }: Props) {
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);

  // Phase 8e Finding 18 — distinct empty state for "club has no rinks
  // configured" vs "all rinks booked". Same `available_rinks.length === 0`
  // shape, two semantically different causes; this branch fires when
  // allRinks itself is empty.
  if (allRinksCount === 0) {
    return (
      <section
        data-slot="slot-list-no-rinks"
        className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center"
      >
        <p className="text-[14px] font-bold text-ink">
          No rinks configured at this club yet.
        </p>
        <p className="mt-1 text-[12px] text-ink-muted">
          Ask your club admin to set up the rinks.
        </p>
      </section>
    );
  }

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
        <PlayerSectionHead
          caption={
            <span data-slot="open-count">{openCount} open</span>
          }
        >
          Available slots
        </PlayerSectionHead>

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
