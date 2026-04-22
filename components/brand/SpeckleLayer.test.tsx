import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { SpeckleLayer } from "./SpeckleLayer";

describe("SpeckleLayer", () => {
  it("produces a deterministic SVG for a given seed + density", () => {
    const a = render(<SpeckleLayer seed="match-123" density="med" />);
    const b = render(<SpeckleLayer seed="match-123" density="med" />);
    expect(a.container.innerHTML).toBe(b.container.innerHTML);
  });

  it("renders different output for different seeds", () => {
    const a = render(<SpeckleLayer seed="a" density="med" />);
    const b = render(<SpeckleLayer seed="b" density="med" />);
    expect(a.container.innerHTML).not.toBe(b.container.innerHTML);
  });

  it("has aria-hidden on the SVG (decorative)", () => {
    const { container } = render(<SpeckleLayer seed="x" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("circle count matches the density bucket", () => {
    const low = render(<SpeckleLayer seed="s" density="low" />);
    const high = render(<SpeckleLayer seed="s" density="high" />);
    const lowCount = low.container.querySelectorAll("circle").length;
    const highCount = high.container.querySelectorAll("circle").length;
    expect(lowCount).toBe(60);
    expect(highCount).toBe(120);
  });
});
