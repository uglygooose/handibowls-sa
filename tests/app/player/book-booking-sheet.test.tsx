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
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const createBookingSpy = vi.fn();
vi.mock("@/app/(player)/(gated)/book/_actions", () => ({
  createBooking: (...args: unknown[]) => createBookingSpy(...args),
}));

// vaul renders into a portal — the content lives under document.body,
// not under the render container. Tests query both the container
// (for unmounted state) and document (for portaled content when
// `open={true}`).

import { BookingSheet } from "@/app/(player)/(gated)/book/_components/BookingSheet";

const SLOT = {
  starts_at: "2026-04-30T06:00:00.000Z",
  ends_at: "2026-04-30T08:00:00.000Z",
  starts_label: "08:00",
  ends_label: "10:00",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<BookingSheet /> — closed state", () => {
  it("does not portal sheet content when open=false", () => {
    render(
      <BookingSheet
        open={false}
        onOpenChange={() => {}}
        slot={SLOT}
        clubName="Demo Bowls Club"
      />,
    );
    expect(
      document.querySelector("[data-slot='bottom-sheet-content']"),
    ).toBeNull();
  });
});

describe("<BookingSheet /> — open state", () => {
  it("renders the form with default purpose=practice and party=2", () => {
    render(
      <BookingSheet
        open
        onOpenChange={() => {}}
        slot={SLOT}
        clubName="Demo Bowls Club"
      />,
    );
    const form = document.querySelector("[data-slot='booking-form']");
    expect(form).not.toBeNull();
    // Active purpose chip is rendered with aria-checked.
    const practiceChip = document.querySelector("[data-purpose='practice']");
    expect(practiceChip?.getAttribute("aria-checked")).toBe("true");
    // Party value default 2.
    const partyValue = document.querySelector("[data-slot='party-value']");
    expect(partyValue?.textContent).toBe("2");
  });

  it("renders all five purpose chips matching the booking_purpose enum", () => {
    render(
      <BookingSheet
        open
        onOpenChange={() => {}}
        slot={SLOT}
        clubName="Demo Bowls Club"
      />,
    );
    const purposes = ["roll_up", "practice", "coaching", "match", "social"];
    for (const p of purposes) {
      expect(document.querySelector(`[data-purpose='${p}']`)).not.toBeNull();
    }
  });

  it("clicking another purpose chip flips aria-checked", () => {
    render(
      <BookingSheet
        open
        onOpenChange={() => {}}
        slot={SLOT}
        clubName="Demo Bowls Club"
      />,
    );
    const matchChip = document.querySelector(
      "[data-purpose='match']",
    ) as HTMLElement;
    fireEvent.click(matchChip);
    expect(matchChip.getAttribute("aria-checked")).toBe("true");
    expect(
      document
        .querySelector("[data-purpose='practice']")
        ?.getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("party stepper enforces 1-8 bounds", () => {
    render(
      <BookingSheet
        open
        onOpenChange={() => {}}
        slot={SLOT}
        clubName="Demo Bowls Club"
      />,
    );
    const inc = screen.getByRole("button", { name: /increase party size/i });
    const dec = screen.getByRole("button", { name: /decrease party size/i });
    const value = () =>
      document.querySelector("[data-slot='party-value']")?.textContent;
    // Start at 2, decrement to 1, decrement should clamp.
    fireEvent.click(dec);
    expect(value()).toBe("1");
    expect((dec as HTMLButtonElement).disabled).toBe(true);
    // Increment up to 8.
    for (let i = 0; i < 10; i++) fireEvent.click(inc);
    expect(value()).toBe("8");
    expect((inc as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("<BookingSheet /> — submit + result mapping", () => {
  it("ok → toast.success, close, router.refresh", async () => {
    createBookingSpy.mockResolvedValueOnce({ kind: "ok", booking_id: "b-1" });
    const onOpenChange = vi.fn();
    render(
      <BookingSheet
        open
        onOpenChange={onOpenChange}
        slot={SLOT}
        clubName="Demo Bowls Club"
      />,
    );
    const submit = document.querySelector(
      "[data-slot='submit']",
    ) as HTMLButtonElement;
    fireEvent.click(submit);
    await waitFor(() => expect(createBookingSpy).toHaveBeenCalledTimes(1));
    expect(createBookingSpy).toHaveBeenCalledWith({
      slot_starts_at: SLOT.starts_at,
      slot_ends_at: SLOT.ends_at,
      purpose: "practice",
      party_size: 2,
      notes: undefined,
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("slot_conflict → toast.error, close, router.refresh", async () => {
    createBookingSpy.mockResolvedValueOnce({ kind: "slot_conflict" });
    const onOpenChange = vi.fn();
    render(
      <BookingSheet
        open
        onOpenChange={onOpenChange}
        slot={SLOT}
        clubName="Demo Bowls Club"
      />,
    );
    fireEvent.click(
      document.querySelector("[data-slot='submit']") as HTMLButtonElement,
    );
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("no_availability → toast.error, close, router.refresh", async () => {
    createBookingSpy.mockResolvedValueOnce({ kind: "no_availability" });
    const onOpenChange = vi.fn();
    render(
      <BookingSheet
        open
        onOpenChange={onOpenChange}
        slot={SLOT}
        clubName="Demo Bowls Club"
      />,
    );
    fireEvent.click(
      document.querySelector("[data-slot='submit']") as HTMLButtonElement,
    );
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("validation/error → toast.error but sheet stays open (no refresh)", async () => {
    createBookingSpy.mockResolvedValueOnce({
      kind: "error",
      error: "DB failure",
    });
    const onOpenChange = vi.fn();
    render(
      <BookingSheet
        open
        onOpenChange={onOpenChange}
        slot={SLOT}
        clubName="Demo Bowls Club"
      />,
    );
    fireEvent.click(
      document.querySelector("[data-slot='submit']") as HTMLButtonElement,
    );
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
