import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";

import { Bowl } from "./Bowl";

describe("Bowl — never renders the Henselite mark", () => {
  // Operator decision (post PR #4 review): the Henselite mark overlay
  // floated for big-size bowls read as pasted-on against the existing
  // speckle visual treatment. Bowl is plain speckle, every size.
  const sizes = [16, 28, 32, 48, 64, 120, 220, 620];
  for (const size of sizes) {
    it(`does NOT render an <image> at size ${size}`, () => {
      const { container } = render(<Bowl size={size} />);
      expect(container.querySelector("image")).toBeNull();
    });
  }

  it("does NOT render a bone disc behind anything", () => {
    const { container } = render(<Bowl size={120} />);
    const stale = container.querySelector('circle[fill="#FAFAF7"][r="28"]');
    expect(stale).toBeNull();
  });

  it("does NOT render any of the dropped Halo/Knockout-era rings (r=22, r=29)", () => {
    const { container } = render(<Bowl size={120} />);
    expect(container.querySelector('circle[r="22"]')).toBeNull();
    expect(container.querySelector('circle[r="29"]')).toBeNull();
  });
});

describe("Bowl — engraved jack-target emblem", () => {
  // Restored per operator: the pre-Phase-15 emblem (outer ring r=14,
  // inner ring r=9, centre dot r=2.5, 4 cross lines) renders on big
  // decorative bowls. Reads black on ocean-green / sunburst /
  // white-speckle (preset.on = ink), white on the rest.

  it("renders the outer + inner rings + centre dot at size >= 64", () => {
    const { container } = render(<Bowl size={120} />);
    expect(container.querySelector('circle[r="14"]')).not.toBeNull();
    expect(container.querySelector('circle[r="9"]')).not.toBeNull();
    const dot = container.querySelector('circle[r="2.5"]');
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("fill-opacity")).toBe("0.75");
  });

  it("renders the 4 cross lines connecting the rings at size >= 64", () => {
    const { container } = render(<Bowl size={120} />);
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBe(4);
    // Each line goes from y=50-14 (=36) to y=50-9 (=41), rotated
    // 0/90/180/270 around (50, 50).
    const rotations = Array.from(lines)
      .map((l) => l.getAttribute("transform"))
      .filter(Boolean);
    expect(rotations).toEqual([
      "rotate(0 50 50)",
      "rotate(90 50 50)",
      "rotate(180 50 50)",
      "rotate(270 50 50)",
    ]);
  });

  it("does NOT render the emblem below 64 px", () => {
    const { container } = render(<Bowl size={48} />);
    expect(container.querySelector('circle[r="14"]')).toBeNull();
    expect(container.querySelector('circle[r="9"]')).toBeNull();
    expect(container.querySelector("line")).toBeNull();
  });

  it("uses ink (#0A0A0A) for emblem on ocean-green", () => {
    const { container } = render(<Bowl size={120} themeId="ocean-green" />);
    const outerRing = container.querySelector('circle[r="14"]');
    expect(outerRing?.getAttribute("stroke")).toBe("#0A0A0A");
  });

  it("uses white (#FFFFFF) for emblem on atomic-red", () => {
    const { container } = render(<Bowl size={120} themeId="atomic-red" />);
    const outerRing = container.querySelector('circle[r="14"]');
    expect(outerRing?.getAttribute("stroke")).toBe("#FFFFFF");
  });

  it("uses var(--color-on-primary) for emblem when no themeId (CSS-driven)", () => {
    const { container } = render(<Bowl size={120} />);
    const outerRing = container.querySelector('circle[r="14"]');
    expect(outerRing?.getAttribute("stroke")).toBe("var(--color-on-primary)");
  });
});

describe("Bowl — base + speckle", () => {
  it("uses var(--color-primary-500) for the bowl base when no themeId", () => {
    const { container } = render(<Bowl size={120} />);
    const baseCircle = container.querySelector('svg > circle[r="48"]');
    expect(baseCircle?.getAttribute("fill")).toBe("var(--color-primary-500)");
  });

  it("uses BOWL_PRESETS swatch hex when themeId is set", () => {
    const { container } = render(<Bowl size={120} themeId="atomic-red" />);
    const baseCircle = container.querySelector('svg > circle[r="48"]');
    expect(baseCircle?.getAttribute("fill")).toBe("#D7261E");
  });

  it("uses ocean-green hex when themeId='ocean-green'", () => {
    const { container } = render(<Bowl size={620} themeId="ocean-green" />);
    const baseCircle = container.querySelector('svg > circle[r="48"]');
    expect(baseCircle?.getAttribute("fill")).toBe("#08BB00");
  });
});

describe("Bowl — shine + rim", () => {
  it("renders the radial-gradient shine at >= 32 px", () => {
    const { container } = render(<Bowl size={48} />);
    expect(container.querySelector("radialGradient")).not.toBeNull();
    const shineRef = container.querySelector(
      'circle[fill^="url(#bowl-shine"]',
    );
    expect(shineRef).not.toBeNull();
  });

  it("omits the radial-gradient shine below 32 px", () => {
    const { container } = render(<Bowl size={24} />);
    const shineRef = container.querySelector(
      'circle[fill^="url(#bowl-shine"]',
    );
    expect(shineRef).toBeNull();
  });

  it("renders an outer rim stroke (depth cue)", () => {
    const { container } = render(<Bowl size={120} />);
    const rim = container.querySelector(
      'circle[stroke="rgba(0,0,0,0.35)"]',
    );
    expect(rim).not.toBeNull();
  });
});

describe("Bowl — sizing + a11y", () => {
  it("renders the SVG at the requested size", () => {
    const { container } = render(<Bowl size={64} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("64");
    expect(svg?.getAttribute("height")).toBe("64");
  });

  it("uses the default aria-label 'HandiBowls × Henselite'", () => {
    const { getByRole } = render(<Bowl size={64} />);
    expect(
      getByRole("img", { name: "HandiBowls × Henselite" }),
    ).toBeInTheDocument();
  });

  it("forwards a custom aria-label", () => {
    const { getByRole } = render(
      <Bowl size={120} themeId="atomic-red" ariaLabel="Atomic Red preset swatch" />,
    );
    expect(
      getByRole("img", { name: "Atomic Red preset swatch" }),
    ).toBeInTheDocument();
  });

  it("has no axe violations at small size", async () => {
    const { container } = render(<Bowl size={48} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations at large size", async () => {
    const { container } = render(<Bowl size={620} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Bowl — speckle culling at small sizes", () => {
  it("drops most speckles at 16 px (favicon-end)", () => {
    const { container: small } = render(<Bowl size={16} />);
    const { container: large } = render(<Bowl size={140} />);
    const smallDots = small.querySelectorAll("circle, ellipse").length;
    const largeDots = large.querySelectorAll("circle, ellipse").length;
    expect(smallDots).toBeLessThan(largeDots);
  });
});
