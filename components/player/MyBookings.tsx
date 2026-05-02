"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelBooking } from "@/app/(player)/(gated)/book/_actions";
import {
  type MyBookingRow,
  purposeLabel,
} from "@/app/(player)/(gated)/book/slots";
import { cn } from "@/lib/utils";

// Phase 8e-3 — shared MyBookings component used by /book (compact)
// and /me (full). Single rendering contract; the variant only
// affects how many rows the data layer returns. Cancel button hits
// the cancelBooking server action which wraps the migration-030
// cancel_own_booking RPC; result-kind mapping mirrors the
// BookingSheet pattern.

export type Variant = "compact" | "full";

type Props = {
  rows: MyBookingRow[];
  variant: Variant;
  /** Heading rendered above the list. Different copy on /book vs
   *  /me — caller passes the right one. */
  heading?: string;
};

export function MyBookings({ rows, variant, heading }: Props) {
  if (rows.length === 0) {
    return (
      <section data-slot="my-bookings" data-variant={variant}>
        {heading && <SectionHead title={heading} />}
        <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-center text-[13px] text-ink-muted">
          No bookings yet — pick a slot from the date strip above to get
          started.
        </div>
      </section>
    );
  }

  return (
    <section data-slot="my-bookings" data-variant={variant}>
      {heading && <SectionHead title={heading} />}
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <BookingRow key={row.id} row={row} />
        ))}
      </ul>
    </section>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <h2 className="mb-3 font-display text-[13px] font-bold uppercase tracking-[0.12em] text-ink-muted">
      {title}
    </h2>
  );
}

function BookingRow({ row }: { row: MyBookingRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Local "did this row submit a cancel" — the page-level revalidate
  // refreshes the list, but in the meantime the button stays
  // disabled to prevent double-tap.
  const [submitted, setSubmitted] = useState(false);

  function onCancel() {
    setSubmitted(true);
    startTransition(async () => {
      const result = await cancelBooking({ booking_id: row.id });
      switch (result.kind) {
        case "ok":
          toast.success("Booking cancelled.");
          router.refresh();
          return;
        case "too_close_to_start":
          toast.error("Too close to start — cancellations cut off 2h before.");
          // The 2h gate flipped between render and submit. Refresh so
          // the button reflects the truth.
          router.refresh();
          return;
        case "wrong_state":
          toast.error("This booking is already cancelled.");
          router.refresh();
          return;
        case "not_owner":
          // Defensive — should never fire because the data fetcher
          // scopes by booked_by. If it does, refresh + toast.
          toast.error("Not your booking.");
          router.refresh();
          return;
        case "not_found":
          toast.error("Booking not found — it may already be removed.");
          router.refresh();
          return;
        case "validation":
        case "auth":
        case "error":
          toast.error(result.error);
          // Don't refresh — surface the error and let the player retry.
          setSubmitted(false);
          return;
      }
    });
  }

  return (
    <li
      data-slot="booking-row"
      data-booking-id={row.id}
      data-past={row.is_past}
      className={cn(
        "rounded-xl border border-l-4 border-border bg-bone p-3",
        row.is_past
          ? "border-l-border opacity-60"
          : "border-l-primary-500",
      )}
    >
      <div
        data-slot="when-label"
        className="mb-1.5 text-[14px] font-extrabold text-ink"
      >
        {row.when_label}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          data-slot="rink-pill"
          className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.04em] text-ink"
        >
          {row.rink_label}
        </span>
        <span
          data-slot="purpose-pill"
          className="rounded-md bg-info-500/12 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.04em] text-ink"
        >
          {purposeLabel(row.purpose)}
        </span>
        {row.party_size != null && (
          <span
            data-slot="party-meta"
            className="font-mono text-[11px] font-bold uppercase tracking-[0.04em] text-ink-muted"
          >
            · {row.party_size} bowlers
          </span>
        )}
        {row.status === "cancelled" && (
          <span
            data-slot="cancelled-pill"
            className="rounded-md bg-danger-500/12 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-ink"
          >
            Cancelled
          </span>
        )}
      </div>

      {row.cancellable && (
        <button
          type="button"
          onClick={onCancel}
          disabled={pending || submitted}
          data-slot="cancel-cta"
          className={cn(
            "mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-bone px-3",
            "text-[12px] font-extrabold uppercase tracking-[0.04em] text-ink",
            "hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {(pending || submitted) && (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          )}
          Cancel
        </button>
      )}
    </li>
  );
}
