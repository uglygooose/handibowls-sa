import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";

vi.mock("server-only", () => ({}));

// Phase 12.5 / 12.5-3 (audit id `t20-list-empty-states`): the
// AssessmentsListClient migrated from `useState` to URL search
// params. The mock router intercepts `replace()` calls and
// updates `mockSearch` so a subsequent `rerender()` reflects the
// new filter state in the rendered DOM. This mirrors how
// Next.js's real `useSearchParams` triggers re-renders via its
// internal external-store subscription.

let mockSearch = new URLSearchParams();
const replaceSpy = vi.fn((url: string) => {
  const queryString = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  mockSearch = new URLSearchParams(queryString);
});
const pushSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceSpy,
    push: pushSpy,
    refresh: vi.fn(),
  }),
  useSearchParams: () => mockSearch,
  usePathname: () => "/manage/t20",
}));

import { AssessmentsListClient } from "@/app/(club-admin)/manage/t20/_components/AssessmentsListClient";
import type { AssessmentListRow } from "@/app/(club-admin)/manage/t20/_data";

beforeEach(() => {
  mockSearch = new URLSearchParams();
  replaceSpy.mockClear();
  pushSpy.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

function makeRow(over: Partial<AssessmentListRow> = {}): AssessmentListRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    club_id: "club-1",
    player_id: "p-1",
    player_name: "James Thomas",
    player_email: null,
    assessor_id: "c-1",
    assessor_name: "Coach Williams",
    assessor_accreditation_id: "BSA-CL2-1184",
    assessed_on: "2026-04-22",
    green_type: "outdoor",
    green_speed: 13.2,
    status: "submitted",
    ui_state: "completed",
    total_score: 247,
    percentage: 77.2,
    grade: "silver",
    rubric_version_id: "r-1",
    rubric_version_label: "v1-final-2026",
    second_marker_name: null,
    ...over,
  };
}

const ROWS: AssessmentListRow[] = [
  makeRow({ id: "a1", player_name: "James Thomas", grade: "silver", ui_state: "completed", percentage: 77 }),
  makeRow({ id: "a2", player_name: "Wessel Coetzee", grade: "gold", ui_state: "completed", percentage: 84 }),
  makeRow({ id: "a3", player_name: "Anika Adams", grade: "bronze", ui_state: "completed", percentage: 56 }),
  makeRow({ id: "a4", player_name: "Phindile Ndlovu", grade: "fail", ui_state: "completed", percentage: 47 }),
  makeRow({ id: "a5", player_name: "Themba Dlamini", grade: null, ui_state: "in_progress", status: "draft", percentage: 0 }),
  makeRow({ id: "a6", player_name: "Jolene Williams", grade: null, ui_state: "draft", status: "draft", percentage: 0 }),
];

describe("<AssessmentsListClient /> — initial render", () => {
  it("renders all 6 rows with no filters applied", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    const cards = container.querySelectorAll("[data-slot='assessment-card']");
    expect(cards).toHaveLength(6);
    expect(
      container.querySelector("[data-slot='result-count']")?.textContent,
    ).toContain("6 of 6");
  });

  it("status chip 'all' is active by default", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    const chip = container.querySelector(
      "[data-slot='status-chip'][data-value='all']",
    );
    expect(chip?.getAttribute("data-active")).toBe("true");
  });

  it("seeds initial filter state from URL search params", () => {
    mockSearch = new URLSearchParams("status=completed&grade=gold");
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    expect(
      container
        .querySelector("[data-slot='status-chip'][data-value='completed']")
        ?.getAttribute("data-active"),
    ).toBe("true");
    expect(
      container
        .querySelector("[data-slot='grade-chip'][data-value='gold']")
        ?.getAttribute("data-active"),
    ).toBe("true");
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(1);
  });

  it("seeds search input value from ?q= param", () => {
    mockSearch = new URLSearchParams("q=wessel");
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    const input = container.querySelector(
      "[data-slot='search-input']",
    ) as HTMLInputElement;
    expect(input.value).toBe("wessel");
  });
});

describe("<AssessmentsListClient /> — search filter", () => {
  it("debounces 300ms before pushing q= to the URL", () => {
    vi.useFakeTimers();
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    const input = container.querySelector(
      "[data-slot='search-input']",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "wessel" } });
    expect(replaceSpy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(replaceSpy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(replaceSpy).toHaveBeenLastCalledWith("/manage/t20?q=wessel", {
      scroll: false,
    });
  });

  it("filters rendered rows when initial URL has ?q=wessel", () => {
    mockSearch = new URLSearchParams("q=wessel");
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    const cards = container.querySelectorAll("[data-slot='assessment-card']");
    expect(cards).toHaveLength(1);
    expect(container.textContent).toContain("Wessel Coetzee");
  });

  it("empty search shows all rows", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(6);
  });

  it("a no-match search renders the no-match EmptyState", () => {
    mockSearch = new URLSearchParams("q=zzzz-no-such-player");
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(0);
    const empty = container.querySelector("[data-slot='empty-state']");
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toMatch(/No assessments match those filters/);
  });
});

