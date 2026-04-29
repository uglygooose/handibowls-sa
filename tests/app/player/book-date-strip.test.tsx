import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));
// Next's <Link> is a Server Component shim; under jsdom we only need
// it to render an <a>. Use the actual export — App Router's Link
// works in client tests because the prefetch path is no-op when
// there's no router. No mock needed; if breakage appears later,
// stub with `({ href, children }) => <a href={href}>{children}</a>`.

import { DateStrip } from "@/app/(player)/(gated)/book/_components/DateStrip";
import type { BookingDate } from "@/app/(player)/(gated)/book/_data";

function makeDate(over: Partial<BookingDate>): BookingDate {
  return {
    iso: "2026-04-29",
    dow: "WED",
    day: "29",
    closed: false,
    is_today: false,
    is_selected: false,
    ...over,
  };
}

describe("<DateStrip />", () => {
  it("renders one pill per date in input order", () => {
    const dates: BookingDate[] = [
      makeDate({ iso: "2026-04-29", day: "29", is_today: true, is_selected: true }),
      makeDate({ iso: "2026-04-30", day: "30", dow: "THU" }),
      makeDate({ iso: "2026-05-01", day: "1", dow: "FRI" }),
    ];
    const { container } = render(<DateStrip dates={dates} />);
    const root = container.querySelector("[data-slot='date-strip']");
    expect(root).not.toBeNull();
    const pills = container.querySelectorAll(
      "[data-iso]",
    );
    expect(pills).toHaveLength(3);
    expect((pills[0] as HTMLElement).dataset.iso).toBe("2026-04-29");
    expect((pills[2] as HTMLElement).dataset.iso).toBe("2026-05-01");
  });

  it("active pill has aria-current='date' and links to /book?d=<iso>", () => {
    const dates: BookingDate[] = [
      makeDate({ iso: "2026-04-29" }),
      makeDate({ iso: "2026-05-02", dow: "SAT", day: "2", is_selected: true }),
    ];
    render(<DateStrip dates={dates} />);
    const active = screen.getByRole("link", { current: "date" });
    expect(active).toHaveAttribute("href", "/book?d=2026-05-02");
    expect(active.getAttribute("data-selected")).toBe("true");
  });

  it("non-active pills link to their own date and have no aria-current", () => {
    const dates: BookingDate[] = [
      makeDate({ iso: "2026-04-29", is_selected: true }),
      makeDate({ iso: "2026-04-30", dow: "THU", day: "30" }),
    ];
    render(<DateStrip dates={dates} />);
    const inactive = screen.getByRole("link", { name: /THU.*30/ });
    expect(inactive).toHaveAttribute("href", "/book?d=2026-04-30");
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("closed pills render as inert spans (no Link, aria-disabled, 'Closed' tag)", () => {
    const dates: BookingDate[] = [
      makeDate({ iso: "2026-04-29", is_selected: true }),
      makeDate({ iso: "2026-05-01", dow: "FRI", day: "1", closed: true }),
    ];
    const { container } = render(<DateStrip dates={dates} />);
    const closedPill = container.querySelector("[data-iso='2026-05-01']")!;
    expect(closedPill.tagName).toBe("SPAN");
    expect(closedPill.getAttribute("aria-disabled")).toBe("true");
    expect(closedPill.getAttribute("data-closed")).toBe("true");
    expect(
      closedPill.querySelector("[data-slot='off-tag']")?.textContent,
    ).toMatch(/closed/i);
    // It's NOT a link — keyboard nav shouldn't reach it.
    expect(closedPill.tagName).not.toBe("A");
  });

  it("renders the design's dow + day labels per pill", () => {
    const dates: BookingDate[] = [
      makeDate({ iso: "2026-04-29", dow: "WED", day: "29", is_selected: true }),
    ];
    const { container } = render(<DateStrip dates={dates} />);
    const dow = container.querySelector("[data-slot='dow']");
    const day = container.querySelector("[data-slot='day']");
    expect(dow?.textContent).toBe("WED");
    expect(day?.textContent).toBe("29");
  });
});
