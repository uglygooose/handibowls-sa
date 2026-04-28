import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { WakeLockIndicator } from "@/components/player/WakeLockIndicator";

describe("<WakeLockIndicator />", () => {
  it("renders nothing when inactive (no DOM footprint)", () => {
    const { container } = render(<WakeLockIndicator active={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the badge when active", () => {
    render(<WakeLockIndicator active={true} />);
    expect(screen.getByRole("status", { name: /screen kept awake/i })).toBeInTheDocument();
    expect(screen.getByText("Screen kept on")).toBeInTheDocument();
  });

  it("attaches the active data-state for downstream styling", () => {
    render(<WakeLockIndicator active={true} />);
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "active");
  });
});
