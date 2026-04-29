import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { CompassPicker } from "@/components/t20/CompassPicker";
import { CompassHeatmap } from "@/components/t20/CompassHeatmap";

// Phase 10 — compass picker geometry + interaction contract.

describe("<CompassPicker /> — render shape", () => {
  it("renders 8 wedges with data-zone 1..8", () => {
    const { container } = render(<CompassPicker hand={null} />);
    const wedges = container.querySelectorAll("[data-slot='compass-wedge']");
    expect(wedges).toHaveLength(8);
    const zoneAttrs = Array.from(wedges).map((w) => w.getAttribute("data-zone"));
    expect(zoneAttrs).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  });

  it("interactive mode has 8 transparent tap targets", () => {
    const { container } = render(<CompassPicker hand={null} />);
    expect(
      container.querySelectorAll("[data-slot='compass-target']"),
    ).toHaveLength(8);
  });

  it("readOnly mode renders no tap targets", () => {
    const { container } = render(
      <CompassPicker readOnly hand={null} intensities={{ 1: 0.5 }} />,
    );
    expect(
      container.querySelectorAll("[data-slot='compass-target']"),
    ).toHaveLength(0);
  });

  it("renders the centre jack disc + cardinal labels", () => {
    const { container } = render(<CompassPicker hand={null} />);
    expect(container.textContent).toContain("FRONT");
    expect(container.textContent).toContain("BACK");
    expect(container.textContent).toContain("L");
    expect(container.textContent).toContain("R");
  });

  it("each wedge renders the zone number AND the points pip", () => {
    const { container } = render(<CompassPicker hand={null} />);
    const text = container.textContent ?? "";
    // Zone numbers 1..8.
    for (const z of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(text).toContain(String(z));
    }
    // Default v1 point values for each zone (8, 5, 2, 4, 6, 4, 2, 5).
    expect(text).toContain("8pt");
    expect(text).toContain("5pt");
    expect(text).toContain("2pt");
    expect(text).toContain("4pt");
    expect(text).toContain("6pt");
  });
});

describe("<CompassPicker /> — accessibility", () => {
  it("interactive mode uses role='group' + descriptive aria-label", () => {
    const { container } = render(<CompassPicker hand={null} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("group");
    expect(svg?.getAttribute("aria-label")).toMatch(/Twenty 20 compass/i);
  });

  it("readOnly mode uses role='img' + heatmap label", () => {
    const { container } = render(
      <CompassPicker readOnly hand={null} intensities={{ 1: 0.5 }} />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toMatch(/heatmap/i);
  });

  it("each tap target carries a <title> for hover/SR readout", () => {
    const { container } = render(<CompassPicker hand={null} />);
    const target = container.querySelector(
      "[data-slot='compass-target'][data-zone='1']",
    );
    expect(target?.querySelector("title")?.textContent).toMatch(
      /Zone 1.*Front.*Centre.*8pt/i,
    );
  });
});

describe("<CompassPicker /> — onPick", () => {
  it("clicking a tap target fires onPick with that zone (number)", () => {
    const onPick = vi.fn();
    const { container } = render(
      <CompassPicker onPick={onPick} hand={null} />,
    );
    const target = container.querySelector(
      "[data-slot='compass-target'][data-zone='5']",
    ) as SVGPathElement;
    fireEvent.click(target);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(5);
  });

  it("readOnly tap targets do not exist (cannot fire onPick)", () => {
    const onPick = vi.fn();
    const { container } = render(
      <CompassPicker
        readOnly
        onPick={onPick}
        hand={null}
        intensities={{ 1: 0.5 }}
      />,
    );
    expect(
      container.querySelector("[data-slot='compass-target']"),
    ).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe("<CompassPicker /> — hand badge", () => {
  it("hand='forehand' renders 'Forehand · 28m' badge", () => {
    const { container } = render(<CompassPicker hand="forehand" />);
    const badge = container.querySelector("[data-slot='compass-hand-badge']");
    expect(badge?.getAttribute("data-hand")).toBe("forehand");
    expect(badge?.textContent).toContain("Forehand");
    expect(badge?.textContent).toContain("28m");
  });

  it("hand='backhand' renders 'Backhand · 28m' badge", () => {
    const { container } = render(<CompassPicker hand="backhand" />);
    const badge = container.querySelector("[data-slot='compass-hand-badge']");
    expect(badge?.getAttribute("data-hand")).toBe("backhand");
    expect(badge?.textContent).toContain("Backhand");
  });

  it("hand={null} hides the badge entirely", () => {
    const { container } = render(<CompassPicker hand={null} />);
    expect(
      container.querySelector("[data-slot='compass-hand-badge']"),
    ).toBeNull();
  });
});

describe("<CompassPicker /> — custom zonePoints override", () => {
  it("zonePoints prop overrides the default v1 point values", () => {
    const { container } = render(
      <CompassPicker
        hand={null}
        zonePoints={{ 1: 99, 2: 5, 3: 2, 4: 4, 5: 6, 6: 4, 7: 2, 8: 5 }}
      />,
    );
    expect(container.textContent).toContain("99pt");
  });
});

describe("<CompassHeatmap /> — counts → intensities", () => {
  it("renders read-only compass (no tap targets)", () => {
    const { container } = render(<CompassHeatmap counts={{ 1: 10 }} />);
    expect(
      container.querySelectorAll("[data-slot='compass-target']"),
    ).toHaveLength(0);
  });

  it("zero counts still renders without crashing", () => {
    expect(() => render(<CompassHeatmap counts={{}} />)).not.toThrow();
  });

  it("data-readonly='true' attribute set", () => {
    const { container } = render(<CompassHeatmap counts={{ 1: 5 }} />);
    expect(
      container
        .querySelector("[data-slot='compass-picker']")
        ?.getAttribute("data-readonly"),
    ).toBe("true");
  });
});
