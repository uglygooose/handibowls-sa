"use client";

import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { BottomSheet } from "@/components/player/BottomSheet";
import { cn } from "@/lib/utils";
import {
  formatDateLongZA,
  formatTimeZA,
} from "@/lib/format/dates";

import { adminForceCancelBooking } from "../_actions";
import type { BookingCalendarRow } from "../_data";

// Phase 9-2 — booking-detail bottom sheet with admin force-cancel.
//
// Two render modes:
//   • status='booked' → metadata + force-cancel form
//   • status='cancelled' → metadata + "already cancelled" notice
//
// Reason textarea required (z.string().trim().min(1).max(500)). The
// action returns a discriminated union; routing per kind:
//   ok               → toast.success + close + router.refresh
//   not_found        → toast.error + close + refresh (gone — page is stale)
//   wrong_state      → toast.error + close + refresh (already cancelled)
//   wrong_club       → toast.error (RLS guard fired — leave open)
//   insufficient_role/auth → toast.error (close — caller can re-auth)
//   reason_required  → inline error in the form, leave open
//   validation/error → inline error, leave open
//
// router.refresh() pulls the new server state (revalidatePath happens
// inside the action), so the calendar repaints with the cancelled
// chip without a full reload.

const PURPOSE_LABEL: Record<BookingCalendarRow["purpose"], string> = {
  roll_up: "Roll-up",
  practice: "Practice",
  coaching: "Coaching",
  match: "Match",
  social: "Social",
  t20_assessment: "Twenty 20 assessment",
};

type Props = {
  booking: BookingCalendarRow | null;
  onClose: () => void;
};

