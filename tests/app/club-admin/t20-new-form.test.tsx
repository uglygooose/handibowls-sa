import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";

vi.mock("server-only", () => ({}));

const formActionSpy = vi.fn();
vi.mock("@/app/(club-admin)/manage/t20/_actions", () => ({
  CREATE_ASSESSMENT_INITIAL: { kind: "idle" },
  createAssessmentFromForm: (...args: unknown[]) => {
    formActionSpy(...args);
    return { kind: "idle" };
  },
}));

import { NewAssessmentForm } from "@/app/(club-admin)/manage/t20/_components/NewAssessmentForm";
import type { T20PersonRow } from "@/app/(club-admin)/manage/t20/_data";

// Phase 10 / 10-5 — New form Client Component contract.

const PROFILE_A = "00000000-0000-0000-0000-000000000001";
const PROFILE_B = "00000000-0000-0000-0000-000000000002";
const PROFILE_C = "00000000-0000-0000-0000-000000000003";

function makeCandidate(over: Partial<T20PersonRow> = {}): T20PersonRow {
  return {
    profile_id: PROFILE_A,
    name: "James Thomas",
    email: "james@example.com",
    bsa_number: "WP-2419",
    last_assessment: null,
    ...over,
  };
}

const CANDIDATES: T20PersonRow[] = [
  makeCandidate({
    profile_id: PROFILE_A,
    name: "James Thomas",
    bsa_number: "WP-2419",
    last_assessment: {
      id: "a-old",
      assessed_on: "2026-03-12",
      grade: "silver",
      percentage: 72,
    },
  }),
  makeCandidate({
    profile_id: PROFILE_B,
    name: "Wessel Coetzee",
    bsa_number: "WP-1004",
    last_assessment: {
      id: "a-old-2",
      assessed_on: "2026-02-05",
      grade: "gold",
      percentage: 84,
    },
  }),
  makeCandidate({
    profile_id: PROFILE_C,
    name: "Jolene Williams",
    bsa_number: "WP-3088",
    last_assessment: null,
  }),
];

describe("<NewAssessmentForm /> — initial render", () => {
  it("renders 5 form sections numbered 1..5", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    const sections = container.querySelectorAll("[data-slot='form-section']");
    expect(sections).toHaveLength(5);
    expect(container.textContent).toContain("1. Player");
    expect(container.textContent).toContain("2. Assessor");
    expect(container.textContent).toContain("3. Conditions");
    expect(container.textContent).toContain("4. Rubric");
    expect(container.textContent).toContain("5. Second marker");
  });

  it("first candidate is selected by default for both player + assessor", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    const card = container.querySelector("[data-slot='player-card']");
    expect(card?.textContent).toContain("James Thomas");
    const selectedAssessor = container.querySelector(
      "[data-slot='assessor-option'][data-selected='true']",
    );
    expect(selectedAssessor?.getAttribute("data-profile-id")).toBe(PROFILE_A);
  });

  it("Section 1 carries the 'Required' pill", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    const required = container.querySelector("[data-slot='required-pill']");
    expect(required).not.toBeNull();
    expect(required?.textContent).toContain("Required");
  });

  it("default green type is 'outdoor' (chip data-active='true')", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    const chip = container.querySelector(
      "[data-slot='green-type-chip'][data-value='outdoor']",
    );
    expect(chip?.getAttribute("data-active")).toBe("true");
  });

  it("date input prefills the default date", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    const input = container.querySelector(
      "[data-slot='date-input']",
    ) as HTMLInputElement;
    expect(input.value).toBe("2026-04-29");
  });

  it("active rubric label renders inside Section 4's reference card", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    const card = container.querySelector("[data-slot='rubric-card']");
    expect(card?.textContent).toContain("v1-final-2026");
  });

  it("Section 4 band labels show 'Fail' (NOT 'Reassess') — documentary BSA vocabulary", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    const bands = container.querySelectorAll("[data-slot='rubric-band']");
    expect(bands).toHaveLength(4);
    const failBand = container.querySelector("[data-slot='rubric-band'][data-band='fail']");
    expect(failBand?.textContent).toContain("Fail");
    expect(failBand?.textContent).not.toContain("Reassess");
  });

  it("Start capture CTA is enabled when accreditation ID is filled and player+assessor+date present", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    const cta = container.querySelector(
      "[data-slot='start-cta']",
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    const accred = container.querySelector(
      "[data-slot='accreditation-input']",
    ) as HTMLInputElement;
    fireEvent.change(accred, { target: { value: "BSA-CL2-1184" } });
    expect(cta.disabled).toBe(false);
  });

  it("Start capture CTA stays disabled with too-short accreditation ID", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    const accred = container.querySelector(
      "[data-slot='accreditation-input']",
    ) as HTMLInputElement;
    fireEvent.change(accred, { target: { value: "abc" } });
    const cta = container.querySelector(
      "[data-slot='start-cta']",
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
  });
});

