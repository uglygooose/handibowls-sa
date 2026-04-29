import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor, act } from "@testing-library/react";

vi.mock("server-only", () => ({}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const replaceWeeklyClosuresSpy = vi.fn();
vi.mock("@/app/(club-admin)/manage/greens/_actions", () => ({
  replaceWeeklyClosures: (...a: unknown[]) => replaceWeeklyClosuresSpy(...a),
}));

import { WeeklyAvailabilityEditor } from "@/app/(club-admin)/manage/greens/_components/WeeklyAvailabilityEditor";
import type { WeekdayClosure } from "@/app/(club-admin)/manage/greens/_data";

const CLUB = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<WeeklyAvailabilityEditor /> — render", () => {
  it("renders 7 weekday columns × 16 hour rows", () => {
    const { container } = render(
      <WeeklyAvailabilityEditor clubId={CLUB} initialClosures={[]} />,
    );
    // 16 rows × 7 weekday cells = 112 cells.
    const cells = container.querySelectorAll("[data-slot='weekly-cell']");
    expect(cells).toHaveLength(112);
    // Header row labels.
    expect(container.textContent).toContain("MON");
    expect(container.textContent).toContain("SUN");
    expect(container.textContent).toContain("06:00");
    expect(container.textContent).toContain("21:00");
  });

  it("paints initial closures as closed cells", () => {
    const initial: WeekdayClosure[] = [
      {
        id: "c1",
        green_id: null,
        weekday: 1,
        starts_time: "09:00:00",
        ends_time: "11:00:00",
        label: null,
      },
    ];
    const { container } = render(
      <WeeklyAvailabilityEditor clubId={CLUB} initialClosures={initial} />,
    );
    const closed = container.querySelectorAll(
      "[data-slot='weekly-cell'][data-closed='true']",
    );
    // 09:00–11:00 = 2 cells (hours 9 and 10).
    expect(closed).toHaveLength(2);
    const closedHours = Array.from(closed).map((c) =>
      c.getAttribute("data-hour"),
    );
    expect(closedHours).toEqual(["9", "10"]);
  });

  it("save button is disabled when grid matches initial state (not dirty)", () => {
    const { container } = render(
      <WeeklyAvailabilityEditor clubId={CLUB} initialClosures={[]} />,
    );
    const save = container.querySelector(
      "[data-slot='save-cta']",
    ) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });
});

describe("<WeeklyAvailabilityEditor /> — interaction", () => {
  it("clicking a cell toggles its closed state and enables save", async () => {
    const { container } = render(
      <WeeklyAvailabilityEditor clubId={CLUB} initialClosures={[]} />,
    );
    const cell = container.querySelector(
      "[data-slot='weekly-cell'][data-weekday='1'][data-hour='9']",
    ) as HTMLElement;
    expect(cell.getAttribute("data-closed")).toBe("false");
    fireEvent.pointerDown(cell);
    fireEvent.pointerUp(cell);
    expect(cell.getAttribute("data-closed")).toBe("true");
    const save = container.querySelector(
      "[data-slot='save-cta']",
    ) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
  });

  it("click-drag flips multiple cells to the first cell's target value", () => {
    const { container } = render(
      <WeeklyAvailabilityEditor clubId={CLUB} initialClosures={[]} />,
    );
    const cellA = container.querySelector(
      "[data-slot='weekly-cell'][data-weekday='2'][data-hour='10']",
    ) as HTMLElement;
    const cellB = container.querySelector(
      "[data-slot='weekly-cell'][data-weekday='2'][data-hour='11']",
    ) as HTMLElement;
    const cellC = container.querySelector(
      "[data-slot='weekly-cell'][data-weekday='2'][data-hour='12']",
    ) as HTMLElement;

    fireEvent.pointerDown(cellA);
    fireEvent.pointerEnter(cellB);
    fireEvent.pointerEnter(cellC);
    fireEvent.pointerUp(cellC);

    expect(cellA.getAttribute("data-closed")).toBe("true");
    expect(cellB.getAttribute("data-closed")).toBe("true");
    expect(cellC.getAttribute("data-closed")).toBe("true");
  });

  it("reset reverts to the initial closure set", () => {
    const initial: WeekdayClosure[] = [
      {
        id: "c1",
        green_id: null,
        weekday: 3,
        starts_time: "12:00:00",
        ends_time: "13:00:00",
        label: null,
      },
    ];
    const { container } = render(
      <WeeklyAvailabilityEditor clubId={CLUB} initialClosures={initial} />,
    );
    // Open cell 3/9 (was closed in initial).
    const target = container.querySelector(
      "[data-slot='weekly-cell'][data-weekday='3'][data-hour='9']",
    ) as HTMLElement;
    fireEvent.pointerDown(target);
    fireEvent.pointerUp(target);
    expect(target.getAttribute("data-closed")).toBe("true");
    // Reset.
    const reset = container.querySelector(
      "[data-slot='reset-cta']",
    ) as HTMLButtonElement;
    fireEvent.click(reset);
    // Original closed cell back to closed; the toggled cell back to open.
    expect(target.getAttribute("data-closed")).toBe("false");
    const original = container.querySelector(
      "[data-slot='weekly-cell'][data-weekday='3'][data-hour='12']",
    ) as HTMLElement;
    expect(original.getAttribute("data-closed")).toBe("true");
  });
});

