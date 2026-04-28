import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { OpponentConfirmationCard } from "@/components/player/OpponentConfirmationCard";

describe("<OpponentConfirmationCard />", () => {
  it("shows both scores + your/opp labels", () => {
    render(
      <OpponentConfirmationCard
        yourScore={14}
        opponentScore={21}
        yourLabel="James"
        opponentLabel="Bot Opponent"
        onConfirm={() => {}}
        onDispute={() => {}}
      />,
    );
    expect(screen.getByText("James")).toBeInTheDocument();
    expect(screen.getByText("Bot Opponent")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
  });

  it("calls onConfirm + onDispute on click", () => {
    const onConfirm = vi.fn();
    const onDispute = vi.fn();
    render(
      <OpponentConfirmationCard
        yourScore={14}
        opponentScore={21}
        onConfirm={onConfirm}
        onDispute={onDispute}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm result/i }));
    fireEvent.click(screen.getByRole("button", { name: /dispute/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDispute).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons when pending=true", () => {
    render(
      <OpponentConfirmationCard
        yourScore={14}
        opponentScore={21}
        onConfirm={() => {}}
        onDispute={() => {}}
        pending
      />,
    );
    expect(screen.getByRole("button", { name: /confirm result/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /dispute/i })).toBeDisabled();
  });
});
