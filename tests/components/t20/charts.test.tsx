import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { HandBalanceChart } from "@/components/t20/HandBalanceChart";
import { LengthDistributionChart } from "@/components/t20/LengthDistributionChart";

// Phase 10 — pure-CSS results-view charts (no recharts).

describe("<HandBalanceChart />", () => {
  it("renders both Forehand + Backhand percentage labels", () => {
    const { container } = render(
      <HandBalanceChart forehand={58} backhand={42} />,
    );
    expect(container.textContent).toContain("Forehand");
    expect(container.textContent).toContain("Backhand");
    expect(container.textContent).toContain("58%");
    expect(container.textContent).toContain("42%");
  });

  it("Forehand bar width matches the prop (style.width)", () => {
    const { container } = render(
      <HandBalanceChart forehand={58} backhand={42} />,
    );
    const fore = container.querySelector(
      "[data-slot='hand-balance-fore']",
    ) as HTMLElement;
    expect(fore.style.width).toBe("58%");
  });

  it("Backhand bar width matches the prop", () => {
    const { container } = render(
      <HandBalanceChart forehand={58} backhand={42} />,
    );
    const back = container.querySelector(
      "[data-slot='hand-balance-back']",
    ) as HTMLElement;
    expect(back.style.width).toBe("42%");
  });

  it("zero+zero → empty state with 50/50 muted bar (data-empty='true')", () => {
    const { container } = render(<HandBalanceChart forehand={0} backhand={0} />);
    const bar = container.querySelector("[data-slot='hand-balance-bar']");
    expect(bar?.getAttribute("data-empty")).toBe("true");
    const fore = container.querySelector(
      "[data-slot='hand-balance-fore']",
    ) as HTMLElement;
    const back = container.querySelector(
      "[data-slot='hand-balance-back']",
    ) as HTMLElement;
    expect(fore.style.width).toBe("50%");
    expect(back.style.width).toBe("50%");
  });

  it("non-zero data → data-empty='false'", () => {
    const { container } = render(
      <HandBalanceChart forehand={60} backhand={40} />,
    );
    expect(
      container.querySelector("[data-slot='hand-balance-bar']")?.getAttribute("data-empty"),
    ).toBe("false");
  });
});

describe("<LengthDistributionChart />", () => {
  it("renders one column per data point", () => {
    const { container } = render(
      <LengthDistributionChart
        data={[
          { distance: 23, pct: 78 },
          { distance: 26, pct: 84 },
          { distance: 29, pct: 71 },
          { distance: 32, pct: 58 },
        ]}
      />,
    );
    expect(
      container.querySelectorAll("[data-slot='length-distribution-col']"),
    ).toHaveLength(4);
  });

  it("each column carries data-distance with the metric value", () => {
    const { container } = render(
      <LengthDistributionChart
        data={[
          { distance: 23, pct: 50 },
          { distance: 32, pct: 80 },
        ]}
      />,
    );
    const cols = container.querySelectorAll("[data-slot='length-distribution-col']");
    expect(cols[0].getAttribute("data-distance")).toBe("23");
    expect(cols[1].getAttribute("data-distance")).toBe("32");
  });

  it("renders the percentage label + metric label per column", () => {
    const { container } = render(
      <LengthDistributionChart data={[{ distance: 26, pct: 84 }]} />,
    );
    expect(container.textContent).toContain("84%");
    expect(container.textContent).toContain("26m");
  });

  it("largest pct scales bar to full barHeight; others scale proportionally", () => {
    const { container } = render(
      <LengthDistributionChart
        data={[
          { distance: 23, pct: 50 },
          { distance: 26, pct: 100 },
        ]}
        barHeight={200}
      />,
    );
    const bars = container.querySelectorAll("[data-slot='length-distribution-bar']");
    expect((bars[0] as HTMLElement).style.height).toBe("100px");
    expect((bars[1] as HTMLElement).style.height).toBe("200px");
  });

  it("clamps scale to 100% so all-low data still renders honestly", () => {
    // Max < 100 still uses 100 as the cap so the bars don't visually
    // exaggerate small numbers as if the player is doing well.
    const { container } = render(
      <LengthDistributionChart
        data={[
          { distance: 23, pct: 20 },
          { distance: 26, pct: 30 },
        ]}
        barHeight={100}
      />,
    );
    const bars = container.querySelectorAll("[data-slot='length-distribution-bar']");
    expect((bars[0] as HTMLElement).style.height).toBe("20px");
    expect((bars[1] as HTMLElement).style.height).toBe("30px");
  });

  it("empty data → empty-state placeholder, no columns", () => {
    const { container } = render(<LengthDistributionChart data={[]} />);
    expect(
      container.querySelector("[data-slot='length-distribution-chart']")?.getAttribute("data-empty"),
    ).toBe("true");
    expect(
      container.querySelectorAll("[data-slot='length-distribution-col']"),
    ).toHaveLength(0);
    expect(container.textContent).toContain("No length data");
  });
});
