import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { LengthDistributionChart } from "@/components/t20/LengthDistributionChart";

// Phase 12.5 / 12.5-6 (M / `length-distribution-chart-brand-decoration`)
// — pin the brand-decoration overlay on each bar. Pre-12.5-6 the
// bars rendered with only the design-source white-to-transparent
// gradient and read as flat colour next to surrounding speckled
// surfaces; this commit added a per-bar SpeckleLayer behind the
// gradient. Both admin /manage/t20/[id] and player
// /t20/[assessmentId] consume the same primitive.

afterEach(cleanup);

describe("<LengthDistributionChart /> — brand decoration", () => {
  it("renders a SpeckleLayer overlay on every bar (each column gets brand decoration)", () => {
    const { container } = render(
      <LengthDistributionChart
        data={[
          { distance: 23, pct: 75 },
          { distance: 26, pct: 60 },
          { distance: 29, pct: 45 },
          { distance: 32, pct: 30 },
        ]}
      />,
    );
    const bars = container.querySelectorAll(
      "[data-slot='length-distribution-bar']",
    );
    expect(bars.length).toBe(4);
    // One speckle layer per bar.
    const speckleWraps = container.querySelectorAll(
      "[data-slot='length-distribution-bar-speckle']",
    );
    expect(speckleWraps.length).toBe(4);
    // Each speckle wrap contains an SVG (SpeckleLayer renders SVG circles).
    speckleWraps.forEach((wrap) => {
      expect(wrap.querySelector("svg")).not.toBeNull();
    });
  });

  it("speckle layer sits BEHIND the gradient (z-0 vs z-1) so the lit-from-above effect still reads", () => {
    const { container } = render(
      <LengthDistributionChart data={[{ distance: 23, pct: 80 }]} />,
    );
    const bar = container.querySelector("[data-slot='length-distribution-bar']");
    const children = Array.from(bar?.children ?? []);
    const speckleIdx = children.findIndex(
      (c) => c.getAttribute("data-slot") === "length-distribution-bar-speckle",
    );
    const gradientIdx = children.findIndex(
      (c) =>
        c.classList.contains("bg-gradient-to-b") &&
        c.getAttribute("data-slot") !== "length-distribution-bar-speckle",
    );
    // Speckle is the first painted layer (z-0); gradient sits on top
    // (z-[1]). DOM order matches the z-index ordering.
    expect(speckleIdx).toBeGreaterThanOrEqual(0);
    expect(gradientIdx).toBeGreaterThan(speckleIdx);
  });

  it("bars are overflow-hidden so the speckle SVG can't escape the rounded-t-[4px] cap", () => {
    const { container } = render(
      <LengthDistributionChart data={[{ distance: 23, pct: 80 }]} />,
    );
    const bar = container.querySelector("[data-slot='length-distribution-bar']");
    expect(bar?.className).toContain("overflow-hidden");
    expect(bar?.className).toContain("rounded-t-[4px]");
  });

  it("empty-data placeholder still renders (no bars, no speckle, dashed-border placeholder)", () => {
    const { container } = render(<LengthDistributionChart data={[]} />);
    const chart = container.querySelector(
      "[data-slot='length-distribution-chart']",
    );
    expect(chart?.getAttribute("data-empty")).toBe("true");
    expect(
      container.querySelector("[data-slot='length-distribution-bar-speckle']"),
    ).toBeNull();
  });
});
