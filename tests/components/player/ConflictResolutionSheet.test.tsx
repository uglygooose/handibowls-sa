import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ConflictResolutionSheet } from "@/components/player/ConflictResolutionSheet";

const sampleConflict = {
  match_id: "m-1",
  end_number: 3,
  local: {
    home_shots: 2,
    away_shots: 0,
    localUpdatedAt: "2026-04-29T01:00:00Z",
  },
  server: {
    home_shots: 1,
    away_shots: 1,
    updated_at: "2026-04-29T01:01:00Z",
  },
};

describe("<ConflictResolutionSheet />", () => {
  it("renders nothing when closed", () => {
    render(
      <ConflictResolutionSheet
        open={false}
        onOpenChange={() => {}}
        conflict={sampleConflict}
        onUseMine={() => {}}
        onUseTheirs={() => {}}
        onDispute={() => {}}
      />,
    );
    // Vaul portals when open. Closed → no slot mounts.
    expect(
      document.querySelector("[data-slot='bottom-sheet-content']"),
    ).toBeNull();
  });

  it("renders both sides + the three resolution buttons when open", () => {
    render(
      <ConflictResolutionSheet
        open
        onOpenChange={() => {}}
        conflict={sampleConflict}
        onUseMine={() => {}}
        onUseTheirs={() => {}}
        onDispute={() => {}}
      />,
    );
    expect(screen.getByText("On this phone")).toBeInTheDocument();
    expect(screen.getByText("On the server")).toBeInTheDocument();
    // Both sets of shots are rendered.
    expect(
      screen.getAllByText(/^[0-2]$/).length,
    ).toBeGreaterThanOrEqual(4);
    expect(
      screen.getByRole("button", { name: /use mine/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /use theirs/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /dispute/i }),
    ).toBeInTheDocument();
  });

  it("calls the correct callback for each resolution choice", () => {
    const onUseMine = vi.fn();
    const onUseTheirs = vi.fn();
    const onDispute = vi.fn();
    render(
      <ConflictResolutionSheet
        open
        onOpenChange={() => {}}
        conflict={sampleConflict}
        onUseMine={onUseMine}
        onUseTheirs={onUseTheirs}
        onDispute={onDispute}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /use mine/i }));
    fireEvent.click(screen.getByRole("button", { name: /use theirs/i }));
    fireEvent.click(screen.getByRole("button", { name: /dispute/i }));
    expect(onUseMine).toHaveBeenCalledWith(sampleConflict);
    expect(onUseTheirs).toHaveBeenCalledWith(sampleConflict);
    expect(onDispute).toHaveBeenCalledWith(sampleConflict);
  });

  it("disables all buttons when pending=true", () => {
    render(
      <ConflictResolutionSheet
        open
        onOpenChange={() => {}}
        conflict={sampleConflict}
        onUseMine={() => {}}
        onUseTheirs={() => {}}
        onDispute={() => {}}
        pending
      />,
    );
    for (const name of [/use mine/i, /use theirs/i, /dispute/i]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("disables all buttons when conflict is null", () => {
    render(
      <ConflictResolutionSheet
        open
        onOpenChange={() => {}}
        conflict={null}
        onUseMine={() => {}}
        onUseTheirs={() => {}}
        onDispute={() => {}}
      />,
    );
    for (const name of [/use mine/i, /use theirs/i, /dispute/i]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });
});
