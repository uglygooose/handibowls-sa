import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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

const cancelBookingSpy = vi.fn();
vi.mock("@/app/(player)/(gated)/book/_actions", () => ({
  cancelBooking: (...a: unknown[]) => cancelBookingSpy(...a),
}));

import { MyBookings } from "@/components/player/MyBookings";
import type { MyBookingRow } from "@/app/(player)/(gated)/book/slots";

function makeRow(over: Partial<MyBookingRow> = {}): MyBookingRow {
  return {
    id: "b-1",
    starts_at: "2026-05-02T07:00:00.000Z",
    ends_at: "2026-05-02T09:00:00.000Z",
    when_label: "Sat 02 May · 09:00 – 11:00",
    rink_label: "Main 1",
    purpose: "practice",
    party_size: 2,
    cancellable: true,
    is_past: false,
    status: "booked",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<MyBookings /> — empty state", () => {
  it("renders empty card with copy when rows is []", () => {
    const { container } = render(<MyBookings rows={[]} variant="compact" />);
    const root = container.querySelector("[data-slot='my-bookings']");
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-variant")).toBe("compact");
    expect(
      container.querySelector("[data-slot='booking-row']"),
    ).toBeNull();
  });
});

describe("<MyBookings /> — row rendering", () => {
  it("renders rink + purpose + party meta", () => {
    render(
      <MyBookings rows={[makeRow()]} variant="compact" heading="Your bookings" />,
    );
    expect(screen.getByText("Main 1")).toBeInTheDocument();
    expect(screen.getByText("Practice")).toBeInTheDocument();
    expect(screen.getByText(/2 bowlers/i)).toBeInTheDocument();
    expect(
      screen.getByText("Sat 02 May · 09:00 – 11:00"),
    ).toBeInTheDocument();
  });

  it("hides cancel button when row.cancellable is false", () => {
    const { container } = render(
      <MyBookings
        rows={[makeRow({ cancellable: false })]}
        variant="compact"
      />,
    );
    expect(container.querySelector("[data-slot='cancel-cta']")).toBeNull();
  });

  it("marks past rows with data-past='true' and dims them visually", () => {
    const { container } = render(
      <MyBookings
        rows={[makeRow({ is_past: true, cancellable: false })]}
        variant="compact"
      />,
    );
    const row = container.querySelector("[data-slot='booking-row']");
    expect(row?.getAttribute("data-past")).toBe("true");
  });

  it("renders a 'Cancelled' pill when status='cancelled'", () => {
    const { container } = render(
      <MyBookings
        rows={[
          makeRow({
            is_past: true,
            cancellable: false,
            status: "cancelled",
          }),
        ]}
        variant="compact"
      />,
    );
    expect(
      container.querySelector("[data-slot='cancelled-pill']"),
    ).not.toBeNull();
  });

  it("renders heading prop above the list", () => {
    render(
      <MyBookings
        rows={[makeRow()]}
        variant="full"
        heading="My bookings"
      />,
    );
    expect(screen.getByText("My bookings")).toBeInTheDocument();
  });
});

describe("<MyBookings /> — cancel action routing", () => {
  it("ok → toast.success, router.refresh", async () => {
    cancelBookingSpy.mockResolvedValueOnce({ kind: "ok" });
    render(
      <MyBookings
        rows={[makeRow()]}
        variant="compact"
        heading="Your bookings"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() =>
      expect(cancelBookingSpy).toHaveBeenCalledWith({ booking_id: "b-1" }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("too_close_to_start → toast.error, router.refresh", async () => {
    cancelBookingSpy.mockResolvedValueOnce({ kind: "too_close_to_start" });
    render(
      <MyBookings rows={[makeRow()]} variant="compact" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError.mock.calls[0][0]).toMatch(/2h before/i);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("wrong_state → toast.error, router.refresh", async () => {
    cancelBookingSpy.mockResolvedValueOnce({ kind: "wrong_state" });
    render(
      <MyBookings rows={[makeRow()]} variant="compact" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("not_owner → toast.error, router.refresh (defensive)", async () => {
    cancelBookingSpy.mockResolvedValueOnce({ kind: "not_owner" });
    render(
      <MyBookings rows={[makeRow()]} variant="compact" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("error → toast.error, NO refresh, button re-enabled for retry", async () => {
    cancelBookingSpy.mockResolvedValueOnce({
      kind: "error",
      error: "DB failure",
    });
    render(
      <MyBookings rows={[makeRow()]} variant="compact" />,
    );
    const btn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(btn);
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(refreshSpy).not.toHaveBeenCalled();
    // Wait for the transition to complete + setSubmitted(false) to re-enable.
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
  });
});
