import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  BulkScoringGrid,
  type BulkScoringMatch,
} from "@/components/tournament/BulkScoringGrid";

// Keyboard nav test — react-hotkeys-hook fires its handlers on document
// keydown by default. With `enableOnFormTags: ["input"]` it fires while
// a score input is focused. Test by focusing a cell and dispatching the
// expected keys.

function makeMatch(idx: number, overrides: Partial<BulkScoringMatch> = {}): BulkScoringMatch {
  return {
    id: `m-${idx}`,
    match_no: idx + 1,
    round: 1,
    rink: "1",
    home: { name: `Home ${idx}`, subtitle: null, isBye: false },
    away: { name: `Away ${idx}`, subtitle: null, isBye: false },
    home_shots: 0,
    away_shots: 0,
    status: "SCHEDULED",
    finalized_by_admin: false,
    ...overrides,
  };
}

describe("<BulkScoringGrid /> — keyboard nav", () => {
  it("Down arrow moves focus to the next row's home input", async () => {
    const user = userEvent.setup();
    const matches = [makeMatch(0), makeMatch(1), makeMatch(2)];
    render(
      <BulkScoringGrid
        matches={matches}
        onSaveBatch={vi.fn()}
        onFinalizeBatch={vi.fn()}
        shotsTarget={21}
      />,
    );

    const homeInputs = screen.getAllByLabelText(/home score for m\d+/i);
    expect(homeInputs).toHaveLength(3);

    await user.click(homeInputs[0]);
    expect(homeInputs[0]).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(homeInputs[1]).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(homeInputs[2]).toHaveFocus();
  });

  it("Up arrow moves focus to the previous row, clamped at 0", async () => {
    const user = userEvent.setup();
    const matches = [makeMatch(0), makeMatch(1)];
    render(
      <BulkScoringGrid
        matches={matches}
        onSaveBatch={vi.fn()}
        onFinalizeBatch={vi.fn()}
      />,
    );
    const homeInputs = screen.getAllByLabelText(/home score for m\d+/i);

    await user.click(homeInputs[1]);
    expect(homeInputs[1]).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(homeInputs[0]).toHaveFocus();

    // Clamp at 0 — another ArrowUp keeps us on row 0.
    await user.keyboard("{ArrowUp}");
    expect(homeInputs[0]).toHaveFocus();
  });

  it("Right arrow moves home → away within the same row", async () => {
    const user = userEvent.setup();
    const matches = [makeMatch(0)];
    render(
      <BulkScoringGrid
        matches={matches}
        onSaveBatch={vi.fn()}
        onFinalizeBatch={vi.fn()}
      />,
    );
    const home = screen.getByLabelText(/home score for m01/i);
    const away = screen.getByLabelText(/away score for m01/i);

    await user.click(home);
    await user.keyboard("{ArrowRight}");
    expect(away).toHaveFocus();
  });

  it("Left arrow moves away → home within the same row", async () => {
    const user = userEvent.setup();
    const matches = [makeMatch(0)];
    render(
      <BulkScoringGrid
        matches={matches}
        onSaveBatch={vi.fn()}
        onFinalizeBatch={vi.fn()}
      />,
    );
    const home = screen.getByLabelText(/home score for m01/i);
    const away = screen.getByLabelText(/away score for m01/i);

    await user.click(away);
    await user.keyboard("{ArrowLeft}");
    expect(home).toHaveFocus();
  });

  it("Enter selects the active row for batch action", async () => {
    const user = userEvent.setup();
    const matches = [makeMatch(0), makeMatch(1)];
    const onSave = vi.fn();
    render(
      <BulkScoringGrid
        matches={matches}
        onSaveBatch={onSave}
        onFinalizeBatch={vi.fn()}
      />,
    );
    const home = screen.getAllByLabelText(/home score for m\d+/i)[0];

    await user.click(home);
    // Type a value so the patch buffer has something to commit.
    await user.type(home, "14");
    await user.keyboard("{Enter}");

    // Save batch button reflects the selection count.
    expect(
      screen.getByRole("button", { name: /save batch \(1\)/i }),
    ).not.toBeDisabled();
  });

  it("Shift+Enter selects the row AND advances focus to the next row's home input", async () => {
    const user = userEvent.setup();
    const matches = [makeMatch(0), makeMatch(1)];
    render(
      <BulkScoringGrid
        matches={matches}
        onSaveBatch={vi.fn()}
        onFinalizeBatch={vi.fn()}
      />,
    );
    const homeInputs = screen.getAllByLabelText(/home score for m\d+/i);

    await user.click(homeInputs[0]);
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(homeInputs[1]).toHaveFocus();
    expect(
      screen.getByRole("button", { name: /save batch \(1\)/i }),
    ).not.toBeDisabled();
  });

  it("Esc reverts the active cell's edit (clears the row's draft)", async () => {
    const user = userEvent.setup();
    const matches = [makeMatch(0, { home_shots: 0, away_shots: 0 })];
    render(
      <BulkScoringGrid
        matches={matches}
        onSaveBatch={vi.fn()}
        onFinalizeBatch={vi.fn()}
      />,
    );
    const home = screen.getByLabelText(/home score for m01/i) as HTMLInputElement;

    await user.click(home);
    await user.type(home, "9");
    expect(home.value).toBe("9");

    await user.keyboard("{Escape}");
    // Reverted — back to the empty placeholder state since committed=0
    // and status is not FINAL.
    expect(home.value).toBe("");
  });
});