describe("<NewAssessmentForm /> — player picker", () => {
  it("clicking 'Change' swaps the summary card for the picker", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    expect(container.querySelector("[data-slot='player-picker']")).toBeNull();
    fireEvent.click(
      container.querySelector(
        "[data-slot='player-change-cta']",
      ) as HTMLButtonElement,
    );
    expect(container.querySelector("[data-slot='player-picker']")).not.toBeNull();
    expect(container.querySelector("[data-slot='player-card']")).toBeNull();
  });

  it("picker rows include all candidates by default", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='player-change-cta']",
      ) as HTMLButtonElement,
    );
    const rows = container.querySelectorAll("[data-slot='player-picker-row']");
    expect(rows).toHaveLength(3);
  });

  it("search filters by name (case-insensitive substring)", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='player-change-cta']",
      ) as HTMLButtonElement,
    );
    fireEvent.change(
      container.querySelector(
        "[data-slot='player-picker-search']",
      ) as HTMLInputElement,
      { target: { value: "wessel" } },
    );
    const rows = container.querySelectorAll("[data-slot='player-picker-row']");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Wessel Coetzee");
  });

  it("clicking a row updates the player + closes the picker", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='player-change-cta']",
      ) as HTMLButtonElement,
    );
    const rows = container.querySelectorAll("[data-slot='player-picker-row']");
    fireEvent.click(rows[1] as HTMLButtonElement);
    expect(container.querySelector("[data-slot='player-picker']")).toBeNull();
    const card = container.querySelector("[data-slot='player-card']");
    expect(card?.textContent).toContain("Wessel Coetzee");
  });

  it("Cancel closes the picker without changing the player", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='player-change-cta']",
      ) as HTMLButtonElement,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='player-picker-cancel']",
      ) as HTMLButtonElement,
    );
    expect(container.querySelector("[data-slot='player-picker']")).toBeNull();
    const card = container.querySelector("[data-slot='player-card']");
    expect(card?.textContent).toContain("James Thomas");
  });
});

describe("<NewAssessmentForm /> — player history sidebar", () => {
  it("player with last_assessment shows pct + GradePill", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    const history = container.querySelector(
      "[data-slot='player-history-card']",
    );
    expect(history?.textContent).toContain("72.0%");
    const pill = history?.querySelector("[data-slot='grade-pill']");
    expect(pill?.getAttribute("data-grade")).toBe("silver");
  });

  it("first-time player shows 'First-time Twenty 20 for this player.' note", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={[CANDIDATES[2]]}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    const note = container.querySelector("[data-slot='player-first-time']");
    expect(note?.textContent).toContain("First-time");
  });
});

describe("<NewAssessmentForm /> — assessor picker", () => {
  it("clicking an assessor option flips the data-selected state", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    const initial = container.querySelector(
      "[data-slot='assessor-option'][data-selected='true']",
    );
    expect(initial?.getAttribute("data-profile-id")).toBe(PROFILE_A);
    fireEvent.click(
      container.querySelector(
        `[data-slot='assessor-option'][data-profile-id='${PROFILE_B}']`,
      ) as HTMLButtonElement,
    );
    const newlySelected = container.querySelector(
      "[data-slot='assessor-option'][data-selected='true']",
    );
    expect(newlySelected?.getAttribute("data-profile-id")).toBe(PROFILE_B);
  });
});