export function BookingDetailSheet({ booking, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  // Reset form whenever the sheet opens for a new booking — otherwise
  // the prior reason persists across selections. Setting state during
  // render (with a tracked key) is the React-recommended pattern over
  // useEffect for "reset on prop change" — it avoids the wasted render
  // pass and silences `react-hooks/incompatible-library` for cascading
  // setState in effects.
  const [lastBookingId, setLastBookingId] = useState<string | null>(
    booking?.id ?? null,
  );
  if (booking && booking.id !== lastBookingId) {
    setLastBookingId(booking.id);
    setReason("");
    setReasonError(null);
  }

  function handleOpenChange(open: boolean) {
    if (!open) onClose();
  }

  function submitCancel() {
    if (!booking) return;
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setReasonError("Reason is required when cancelling a booking.");
      return;
    }
    if (trimmed.length > 500) {
      setReasonError("Reason must be 500 characters or fewer.");
      return;
    }
    setReasonError(null);
    startTransition(async () => {
      const result = await adminForceCancelBooking({
        booking_id: booking.id,
        reason: trimmed,
      });
      if (result.kind === "ok") {
        toast.success(`Booking cancelled.`, {
          description: `${PURPOSE_LABEL[booking.purpose]} · ${booking.rink_label} · ${formatTimeZA(booking.starts_at)}`,
        });
        onClose();
        router.refresh();
        return;
      }
      if (result.kind === "not_found" || result.kind === "wrong_state") {
        toast.error(
          result.kind === "not_found"
            ? "Booking no longer exists — refreshing."
            : "That booking is already cancelled — refreshing.",
        );
        onClose();
        router.refresh();
        return;
      }
      if (result.kind === "reason_required") {
        setReasonError("Reason is required when cancelling a booking.");
        return;
      }
      if (result.kind === "wrong_club") {
        toast.error("That booking belongs to a different club.");
        return;
      }
      if (result.kind === "insufficient_role" || result.kind === "auth") {
        toast.error("You don't have permission to cancel this booking.");
        onClose();
        return;
      }
      // validation | error
      toast.error(result.error || "Cancel failed.");
    });
  }

  const open = booking !== null;
  const canCancel = booking?.status === "booked";

  return (
    <BottomSheet open={open} onOpenChange={handleOpenChange}>
      <BottomSheet.Content
        className="px-5 pt-1"
        data-slot="booking-detail-sheet"
      >
        {booking && (
          <>
            <BottomSheet.Title className="font-display text-[22px] font-black uppercase italic tracking-tight">
              {PURPOSE_LABEL[booking.purpose]}
            </BottomSheet.Title>
            <BottomSheet.Description className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              {booking.rink_label} · {formatDateLongZA(booking.starts_at)}
            </BottomSheet.Description>

            <dl
              data-slot="booking-meta"
              className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-[13px]"
            >
              <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                Time
              </dt>
              <dd className="font-medium tabular-nums">
                {formatTimeZA(booking.starts_at)}–
                {formatTimeZA(booking.ends_at)}
              </dd>

              <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                Booker
              </dt>
              <dd className="font-medium" data-slot="booker-name">
                {booking.booker_name}
                {booking.booker_email && (
                  <span className="ml-1 text-ink-muted">
                    ({booking.booker_email})
                  </span>
                )}
              </dd>

              <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                Party
              </dt>
              <dd className="font-medium tabular-nums">
                {booking.party_size ?? "—"}
              </dd>

              <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                Status
              </dt>
              <dd
                data-slot="booking-status"
                className={cn(
                  "font-mono text-[11px] font-bold uppercase tracking-[0.06em]",
                  booking.status === "cancelled"
                    ? "text-danger-500"
                    : "text-success-700",
                )}
              >
                {booking.status}
              </dd>

              {booking.notes && (
                <>
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                    Notes
                  </dt>
                  <dd className="text-ink-muted">{booking.notes}</dd>
                </>
              )}
            </dl>

            {canCancel ? (
              <section
                data-slot="force-cancel-form"
                className="mt-5 flex flex-col gap-2 rounded-lg border border-danger-500/30 bg-danger-500/5 p-3"
              >
                <header>
                  <h3 className="font-display text-[14px] font-black uppercase italic tracking-tight">
                    Force-cancel
                  </h3>
                  <p className="text-[12px] text-ink-muted">
                    Cancels the booking on the player&apos;s behalf and writes
                    an audit-log entry. Reason is required.
                  </p>
                </header>
                <label
                  htmlFor={`cancel-reason-${booking.id}`}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted"
                >
                  Reason (required)
                </label>
                <textarea
                  id={`cancel-reason-${booking.id}`}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (reasonError) setReasonError(null);
                  }}
                  rows={3}
                  maxLength={500}
                  disabled={pending}
                  data-slot="reason-textarea"
                  className={cn(
                    "resize-none rounded-md border border-border bg-bone px-2 py-1.5 text-[13px]",
                    "focus:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
                  )}
                  placeholder="e.g. Member contacted club secretary; cancelling on their behalf."
                />
                {reasonError && (
                  <p
                    role="alert"
                    data-slot="reason-error"
                    className="text-[11.5px] text-danger-500"
                  >
                    {reasonError}
                  </p>
                )}
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={pending}
                    data-slot="cancel-close-cta"
                    className={cn(
                      "h-9 flex-1 rounded-md border border-border bg-bone",
                      "text-[12px] font-extrabold uppercase tracking-[0.04em] text-ink",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={submitCancel}
                    disabled={pending}
                    data-slot="force-cancel-submit"
                    className={cn(
                      "h-9 flex-[2] rounded-md bg-danger-500 px-3",
                      "text-[12px] font-extrabold uppercase tracking-[0.04em] text-bone",
                      "hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
                    )}
                  >
                    {pending ? (
                      <Loader2
                        className="mx-auto size-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      "Cancel booking"
                    )}
                  </button>
                </div>
              </section>
            ) : (
              <section
                data-slot="already-cancelled-notice"
                className="mt-5 flex items-center gap-2 rounded-lg border border-border bg-surface p-3"
              >
                <X
                  className="size-4 text-danger-500"
                  aria-hidden="true"
                />
                <p className="text-[12.5px] text-ink-muted">
                  Already cancelled — no action available. Audit history is on
                  the booking&apos;s row in audit_log.
                </p>
              </section>
            )}
          </>
        )}
      </BottomSheet.Content>
    </BottomSheet>
  );
}
