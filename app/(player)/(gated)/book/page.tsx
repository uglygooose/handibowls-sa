import { redirect } from "next/navigation";

import { MyBookings } from "@/components/player/MyBookings";
import { getMyBookingsForCurrentPlayer } from "@/lib/bookings/my-bookings";

import { getBookingDataForCurrentPlayer } from "./_data";
import { parseDateParam } from "./slots";
import { DateStrip } from "./_components/DateStrip";
import { SlotList } from "./_components/SlotList";

// Phase 8e-1 — `/book` page shell. Server Component. URL drives
// state via `?d=YYYY-MM-DD`; default = today (Africa/Johannesburg).
//
// Layered scope:
//   • 8e-1 (this round): DateStrip + read-only SlotList. No booking
//     action; "Book this slot" is an inert CTA placeholder.
//   • 8e-2: BookingSheet + createBooking action + GIST race handling.
//   • 8e-3: MyBookings shared component (compact here, full on /me) +
//     cancelBooking via the migration-030 RPC.
//
// Empty-state contract: no host club resolved → render an empty card
// pointing the player at the club-membership flow. The slots-empty
// case (club has no rinks / day fully closed) is handled by SlotList
// itself.

type SearchParams = Promise<{ d?: string }>;

type Props = {
  searchParams: SearchParams;
};

export default async function BookPage({ searchParams }: Props) {
  const { d } = await searchParams;
  const selectedDate = parseDateParam(d);

  // If the URL param was malformed and parseDateParam normalised it,
  // round-trip the URL so the address bar matches state. Avoids the
  // "selected pill differs from URL" inconsistency.
  if (d && d !== selectedDate) {
    redirect(`/book?d=${selectedDate}`);
  }

  const [data, myBookings] = await Promise.all([
    getBookingDataForCurrentPlayer(selectedDate),
    getMyBookingsForCurrentPlayer("compact"),
  ]);

  if (!data) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-5 pb-24">
        <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-ink-muted">
          You&apos;re not a member of any club yet — once a club admin invites
          you, booking opens up.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-5 pb-24">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
          {data.club_name}
        </span>
        <h1 className="font-display text-[28px] font-black uppercase italic tracking-tight">
          Book a rink
        </h1>
      </header>

      <section className="flex flex-col gap-3 rounded-xl bg-surface p-3 shadow-sm">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
          Select a date
        </span>
        <DateStrip dates={data.bookingDates} />
      </section>

      <SlotList slots={data.slotsForDate} clubName={data.club_name} />

      <MyBookings
        rows={myBookings}
        variant="compact"
        heading="Your bookings"
      />
    </main>
  );
}

export const metadata = {
  title: "Book a rink · HandiBowls",
};
