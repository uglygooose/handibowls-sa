import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// `Scorecard.tsx` imports a type from `_data.ts`, which is `"server-only"`.
// Vitest's transpile resolves the import even though only types are
// referenced. Mock the module so the test environment loads cleanly.
vi.mock("server-only", () => ({}));

import { LiveScoringControls } from "@/app/(player)/(gated)/tournaments/[id]/matches/[matchId]/_components/Scorecard";

// Phase 8d — scoring-grid alignment to the design source. The previous
// shape shipped Win 1/2/3 + Lose 1/2/3 buttons that weren't in the design
// AND missed Mark peel + Skip that were. These tests pin the design-
// aligned button set so future drift is caught locally.
//
// Match design source: handibowls/project/player-pages.jsx :: PageScorecard

const baseProps = {
  currentEndNumber: 6,
  pendingHome: 0,
  pendingAway: 0,
  playerIsHome: true,
  homeName: "James Thomas",
  awayName: "Bot Opponent",
  onHomeIncrement: () => {},
  onHomeDecrement: () => {},
  onAwayIncrement: () => {},
  onAwayDecrement: () => {},
  onQuickShot: () => {},
  onConfirmEnd: () => {},
  onPeel: () => {},
  onSkip: () => {},
  wetHands: false,
};

describe("<LiveScoringControls /> — design-aligned button set", () => {
  it("renders 8 quick-shot buttons (1..8) per the design", () => {
    const { container } = render(<LiveScoringControls {...baseProps} />);
    const quickShotsRoot = container.querySelector("[data-slot='quick-shots']");
    expect(quickShotsRoot).not.toBeNull();
    const quickShots = quickShotsRoot!.querySelectorAll("button");
    expect(quickShots).toHaveLength(8);
    for (let i = 1; i <= 8; i++) {
      expect(
        Array.from(quickShots).find((b) => b.textContent?.trim() === String(i)),
      ).toBeTruthy();
    }
  });

  it("renders Mark peel + Skip secondary actions", () => {
    const { container } = render(<LiveScoringControls {...baseProps} />);
    expect(
      container.querySelector("[data-slot='mark-peel']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-slot='skip-end']"),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: /mark peel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^skip$/i })).toBeInTheDocument();
  });

  it("does NOT render Win 1/2/3 or Lose 1/2/3 buttons (Phase 8d alignment — dropped)", () => {
    render(<LiveScoringControls {...baseProps} />);
    for (const n of [1, 2, 3]) {
      expect(
        screen.queryByRole("button", { name: new RegExp(`^win\\s*${n}$`, "i") }),
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: new RegExp(`^lose\\s*${n}$`, "i") }),
      ).toBeNull();
    }
  });

  it("quick-shot tap calls onQuickShot with the correct N", () => {
    const onQuickShot = vi.fn();
    const { container } = render(
      <LiveScoringControls {...baseProps} onQuickShot={onQuickShot} />,
    );
    const quickShots = container.querySelectorAll(
      "[data-slot='quick-shots'] button",
    );
    // Tap "5"
    const five = Array.from(quickShots).find(
      (b) => b.textContent?.trim() === "5",
    )!;
    fireEvent.click(five);
    expect(onQuickShot).toHaveBeenCalledTimes(1);
    expect(onQuickShot).toHaveBeenCalledWith(5);
  });

  it("Mark peel tap calls onPeel; Skip tap calls onSkip", () => {
    const onPeel = vi.fn();
    const onSkip = vi.fn();
    render(
      <LiveScoringControls {...baseProps} onPeel={onPeel} onSkip={onSkip} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /mark peel/i }));
    fireEvent.click(screen.getByRole("button", { name: /^skip$/i }));
    expect(onPeel).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("steppers wire to onHome/onAwayIncrement/Decrement (steppers retained from design)", () => {
    const onHomeIncrement = vi.fn();
    const onAwayDecrement = vi.fn();
    render(
      <LiveScoringControls
        {...baseProps}
        pendingHome={3}
        pendingAway={2}
        onHomeIncrement={onHomeIncrement}
        onAwayDecrement={onAwayDecrement}
      />,
    );
    // EndStepper labels: "You" for home (player_is_home=true), opponent name for away.
    fireEvent.click(screen.getByLabelText(/you increase/i));
    fireEvent.click(screen.getByLabelText(/bot opponent decrease/i));
    expect(onHomeIncrement).toHaveBeenCalledTimes(1);
    expect(onAwayDecrement).toHaveBeenCalledTimes(1);
  });

  it("wet-hands flag toggles the wet-hands rendering on the steppers", () => {
    const { container, rerender } = render(
      <LiveScoringControls {...baseProps} wetHands={false} />,
    );
    const steppersOff = container.querySelectorAll(
      "[data-slot='end-stepper'][data-wet-hands='false']",
    );
    expect(steppersOff.length).toBe(2);
    rerender(<LiveScoringControls {...baseProps} wetHands={true} />);
    const steppersOn = container.querySelectorAll(
      "[data-slot='end-stepper'][data-wet-hands='true']",
    );
    expect(steppersOn.length).toBe(2);
  });
});
