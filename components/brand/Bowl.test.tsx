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

  it("does NOT render an engraved bone ring", () => {
    const { container } = render(<Bowl size={120} />);
    const ring22 = container.querySelector('circle[r="22"]');
    expect(ring22).toBeNull();
    const ring29 = container.querySelector('circle[r="29"]');
    expect(ring29).toBeNull();
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