describe("<WeeklyAvailabilityEditor /> — save action routing", () => {
  it("ok → toast.success + clears dirty", async () => {
    replaceWeeklyClosuresSpy.mockResolvedValueOnce({
      ok: true,
      data: { inserted: 1 },
    });
    const { container } = render(
      <WeeklyAvailabilityEditor clubId={CLUB} initialClosures={[]} />,
    );
    const cell = container.querySelector(
      "[data-slot='weekly-cell'][data-weekday='1'][data-hour='9']",
    ) as HTMLElement;
    fireEvent.pointerDown(cell);
    fireEvent.pointerUp(cell);
    const save = container.querySelector(
      "[data-slot='save-cta']",
    ) as HTMLButtonElement;
    await act(async () => {
      save.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(replaceWeeklyClosuresSpy).toHaveBeenCalledWith({
      club_id: CLUB,
      ranges: [
        { weekday: 1, starts_time: "09:00:00", ends_time: "10:00:00" },
      ],
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
  });

  it("error → toast.error", async () => {
    replaceWeeklyClosuresSpy.mockResolvedValueOnce({
      ok: false,
      kind: "error",
      error: "DB blew up",
    });
    const { container } = render(
      <WeeklyAvailabilityEditor clubId={CLUB} initialClosures={[]} />,
    );
    const cell = container.querySelector(
      "[data-slot='weekly-cell'][data-weekday='4'][data-hour='14']",
    ) as HTMLElement;
    fireEvent.pointerDown(cell);
    fireEvent.pointerUp(cell);
    const save = container.querySelector(
      "[data-slot='save-cta']",
    ) as HTMLButtonElement;
    await act(async () => {
      save.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
  });

  it("empty grid save sends ranges=[] (clear-all) + success copy mentions cleared", async () => {
    replaceWeeklyClosuresSpy.mockResolvedValueOnce({
      ok: true,
      data: { inserted: 0 },
    });
    const initial: WeekdayClosure[] = [
      {
        id: "c1",
        green_id: null,
        weekday: 0,
        starts_time: "10:00:00",
        ends_time: "12:00:00",
        label: null,
      },
    ];
    const { container } = render(
      <WeeklyAvailabilityEditor clubId={CLUB} initialClosures={initial} />,
    );
    // Toggle off the two initially-closed cells (10 and 11).
    for (const h of [10, 11]) {
      const cell = container.querySelector(
        `[data-slot='weekly-cell'][data-weekday='0'][data-hour='${h}']`,
      ) as HTMLElement;
      fireEvent.pointerDown(cell);
      fireEvent.pointerUp(cell);
    }
    const save = container.querySelector(
      "[data-slot='save-cta']",
    ) as HTMLButtonElement;
    await act(async () => {
      save.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(replaceWeeklyClosuresSpy).toHaveBeenCalledWith({
      club_id: CLUB,
      ranges: [],
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(String(toastSuccess.mock.calls[0][0]).toLowerCase()).toContain(
      "cleared",
    );
  });
});
