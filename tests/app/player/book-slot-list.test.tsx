import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// SlotList → BookingSheet → _actions imports server-only modules at
// the Next runtime boundary. Under Vitest (jsdom) there's no `"use
// server"` boundary, so we mock both server-only and the action
// module — slot-list rendering is the unit under test, not the action.
vi.mock("server-only", () => ({}));
vi.mock("@/app/(player)/(gated)/book/_actions", () => ({
  createBooking: vi.fn(),
}));

import { SlotList } from "@/app/(player)/(gated)/book/_components/SlotList";
import type { BookingSlot } from "@/app/(player)/(gated)/book/slots";

function makeSlot(over: Partial<BookingSlot> = {}): BookingSlot {
  return {
    starts_at: "2026-04-29T06:00:00.000Z",
    ends_at: "2026-04-29T08:00:00.000Z",
    starts_label: "08:00",
    ends_label: "10:00",
    available_rinks: [
      { id: "r-1", label: "Main 1" },
      { id: "r-2", label: "Main 2" },
    ],
    bookings_in_slot: [],
    ...over,
  };
}

describe("<SlotList /> — render + booking-sheet open", () => {
  it("renders the available count in the header", () => {
    const slots: BookingSlot[] = [
      makeSlot({
        starts_at: "2026-04-29T06:00:00.000Z",
        starts_label: "08:00",
      }),
      makeSlot({
        starts_at: "2026-04-29T08:00:00.000Z",
        starts_label: "10:00",
        available_rinks: [],
        bookings_in_slot: [
          { id: "b-1", rink_label: "Main 1", purpose: "match" },
        ],
      }),
      makeSlot({
        starts_at: "2026-04-29T10:00:00.000Z",
        starts_label: "12:00",
      }),
    ];
    const { container } = render(
      <SlotList slots={slots} clubName="Demo Bowls Club" />,
    );
    const count = container.querySelector("[data-slot='open-count']");
    expect(count?.textContent?.toLowerCase()).toContain("2 open");
  });

  it("renders rink chips for available slots and an enabled 'Book this slot' CTA", () => {
    const slots = [makeSlot()];
    const { container } = render(
      <SlotList slots={slots} clubName="Demo Bowls Club" />,
    );
    const chips = container.querySelectorAll("[data-slot='rink-chip']");
    expect(chips).toHaveLength(2);
    expect(chips[0].textContent).toBe("Main 1");
    expect(chips[1].textContent).toBe("Main 2");
    const cta = container.querySelector(
      "[data-slot='book-cta']",
    ) as HTMLButtonElement | null;
    expect(cta).not.toBeNull();
    expect(cta!.disabled).toBe(false);
  });

  it("renders fully-booked slots with 'Booked · <purpose>' and no CTA", () => {
    const slots: BookingSlot[] = [
      makeSlot({
        available_rinks: [],
        bookings_in_slot: [
          { id: "b-1", rink_label: "Main 1", purpose: "coaching" },
          // Second booking present but design only surfaces the first
          // booking's label.
          { id: "b-2", rink_label: "Main 2", purpose: "practice" },
        ],
      }),
    ];
    const { container } = render(
      <SlotList slots={slots} clubName="Demo Bowls Club" />,
    );
    const card = container.querySelector("[data-slot='slot-card']");
    expect(card?.getAttribute("data-fully-booked")).toBe("true");
    const tag = container.querySelector("[data-slot='booked-tag']");
    expect(tag?.textContent).toContain("Booked");
    expect(tag?.textContent).toContain("Coaching");
    expect(tag?.textContent).not.toContain("Practice");
    expect(container.querySelector("[data-slot='book-cta']")).toBeNull();
  });

  it("falls back to plain 'Booked' when bookings_in_slot is empty (defensive)", () => {
    const slots: BookingSlot[] = [
      makeSlot({ available_rinks: [], bookings_in_slot: [] }),
    ];
    const { container } = render(
      <SlotList slots={slots} clubName="Demo Bowls Club" />,
    );
    const tag = container.querySelector("[data-slot='booked-tag']");
    expect(tag?.textContent?.toLowerCase()).toContain("booked");
    expect(tag?.textContent).not.toMatch(/\bRoll-up\b|\bMatch\b|\bPractice\b/);
  });

  it("renders the empty state when slots array is empty (closed-day case)", () => {
    const { container } = render(
      <SlotList slots={[]} clubName="Demo Bowls Club" />,
    );
    expect(
      container.querySelector("[data-slot='slot-list-empty']"),
    ).not.toBeNull();
    expect(container.querySelector("[data-slot='slot-list']")).toBeNull();
  });

  it("renders time labels in the slot card header", () => {
    const slots = [makeSlot({ starts_label: "12:00", ends_label: "14:00" })];
    render(<SlotList slots={slots} clubName="Demo Bowls Club" />);
    expect(screen.getByText(/12:00 . 14:00/)).toBeInTheDocument();
  });
});
