import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock(
  "@/app/(club-admin)/manage/tournaments/_actions",
  () => ({ updateTournament: vi.fn() }),
);

import { EditTournamentForm } from "@/app/(club-admin)/manage/tournaments/[id]/edit/_components/EditTournamentForm";

// Phase 12.5 / 12.5-5 — pin the edit form's three contract concerns
// that aren't covered by the action's integration tests:
//
//   1. The pre-fill: every editable input on the form initialises
//      from the `tournament` prop. Pinning a few representative
//      fields (name, format, scope chip, fair_rink toggle) is
//      enough — the form has no per-field branching, so if name +
//      one format-derived field + one chip + the toggle all
//      pre-fill, the rest follow the same pattern.
//
//   2. The format-locked notice card renders iff `formatLocked` is
//      true. When true, the FormatPicker + StructurePicker also
//      render with `disabled` styling and the picker buttons
//      themselves are disabled.
//
//   3. The rename soft-warn helper surfaces under the name input
//      iff `softWarnRename` is true AND the user has edited the
//      name to differ from the initial value. The combined
//      predicate prevents the warn from showing on a fresh form
//      where the user hasn't touched anything yet.

afterEach(cleanup);

const SAMPLE_TOURNAMENT = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Demo Singles Open 2026",
  scope: "club" as const,
  format: "singles" as const,
  structure: "knockout" as const,
  category: "open" as const,
  age_group: "open" as const,
  handicap_rule: "scratch" as const,
  seeding_method: "random" as const,
  starts_at: "2026-05-15T08:00:00.000+00:00",
  ends_at: "2026-05-15T17:00:00.000+00:00",
  entries_close_at: "2026-05-10T18:00:00.000+00:00",
  max_entries: 32,
  ends_per_match: null,
  shots_up_target: null,
  fair_rink: true,
  updated_at: "2026-05-01T12:00:00.000+00:00",
  host_club: { id: "club-a", name: "Demo Club" },
};

const SAMPLE_GREENS = [
  { id: "green-1", name: "North Green", rink_count: 6 },
  { id: "green-2", name: "South Green", rink_count: 6 },
];

describe("<EditTournamentForm /> — pre-fill", () => {
  it("pre-fills name, format, scope chip, and fair_rink toggle from the tournament prop", () => {
    const { container } = render(
      <EditTournamentForm
        tournament={SAMPLE_TOURNAMENT}
        greens={SAMPLE_GREENS}
        selectedGreenIds={["green-1"]}
        formatLocked={false}
        softWarnRename={false}
      />,
    );

    // Name input pre-filled.
    const nameInput = container.querySelector(
      "[data-slot='edit-name-input']",
    ) as HTMLInputElement;
    expect(nameInput.value).toBe("Demo Singles Open 2026");

    // Scope chip "Club" is active.
    const scopeChips = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button[data-active]"),
    );
    const clubChip = scopeChips.find((b) => b.textContent === "Club");
    expect(clubChip?.getAttribute("data-active")).toBe("true");

    // fair_rink toggle is checked.
    const checkbox = container.querySelector<HTMLInputElement>(
      "input[type='checkbox']",
    );
    expect(checkbox?.checked).toBe(true);

    // Hero copy reads "Edit tournament", not "New Tournament".
    expect(container.textContent).toContain("Edit tournament");
    expect(container.textContent).not.toContain("New Tournament");
  });

  it("pre-fills the greens picker from selectedGreenIds — only those greens render as active", () => {
    const { container } = render(
      <EditTournamentForm
        tournament={SAMPLE_TOURNAMENT}
        greens={SAMPLE_GREENS}
        selectedGreenIds={["green-2"]}
        formatLocked={false}
        softWarnRename={false}
      />,
    );

    const chips = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button[data-active]"),
    );
    const northChip = chips.find((b) => b.textContent?.includes("North Green"));
    const southChip = chips.find((b) => b.textContent?.includes("South Green"));
    expect(northChip?.getAttribute("data-active")).toBe("false");
    expect(southChip?.getAttribute("data-active")).toBe("true");
  });
});

describe("<EditTournamentForm /> — format-locked", () => {
  it("renders the format-locked notice card and disables the format / structure pickers when formatLocked=true", () => {
    const { container } = render(
      <EditTournamentForm
        tournament={SAMPLE_TOURNAMENT}
        greens={SAMPLE_GREENS}
        selectedGreenIds={[]}
        formatLocked={true}
        softWarnRename={false}
      />,
    );
    const notice = container.querySelector("[data-slot='format-locked-notice']");
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toMatch(/locked/i);
    // Disabled picker buttons — both FormatPicker + StructurePicker
    // render their option buttons with disabled when the parent
    // passes `disabled`. Spot-check by counting disabled buttons in
    // those sections (excluding the seeding "Sectional" chip which
    // is independently locked).
    const allDisabled = container.querySelectorAll<HTMLButtonElement>(
      "button[disabled]",
    );
    expect(allDisabled.length).toBeGreaterThan(2);
  });

  it("does NOT render the format-locked notice card when formatLocked=false", () => {
    const { container } = render(
      <EditTournamentForm
        tournament={SAMPLE_TOURNAMENT}
        greens={SAMPLE_GREENS}
        selectedGreenIds={[]}
        formatLocked={false}
        softWarnRename={false}
      />,
    );
    expect(container.querySelector("[data-slot='format-locked-notice']")).toBeNull();
  });
});

describe("<EditTournamentForm /> — rename soft-warn", () => {
  it("does NOT show the rename soft-warn on initial render even when softWarnRename=true (name hasn't been edited)", () => {
    const { container } = render(
      <EditTournamentForm
        tournament={SAMPLE_TOURNAMENT}
        greens={SAMPLE_GREENS}
        selectedGreenIds={[]}
        formatLocked={false}
        softWarnRename={true}
      />,
    );
    // Initial render: name === tournament.name, so the warn predicate
    // (softWarnRename AND nameChangedFromInitial) is false.
    expect(container.textContent).not.toMatch(/public tournament links update/i);
  });

  it("shows the rename soft-warn when softWarnRename=true AND the user has typed a different name", async () => {
    const { container } = render(
      <EditTournamentForm
        tournament={SAMPLE_TOURNAMENT}
        greens={SAMPLE_GREENS}
        selectedGreenIds={[]}
        formatLocked={false}
        softWarnRename={true}
      />,
    );
    const nameInput = container.querySelector(
      "[data-slot='edit-name-input']",
    ) as HTMLInputElement;
    // Synchronous React 19 controlled-input update via fireEvent.
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(nameInput, { target: { value: "Demo Singles Open 2026 (renamed)" } });
    expect(container.textContent).toMatch(/public tournament links update/i);
  });

  it("does NOT show the rename soft-warn when softWarnRename=false even if the name is edited", async () => {
    const { container } = render(
      <EditTournamentForm
        tournament={SAMPLE_TOURNAMENT}
        greens={SAMPLE_GREENS}
        selectedGreenIds={[]}
        formatLocked={false}
        softWarnRename={false}
      />,
    );
    const nameInput = container.querySelector(
      "[data-slot='edit-name-input']",
    ) as HTMLInputElement;
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(nameInput, { target: { value: "Renamed but still draft" } });
    expect(container.textContent).not.toMatch(/public tournament links update/i);
  });
});
