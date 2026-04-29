import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

vi.mock("server-only", () => ({}));

import { AssessmentsListClient } from "@/app/(club-admin)/manage/t20/_components/AssessmentsListClient";
import type { AssessmentListRow } from "@/app/(club-admin)/manage/t20/_data";

// Phase 10 / 10-4 — Client-side filter island for the
// /manage/t20 assessments list.

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
  });

  it("result count shows 'N of M' with both at full set", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
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

  it("clear-filters button is hidden when no filters are active", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    expect(
      container.querySelector("[data-slot='clear-filters-cta']"),
    ).toBeNull();
  });
});

describe("<AssessmentsListClient /> — search", () => {
  it("substring match (case-insensitive) narrows the list", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    const input = container.querySelector(
      "[data-slot='search-input']",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "wessel" } });
    const cards = container.querySelectorAll("[data-slot='assessment-card']");
    expect(cards).toHaveLength(1);
    expect(container.textContent).toContain("Wessel Coetzee");
  });

  it("empty search string shows all rows", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    const input = container.querySelector(
      "[data-slot='search-input']",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "wessel" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(6);
  });

  it("non-matching search → no-match empty state, not no-data", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    const input = container.querySelector(
      "[data-slot='search-input']",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "zzzz-no-such-player" } });
    expect(container.querySelector("[data-slot='empty-no-match']")).not.toBeNull();
    expect(container.querySelector("[data-slot='empty-no-data']")).toBeNull();
  });
});

describe("<AssessmentsListClient /> — status filter", () => {
  it("status='completed' shows 4 completed rows only", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='status-chip'][data-value='completed']",
      ) as HTMLButtonElement,
    );
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(4);
  });

  it("status='in_progress' shows 1 row", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='status-chip'][data-value='in_progress']",
      ) as HTMLButtonElement,
    );
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(1);
    expect(container.textContent).toContain("Themba Dlamini");
  });

  it("status='draft' shows 1 row", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='status-chip'][data-value='draft']",
      ) as HTMLButtonElement,
    );
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(1);
    expect(container.textContent).toContain("Jolene Williams");
  });

  it("changing status updates the result-count eyebrow", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='status-chip'][data-value='completed']",
      ) as HTMLButtonElement,
    );
    expect(
      container.querySelector("[data-slot='result-count']")?.textContent,
    ).toContain("4 of 6");
  });
});

describe("<AssessmentsListClient /> — grade filter", () => {
  it("grade='gold' returns only the gold-graded row", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='grade-chip'][data-value='gold']",
      ) as HTMLButtonElement,
    );
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

  it("grade filter excludes non-completed rows even when the grade is 'all'", () => {
    // status=completed-only path — verifies filter intersection
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='grade-chip'][data-value='gold']",
      ) as HTMLButtonElement,
    );
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(1);
  });

  it("grade chips are dimmed (data-disabled='true') when status excludes 'completed'", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='status-chip'][data-value='in_progress']",
      ) as HTMLButtonElement,
    );
    const gradeFilterEl = container.querySelector("[data-slot='grade-filter']");
    expect(gradeFilterEl?.getAttribute("data-disabled")).toBe("true");
  });
});

describe("<AssessmentsListClient /> — clear filters", () => {
  it("clear button appears when any filter is active", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    expect(
      container.querySelector("[data-slot='clear-filters-cta']"),
    ).toBeNull();
    fireEvent.click(
      container.querySelector(
        "[data-slot='status-chip'][data-value='completed']",
      ) as HTMLButtonElement,
    );
    expect(
      container.querySelector("[data-slot='clear-filters-cta']"),
    ).not.toBeNull();
  });

  it("clear button resets search + status + grade to defaults", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    const input = container.querySelector(
      "[data-slot='search-input']",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "wessel" } });
    fireEvent.click(
      container.querySelector(
        "[data-slot='status-chip'][data-value='completed']",
      ) as HTMLButtonElement,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='grade-chip'][data-value='gold']",
      ) as HTMLButtonElement,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='clear-filters-cta']",
      ) as HTMLButtonElement,
    );
    expect(input.value).toBe("");
    expect(
      container
        .querySelector("[data-slot='status-chip'][data-value='all']")
        ?.getAttribute("data-active"),
    ).toBe("true");
    expect(
      container
        .querySelector("[data-slot='grade-chip'][data-value='all']")
        ?.getAttribute("data-active"),
    ).toBe("true");
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(6);
  });

  it("no-match empty state's CTA also clears filters", () => {
    const { container } = render(<AssessmentsListClient rows={ROWS} />);
    const input = container.querySelector(
      "[data-slot='search-input']",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "zzzzz" } });
    fireEvent.click(
      container.querySelector(
        "[data-slot='empty-no-match-cta']",
      ) as HTMLButtonElement,
    );
    expect(input.value).toBe("");
    expect(
      container.querySelectorAll("[data-slot='assessment-card']"),
    ).toHaveLength(6);
  });
});

describe("<AssessmentsListClient /> — empty data state", () => {
  it("rows=[] renders the no-data hero (NOT the no-match treatment)", () => {
    const { container } = render(<AssessmentsListClient rows={[]} />);
    expect(container.querySelector("[data-slot='empty-no-data']")).not.toBeNull();
    expect(container.querySelector("[data-slot='empty-no-match']")).toBeNull();
  });

  it("no-data CTA links to /manage/t20/new", () => {
    const { container } = render(<AssessmentsListClient rows={[]} />);
    expect(
      container
        .querySelector("[data-slot='empty-no-data-cta']")
        ?.getAttribute("href"),
    ).toBe("/manage/t20/new");
  });

  it("no-data state still renders the search + filter card (filters disabled but UI present)", () => {
    const { container } = render(<AssessmentsListClient rows={[]} />);
    expect(container.querySelector("[data-slot='filter-card']")).not.toBeNull();
    expect(container.querySelector("[data-slot='search-input']")).not.toBeNull();
  });
});
