import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("server-only", () => ({}));

import { AssessmentCard } from "@/components/t20/AssessmentCard";
import type { AssessmentListRow } from "@/app/(club-admin)/manage/t20/_data";

// Phase 10 — assessment card render contract for /manage/t20 list.

function makeRow(over: Partial<AssessmentListRow> = {}): AssessmentListRow {
  return {
    id: "00000000-0000-0000-0000-00000000aaaa",
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
    second_marker_name: "Marijke Roux · BSA-CL2-2208",
    ...over,
  };
}

describe("<AssessmentCard /> — completed state", () => {
  it("renders the player name + initials avatar", () => {
    const { container } = render(<AssessmentCard row={makeRow()} />);
    expect(container.textContent).toContain("James Thomas");
    expect(
      container.querySelector("[data-slot='player-avatar']")?.textContent,
    ).toBe("JT");
  });

  it("renders the GradePill (sm) for the row's grade", () => {
    const { container } = render(<AssessmentCard row={makeRow()} />);
    const pill = container.querySelector("[data-slot='grade-pill']");
    expect(pill?.getAttribute("data-grade")).toBe("silver");
    expect(pill?.getAttribute("data-size")).toBe("sm");
  });

  it("renders the score line (total / 320 · pct%)", () => {
    const { container } = render(<AssessmentCard row={makeRow()} />);
    const score = container.querySelector("[data-slot='score']");
    expect(score?.textContent).toContain("247 / 320");
    expect(score?.textContent).toContain("77.2%");
  });

  it("links to /manage/t20/<id> for completed", () => {
    const { container } = render(<AssessmentCard row={makeRow()} />);
    const link = container.querySelector("[data-slot='assessment-card']");
    expect(link?.getAttribute("href")).toBe(
      "/manage/t20/00000000-0000-0000-0000-00000000aaaa",
    );
  });
});

describe("<AssessmentCard /> — in-progress state", () => {
  it("renders the In progress pill, NOT a grade pill", () => {
    const { container } = render(
      <AssessmentCard
        row={makeRow({ ui_state: "in_progress", grade: null, status: "draft" })}
      />,
    );
    expect(container.querySelector("[data-slot='grade-pill']")).toBeNull();
    const pill = container.querySelector("[data-slot='state-pill']");
    expect(pill?.getAttribute("data-state")).toBe("in_progress");
    expect(pill?.textContent?.toLowerCase()).toContain("in progress");
  });

  it("links to /capture for in_progress", () => {
    const { container } = render(
      <AssessmentCard
        row={makeRow({ ui_state: "in_progress", grade: null, status: "draft" })}
      />,
    );
    expect(
      container.querySelector("[data-slot='assessment-card']")?.getAttribute("href"),
    ).toContain("/capture");
  });

  it("shows a 'Progress' hint instead of a score", () => {
    const { container } = render(
      <AssessmentCard
        row={makeRow({ ui_state: "in_progress", grade: null, status: "draft" })}
      />,
    );
    expect(container.querySelector("[data-slot='score']")).toBeNull();
    expect(
      container.querySelector("[data-slot='progress-hint']"),
    ).not.toBeNull();
  });
});

describe("<AssessmentCard /> — draft state", () => {
  it("renders the Draft pill", () => {
    const { container } = render(
      <AssessmentCard
        row={makeRow({ ui_state: "draft", grade: null, status: "draft" })}
      />,
    );
    expect(
      container.querySelector("[data-slot='state-pill']")?.getAttribute("data-state"),
    ).toBe("draft");
  });

  it("links to /capture for draft (capture handles hydration)", () => {
    const { container } = render(
      <AssessmentCard
        row={makeRow({ ui_state: "draft", grade: null, status: "draft" })}
      />,
    );
    expect(
      container.querySelector("[data-slot='assessment-card']")?.getAttribute("href"),
    ).toContain("/capture");
  });

  it("draft card carries data-state='draft' for opacity styling", () => {
    const { container } = render(
      <AssessmentCard
        row={makeRow({ ui_state: "draft", grade: null, status: "draft" })}
      />,
    );
    expect(
      container.querySelector("[data-slot='assessment-card']")?.getAttribute("data-state"),
    ).toBe("draft");
  });
});

describe("<AssessmentCard /> — initials fallback", () => {
  it("single name → first letter only (e.g. 'J')", () => {
    const { container } = render(
      <AssessmentCard row={makeRow({ player_name: "James" })} />,
    );
    expect(
      container.querySelector("[data-slot='player-avatar']")?.textContent,
    ).toBe("J");
  });

  it("null name → '?' fallback + 'Unknown player' label", () => {
    const { container } = render(
      <AssessmentCard row={makeRow({ player_name: null })} />,
    );
    expect(
      container.querySelector("[data-slot='player-avatar']")?.textContent,
    ).toBe("?");
    expect(container.textContent).toContain("Unknown player");
  });

  it("three-or-more names → first two initials only (e.g. 'JD')", () => {
    const { container } = render(
      <AssessmentCard row={makeRow({ player_name: "James Daniel Thomas" })} />,
    );
    expect(
      container.querySelector("[data-slot='player-avatar']")?.textContent,
    ).toBe("JD");
  });
});

describe("<AssessmentCard /> — assessor display", () => {
  it("renders the assessor name", () => {
    const { container } = render(<AssessmentCard row={makeRow()} />);
    expect(container.textContent).toContain("Coach Williams");
  });

  it("falls back to 'Unknown' when assessor_name is null", () => {
    const { container } = render(
      <AssessmentCard row={makeRow({ assessor_name: null })} />,
    );
    expect(container.textContent).toContain("Unknown");
  });
});
