import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor, act } from "@testing-library/react";

vi.mock("server-only", () => ({}));

const refreshSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshSpy }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const adminForceCancelBookingSpy = vi.fn();
vi.mock("@/app/(club-admin)/manage/overview/_actions", () => ({
  adminForceCancelBooking: (...a: unknown[]) =>
    adminForceCancelBookingSpy(...a),
}));

import { BookingDetailSheet } from "@/app/(club-admin)/manage/overview/_components/BookingDetailSheet";
import type { BookingCalendarRow } from "@/app/(club-admin)/manage/overview/_data";

// Phase 9-2 — booking detail sheet tests.
//
// vaul renders into a portal — sheet markup lives under document.body
// (not container) once `booking !== null`. Each test queries
// document.* to find sheet internals; container-based queries would
// silently miss the portal.

const BASE_BOOKING: BookingCalendarRow = {
  id: "33333333-3333-4333-8333-333333333333",
  rink_id: "r1",
  rink_label: "Main 1",
  starts_at: "2026-04-27T07:00:00.000Z",
  ends_at: "2026-04-27T08:00:00.000Z",
  purpose: "practice",
  party_size: 2,
  status: "booked",
  notes: null,
  booker_name: "Ada Bowls",
  booker_email: "ada@example.com",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<BookingDetailSheet /> — closed state", () => {
  it("does not portal sheet content when booking=null", () => {
    render(<BookingDetailSheet booking={null} onClose={() => {}} />);
    expect(
      document.querySelector("[data-slot='bottom-sheet-content']"),
    ).toBeNull();
  });
});

describe("<BookingDetailSheet /> — open state · render", () => {
  it("renders metadata fields for a booked row", () => {
    render(<BookingDetailSheet booking={BASE_BOOKING} onClose={() => {}} />);
    const sheet = document.querySelector("[data-slot='booking-detail-sheet']");
    expect(sheet).not.toBeNull();
    const meta = document.querySelector("[data-slot='booking-meta']");
    expect(meta?.textContent).toContain("Ada Bowls");
    expect(meta?.textContent).toContain("ada@example.com");
    const status = document.querySelector("[data-slot='booking-status']");
    expect(status?.textContent).toContain("booked");
  });

  it("shows force-cancel form when status='booked'", () => {
    render(<BookingDetailSheet booking={BASE_BOOKING} onClose={() => {}} />);
    const form = document.querySelector("[data-slot='force-cancel-form']");
    expect(form).not.toBeNull();
    expect(
      document.querySelector("[data-slot='already-cancelled-notice']"),
    ).toBeNull();
  });

  it("shows already-cancelled notice when status='cancelled' (no form)", () => {
    render(
      <BookingDetailSheet
        booking={{ ...BASE_BOOKING, status: "cancelled" }}
        onClose={() => {}}
      />,
    );
    expect(
      document.querySelector("[data-slot='already-cancelled-notice']"),
    ).not.toBeNull();
    expect(document.querySelector("[data-slot='force-cancel-form']")).toBeNull();
  });

  it("renders booker_name verbatim (data layer guarantees non-null via formatPlayerName)", () => {
    // Phase 13 / 13-2b / Batch H1: data-layer helper bookerName
    // now ALWAYS returns a string ("Deleted player" for
    // anonymised profiles); the component's "—" fallback is no
    // longer reachable. The pin moves to confirming the
    // component renders the data-layer-supplied string verbatim.
    render(
      <BookingDetailSheet
        booking={{
          ...BASE_BOOKING,
          booker_name: "Deleted player",
          booker_email: null,
        }}
        onClose={() => {}}
      />,
    );
    const bookerCell = document.querySelector("[data-slot='booker-name']");
    expect(bookerCell?.textContent?.trim()).toBe("Deleted player");
  });

  it("shows notes row only when notes are non-null", () => {
    const { rerender } = render(
      <BookingDetailSheet booking={BASE_BOOKING} onClose={() => {}} />,
    );
    expect(document.querySelector("[data-slot='booking-meta']")?.textContent).not.toContain(
      "Notes",
    );
    rerender(
      <BookingDetailSheet
        booking={{ ...BASE_BOOKING, notes: "Coaching focus" }}
        onClose={() => {}}
      />,
    );
    expect(document.querySelector("[data-slot='booking-meta']")?.textContent).toContain(
      "Notes",
    );
    expect(document.querySelector("[data-slot='booking-meta']")?.textContent).toContain(
      "Coaching focus",
    );
  });
});