describe("<AssessmentsListClient /> — status filter (URL-driven)", () => {
  it("status='completed' renders 4 completed rows", () => {
    mockSearch = new URLSearchParams("status=completed");
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(4);
  });

  it("status='in_progress' renders 1 row", () => {
    mockSearch = new URLSearchParams("status=in_progress");
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(1);
    expect(container.textContent).toContain("Themba Dlamini");
  });

  it("status='draft' renders 1 row", () => {
    mockSearch = new URLSearchParams("status=draft");
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(1);
    expect(container.textContent).toContain("Jolene Williams");
  });

  it("clicking a status chip pushes ?status=<value>", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='status-chip'][data-value='completed']",
      ) as HTMLButtonElement,
    );
    expect(replaceSpy).toHaveBeenCalledWith("/manage/t20?status=completed", {
      scroll: false,
    });
  });

  it("clicking 'all' clears the status param", () => {
    mockSearch = new URLSearchParams("status=completed");
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='status-chip'][data-value='all']",
      ) as HTMLButtonElement,
    );
    expect(replaceSpy).toHaveBeenCalledWith("/manage/t20", { scroll: false });
  });

  it("status filter updates the result-count eyebrow", () => {
    mockSearch = new URLSearchParams("status=completed");
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    expect(
      container.querySelector("[data-slot='result-count']")?.textContent,
    ).toContain("4 of 6");
  });
});

describe("<AssessmentsListClient /> — grade filter (URL-driven)", () => {
  it("grade='gold' renders only the gold row", () => {
    mockSearch = new URLSearchParams("grade=gold");
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(1);
    expect(container.textContent).toContain("Wessel Coetzee");
  });

  it("grade='fail' chip is labelled 'Reassess' (not 'Fail')", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    const chip = container.querySelector(
      "[data-slot='grade-chip'][data-value='fail']",
    );
    expect(chip?.textContent).toBe("Reassess");
  });

  it("grade filter excludes non-completed rows even when status='all'", () => {
    mockSearch = new URLSearchParams("grade=gold");
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(1);
  });

  it("grade chips are dimmed (data-disabled='true') when status excludes 'completed'", () => {
    mockSearch = new URLSearchParams("status=in_progress");
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    const gradeFilterEl = container.querySelector("[data-slot='grade-filter']");
    expect(gradeFilterEl?.getAttribute("data-disabled")).toBe("true");
  });

  it("clicking a grade chip pushes ?grade=<value>", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='grade-chip'][data-value='gold']",
      ) as HTMLButtonElement,
    );
    expect(replaceSpy).toHaveBeenCalledWith("/manage/t20?grade=gold", {
      scroll: false,
    });
  });
});

describe("<AssessmentsListClient /> — clear filters", () => {
  it("clear button is hidden when no filters are active", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    expect(
      container.querySelector("[data-slot='clear-filters-cta']"),
    ).toBeNull();
  });

  it("clear button is visible when any filter is active", () => {
    mockSearch = new URLSearchParams("status=completed");
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    expect(
      container.querySelector("[data-slot='clear-filters-cta']"),
    ).not.toBeNull();
  });

  it("clear button pushes a clean URL (no params)", () => {
    mockSearch = new URLSearchParams("q=wessel&status=completed&grade=gold");
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='clear-filters-cta']",
      ) as HTMLButtonElement,
    );
    expect(replaceSpy).toHaveBeenCalledWith("/manage/t20", { scroll: false });
  });
});

describe("<AssessmentsListClient /> — empty data state", () => {
  it("rows=[] renders the no-captures EmptyState (NOT the no-match treatment)", () => {
    const { container } = render(<AssessmentsListClient rows={[]} />);
    const empty = container.querySelector("[data-slot='empty-state']");
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toMatch(/Capture your first Twenty 20/);
  });

  it("no-data CTA links to /manage/t20/new", () => {
    const { container } = render(<AssessmentsListClient rows={[]} />);
    const link = container.querySelector(
      "[data-slot='empty-state'] a",
    ) as HTMLAnchorElement | null;
    expect(link?.getAttribute("href")).toBe("/manage/t20/new");
    expect(link?.textContent).toContain("New assessment");
  });

  it("no-data state still renders the search + filter card (filters disabled but UI present)", () => {
    const { container } = render(<AssessmentsListClient rows={[]} />);
    expect(container.querySelector("[data-slot='filter-card']")).not.toBeNull();
    expect(container.querySelector("[data-slot='search-input']")).not.toBeNull();
  });
});
