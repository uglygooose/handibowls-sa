import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/app/(club-admin)/manage/overview/_actions", () => ({
  adminForceCancelBooking: vi.fn(),
}));

import { BookingsCalendarGrid } from "@/app/(club-admin)/manage/overview/_components/BookingsCalendarGrid";
import type { BookingCalendarRow } from "@/app/(club-admin)/manage/overview/_data";

// Phase 9-2 — calendar grid render + interaction.
//
// Cell keying: SAST date (YYYY-MM-DD) × SAST hour (0..23). Every test
// that probes a specific cell uses a UTC ISO that resolves to the
// expected SAST coordinate. Africa/Johannesburg is fixed UTC+2 with
// no DST, so the offsets are static.

const MONDAY = "2026-04-27"; // Mon 27 Apr 2026 SAST

function makeBooking(over: Partial<BookingCalendarRow> = {}): BookingCalendarRow {
  return {
    id: "b1",
    rink_id: "r1",
    rink_label: "Main 1",
    starts_at: "2026-04-27T07:00:00.000Z", // 09:00 SAST Mon
    ends_at: "2026-04-27T08:00:00.000Z",
    purpose: "practice",
    party_size: 2,
    status: "booked",
    notes: null,
    booker_name: "Ada Bowls",
    booker_email: "ada@example.com",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<BookingsCalendarGrid /> — render shape", () => {
  it("renders 7 day-headers labelled MON..SUN with the week's dates", () => {
    const { container } = render(
      <BookingsCalendarGrid
        bookings={[]}
        mondayIso={MONDAY}
        clubName="Demo"
      />,
    );
    const headers = container.querySelectorAll("[data-slot='day-header']");
    expect(headers).toHaveLength(7);
    expect(headers[0].getAttribute("data-date")).toBe("2026-04-27");
    expect(headers[6].getAttribute("data-date")).toBe("2026-05-03");
    expect(container.textContent).toContain("MON");
    expect(container.textContent).toContain("SUN");
  });

  it("renders 16 hour rows × 7 cells = 112 booking cells", () => {
    const { container } = render(
      <BookingsCalendarGrid
        bookings={[]}
        mondayIso={MONDAY}
        clubName="Demo"
      />,
    );
    const cells = container.querySelectorAll("[data-slot='bookings-cell']");
    expect(cells).toHaveLength(112);
  });

  it("renders the totals strip", () => {
    const { container } = render(
      <BookingsCalendarGrid
        bookings={[
          makeBooking({ id: "b1" }),
          makeBooking({ id: "b2", status: "cancelled" }),
        ]}
        mondayIso={MONDAY}
        clubName="Demo"
      />,
    );
    const totals = container.querySelector("[data-slot='booking-totals']");
    expect(totals?.textContent).toContain("1 booked");
    expect(totals?.textContent).toContain("1 cancelled");
  });
});

describe("<BookingsCalendarGrid /> — booking placement", () => {
  it("places a booking at its SAST date+hour cell", () => {
    // 09:00 SAST Mon = 2026-04-27 hour=9
    const { container } = render(
      <BookingsCalendarGrid
        bookings={[
          makeBooking({ starts_at: "2026-04-27T07:00:00.000Z" }),
        ]}
        mondayIso={MONDAY}
        clubName="Demo"
      />,
    );
    const cell = container.querySelector(
      "[data-slot='bookings-cell'][data-date='2026-04-27'][data-hour='9']",
    );
    expect(cell?.getAttribute("data-count")).toBe("1");
    expect(cell?.querySelector("[data-slot='booking-chip']")).not.toBeNull();
  });

  it("stacks multiple bookings in the same cell (multi-rink at same hour)", () => {
    const { container } = render(
      <BookingsCalendarGrid
        bookings={[
          makeBooking({ id: "b1", rink_label: "Main 1" }),
          makeBooking({
            id: "b2",
            rink_label: "Main 2",
            starts_at: "2026-04-27T07:00:00.000Z",
          }),
        ]}
        mondayIso={MONDAY}
        clubName="Demo"
      />,
    );
    const cell = container.querySelector(
      "[data-slot='bookings-cell'][data-date='2026-04-27'][data-hour='9']",
    );
    expect(cell?.getAttribute("data-count")).toBe("2");
    expect(
      cell?.querySelectorAll("[data-slot='booking-chip']"),
    ).toHaveLength(2);
  });

  it("ignores bookings outside the 06..21 display range", () => {
    // 23:00 SAST = UTC 21:00 same day
    const { container } = render(
      <BookingsCalendarGrid
        bookings={[
          makeBooking({
            id: "b-late",
            starts_at: "2026-04-27T21:00:00.000Z",
          }),
        ]}
        mondayIso={MONDAY}
        clubName="Demo"
      />,
    );
    const chips = container.querySelectorAll("[data-slot='booking-chip']");
    expect(chips).toHaveLength(0);
  });

  it("renders cancelled bookings with data-status='cancelled' (audit visibility)", () => {
    const { container } = render(
      <BookingsCalendarGrid
        bookings={[makeBooking({ status: "cancelled" })]}
        mondayIso={MONDAY}
        clubName="Demo"
      />,
    );
    const chip = container.querySelector("[data-slot='booking-chip']");
    expect(chip?.getAttribute("data-status")).toBe("cancelled");
  });
});

describe("<BookingsCalendarGrid /> — chip click opens BookingDetailSheet", () => {
  it("clicking a booking chip portals the sheet content into document", () => {
    const { container } = render(
      <BookingsCalendarGrid
        bookings={[makeBooking()]}
        mondayIso={MONDAY}
        clubName="Demo"
      />,
    );
    // Sheet content is portaled — not in container until open.
    expect(
      document.querySelector("[data-slot='bottom-sheet-content']"),
    ).toBeNull();

    const chip = container.querySelector(
      "[data-slot='booking-chip']",
    ) as HTMLButtonElement;
    fireEvent.click(chip);

    // After click, vaul portals the sheet into document.body.
    const sheetContent = document.querySelector(
      "[data-slot='booking-detail-sheet']",
    );
    expect(sheetContent).not.toBeNull();
  });
});

describe("<BookingsCalendarGrid /> — week nav links", () => {
  it("prev/next links carry the right ?w= dates", () => {
    const { container } = render(
      <BookingsCalendarGrid
        bookings={[]}
        mondayIso={MONDAY}
        clubName="Demo"
      />,
    );
    const prev = container.querySelector(
      "[data-slot='week-prev']",
    ) as HTMLAnchorElement;
    const next = container.querySelector(
      "[data-slot='week-next']",
    ) as HTMLAnchorElement;

    expect(prev.getAttribute("data-week")).toBe("2026-04-20");
    expect(prev.getAttribute("href")).toBe("/manage/overview?w=2026-04-20");
    expect(next.getAttribute("data-week")).toBe("2026-05-04");
    expect(next.getAttribute("href")).toBe("/manage/overview?w=2026-05-04");
  });

  it("today link is present and points to /manage/overview?w=<isoToday>", () => {
    const { container } = render(
      <BookingsCalendarGrid
        bookings={[]}
        mondayIso={MONDAY}
        clubName="Demo"
      />,
    );
    const today = container.querySelector(
      "[data-slot='week-today']",
    ) as HTMLAnchorElement;
    expect(today).not.toBeNull();
    expect(today.getAttribute("href")).toMatch(
      /^\/manage\/overview\?w=\d{4}-\d{2}-\d{2}$/,
    );
  });
});