describe("<NewAssessmentForm /> — green-type chips", () => {
  it("clicking a chip flips the active state and only one chip is active", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='green-type-chip'][data-value='indoor']",
      ) as HTMLButtonElement,
    );
    const active = container.querySelectorAll(
      "[data-slot='green-type-chip'][data-active='true']",
    );
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute("data-value")).toBe("indoor");
  });
});

describe("<NewAssessmentForm /> — second marker toggle", () => {
  it("toggle starts off; fields hidden; note shown", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    const toggle = container.querySelector(
      "[data-slot='second-marker-toggle']",
    );
    expect(toggle?.getAttribute("data-state")).toBe("off");
    expect(
      container.querySelector("[data-slot='second-marker-name']"),
    ).toBeNull();
    expect(
      container.querySelector("[data-slot='second-marker-disabled-note']"),
    ).not.toBeNull();
  });

  it("clicking the toggle reveals the marker fields", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='second-marker-toggle']",
      ) as HTMLButtonElement,
    );
    const toggle = container.querySelector(
      "[data-slot='second-marker-toggle']",
    );
    expect(toggle?.getAttribute("data-state")).toBe("on");
    expect(
      container.querySelector("[data-slot='second-marker-name']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-slot='second-marker-accred']"),
    ).not.toBeNull();
  });
});

describe("<NewAssessmentForm /> — rubric details modal", () => {
  it("View details opens the modal with rubric label + 7-row table", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    expect(container.querySelector("[data-slot='rubric-modal']")).toBeNull();
    fireEvent.click(
      container.querySelector(
        "[data-slot='rubric-details-cta']",
      ) as HTMLButtonElement,
    );
    const modal = container.querySelector("[data-slot='rubric-modal']");
    expect(modal).not.toBeNull();
    expect(modal?.textContent).toContain("v1-final-2026");
    expect(
      container.querySelectorAll("[data-slot='rubric-row']"),
    ).toHaveLength(7);
    expect(modal?.textContent).toContain("Grand max");
    expect(modal?.textContent).toContain("320");
  });

  it("close button dismisses the modal", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='rubric-details-cta']",
      ) as HTMLButtonElement,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='rubric-modal-close']",
      ) as HTMLButtonElement,
    );
    expect(container.querySelector("[data-slot='rubric-modal']")).toBeNull();
  });

  it("clicking the overlay (outside) closes the modal; clicking inside does not", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='rubric-details-cta']",
      ) as HTMLButtonElement,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='rubric-modal']",
      ) as HTMLElement,
    );
    expect(container.querySelector("[data-slot='rubric-modal']")).not.toBeNull();
    fireEvent.click(
      container.querySelector(
        "[data-slot='rubric-modal-overlay']",
      ) as HTMLElement,
    );
    expect(container.querySelector("[data-slot='rubric-modal']")).toBeNull();
  });
});

describe("<NewAssessmentForm /> — submit", () => {
  it("submitting the form invokes the action with FormData containing all required fields", async () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={CANDIDATES}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    fireEvent.change(
      container.querySelector(
        "[data-slot='accreditation-input']",
      ) as HTMLInputElement,
      { target: { value: "BSA-CL2-1184" } },
    );
    const form = container.querySelector(
      "[data-slot='new-assessment-form']",
    ) as HTMLFormElement;
    await act(async () => {
      form.requestSubmit();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(formActionSpy).toHaveBeenCalledTimes(1);
    const fd = formActionSpy.mock.calls[0][1] as FormData;
    expect(fd.get("player_id")).toBe(PROFILE_A);
    expect(fd.get("assessor_id")).toBe(PROFILE_A);
    expect(fd.get("assessor_accreditation_id")).toBe("BSA-CL2-1184");
    expect(fd.get("assessed_on")).toBe("2026-04-29");
    expect(fd.get("green_type")).toBe("outdoor");
  });
});

describe("<NewAssessmentForm /> — empty candidates", () => {
  it("renders the empty player card when no candidates exist", () => {
    const { container } = render(
      <NewAssessmentForm
        candidates={[]}
        defaultDate="2026-04-29"
        activeRubricLabel="v1-final-2026"
      />,
    );
    expect(
      container.querySelector("[data-slot='player-card-empty']"),
    ).not.toBeNull();
    const cta = container.querySelector(
      "[data-slot='start-cta']",
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
  });
});