describe("<BookingDetailSheet /> — submit gating", () => {
  it("empty reason → inline error, no action call", () => {
    render(<BookingDetailSheet booking={BASE_BOOKING} onClose={() => {}} />);
    fireEvent.click(
      document.querySelector(
        "[data-slot='force-cancel-submit']",
      ) as HTMLButtonElement,
    );
    expect(
      document.querySelector("[data-slot='reason-error']"),
    ).not.toBeNull();
    expect(adminForceCancelBookingSpy).not.toHaveBeenCalled();
  });

  it("whitespace-only reason → inline error, no action call", () => {
    render(<BookingDetailSheet booking={BASE_BOOKING} onClose={() => {}} />);
    fireEvent.change(
      document.querySelector(
        "[data-slot='reason-textarea']",
      ) as HTMLTextAreaElement,
      { target: { value: "   " } },
    );
    fireEvent.click(
      document.querySelector(
        "[data-slot='force-cancel-submit']",
      ) as HTMLButtonElement,
    );
    expect(
      document.querySelector("[data-slot='reason-error']"),
    ).not.toBeNull();
    expect(adminForceCancelBookingSpy).not.toHaveBeenCalled();
  });

  it("typing in textarea after error clears the error", () => {
    render(<BookingDetailSheet booking={BASE_BOOKING} onClose={() => {}} />);
    fireEvent.click(
      document.querySelector(
        "[data-slot='force-cancel-submit']",
      ) as HTMLButtonElement,
    );
    expect(document.querySelector("[data-slot='reason-error']")).not.toBeNull();
    fireEvent.change(
      document.querySelector(
        "[data-slot='reason-textarea']",
      ) as HTMLTextAreaElement,
      { target: { value: "test" } },
    );
    expect(document.querySelector("[data-slot='reason-error']")).toBeNull();
  });
});

describe("<BookingDetailSheet /> — action result routing", () => {
  async function submitWithReason(reason: string) {
    fireEvent.change(
      document.querySelector(
        "[data-slot='reason-textarea']",
      ) as HTMLTextAreaElement,
      { target: { value: reason } },
    );
    await act(async () => {
      (
        document.querySelector(
          "[data-slot='force-cancel-submit']",
        ) as HTMLButtonElement
      ).click();
      await new Promise((r) => setTimeout(r, 0));
    });
  }

  it("ok → toast.success + onClose + router.refresh", async () => {
    adminForceCancelBookingSpy.mockResolvedValueOnce({ kind: "ok" });
    const onClose = vi.fn();
    render(<BookingDetailSheet booking={BASE_BOOKING} onClose={onClose} />);

    await submitWithReason("Member contacted secretary");
    expect(adminForceCancelBookingSpy).toHaveBeenCalledWith({
      booking_id: BASE_BOOKING.id,
      reason: "Member contacted secretary",
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("not_found → toast.error + onClose + refresh (page is stale)", async () => {
    adminForceCancelBookingSpy.mockResolvedValueOnce({ kind: "not_found" });
    const onClose = vi.fn();
    render(<BookingDetailSheet booking={BASE_BOOKING} onClose={onClose} />);
    await submitWithReason("test reason");
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("wrong_state → toast.error + onClose + refresh", async () => {
    adminForceCancelBookingSpy.mockResolvedValueOnce({ kind: "wrong_state" });
    const onClose = vi.fn();
    render(<BookingDetailSheet booking={BASE_BOOKING} onClose={onClose} />);
    await submitWithReason("test reason");
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("reason_required (RPC) → inline error, sheet stays open", async () => {
    adminForceCancelBookingSpy.mockResolvedValueOnce({
      kind: "reason_required",
    });
    const onClose = vi.fn();
    render(<BookingDetailSheet booking={BASE_BOOKING} onClose={onClose} />);
    await submitWithReason("test reason");
    expect(
      document.querySelector("[data-slot='reason-error']"),
    ).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("wrong_club → toast.error, sheet stays open (no close)", async () => {
    adminForceCancelBookingSpy.mockResolvedValueOnce({ kind: "wrong_club" });
    const onClose = vi.fn();
    render(<BookingDetailSheet booking={BASE_BOOKING} onClose={onClose} />);
    await submitWithReason("test reason");
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("insufficient_role → toast.error + onClose (re-auth path)", async () => {
    adminForceCancelBookingSpy.mockResolvedValueOnce({
      kind: "insufficient_role",
    });
    const onClose = vi.fn();
    render(<BookingDetailSheet booking={BASE_BOOKING} onClose={onClose} />);
    await submitWithReason("test reason");
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("auth → toast.error + onClose", async () => {
    adminForceCancelBookingSpy.mockResolvedValueOnce({
      kind: "auth",
      error: "Not authenticated",
    });
    const onClose = vi.fn();
    render(<BookingDetailSheet booking={BASE_BOOKING} onClose={onClose} />);
    await submitWithReason("test reason");
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("validation/error → toast.error, sheet stays open", async () => {
    adminForceCancelBookingSpy.mockResolvedValueOnce({
      kind: "error",
      error: "Cancel failed",
    });
    const onClose = vi.fn();
    render(<BookingDetailSheet booking={BASE_BOOKING} onClose={onClose} />);
    await submitWithReason("test reason");
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("<BookingDetailSheet /> — close interactions", () => {
  it("Close button calls onClose without invoking the action", () => {
    const onClose = vi.fn();
    render(<BookingDetailSheet booking={BASE_BOOKING} onClose={onClose} />);
    fireEvent.click(
      document.querySelector(
        "[data-slot='cancel-close-cta']",
      ) as HTMLButtonElement,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(adminForceCancelBookingSpy).not.toHaveBeenCalled();
  });
});
