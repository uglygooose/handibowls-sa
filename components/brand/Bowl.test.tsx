import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";

import { Bowl } from "./Bowl";

const MARK_HREF = "/brand/henselite/mark-black.png";

function getMarkHref(container: HTMLElement): string | null {
  const image = container.querySelector("image");
  return (
    image?.getAttribute("href") ??
    image?.getAttribute("xlink:href") ??
    null
  );
}

describe("Bowl — size-gated mark overlay", () => {
  it("does NOT render the Henselite mark below 64 px", () => {
    const { container } = render(<Bowl size={32} />);
    expect(container.querySelector("image")).toBeNull();
  });

  it("does NOT render the mark at 63 px (just below threshold)", () => {
    const { container } = render(<Bowl size={63} />);
    expect(container.querySelector("image")).toBeNull();
  });

  it("renders the Henselite mark at exactly 64 px (threshold)", () => {
    const { container } = render(<Bowl size={64} />);
    expect(getMarkHref(container)).toBe(MARK_HREF);
  });

  it("renders the Henselite mark at large sizes", () => {
    const { container } = render(<Bowl size={620} />);
    expect(getMarkHref(container)).toBe(MARK_HREF);
  });

  it("centres the mark at viewBox (50, 50) with ~30% bowl Ø box", () => {
    const { container } = render(<Bowl size={120} />);
    const image = container.querySelector("image");
    expect(image?.getAttribute("x")).toBe("35");
    expect(image?.getAttribute("y")).toBe("35");
    expect(image?.getAttribute("width")).toBe("30");
    expect(image?.getAttribute("height")).toBe("30");
    expect(image?.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
  });
});

describe("Bowl — base + speckle", () => {
  it("uses var(--color-primary-500) for the bowl base when no themeId", () => {
    const { container } = render(<Bowl size={120} />);
    const baseCircle = container.querySelector('svg > circle[r="48"]');
    expect(baseCircle?.getAttribute("fill")).toBe("var(--color-primary-500)");
  });

  it("uses BOWL_PRESETS swatch hex for the bowl base when themeId is set", () => {
    const { container } = render(<Bowl size={120} themeId="atomic-red" />);
    const baseCircle = container.querySelector('svg > circle[r="48"]');
    expect(baseCircle?.getAttribute("fill")).toBe("#D7261E");
  });

  it("uses ocean-green hex when themeId='ocean-green'", () => {
    const { container } = render(<Bowl size={620} themeId="ocean-green" />);
    const baseCircle = container.querySelector('svg > circle[r="48"]');
    expect(baseCircle?.getAttribute("fill")).toBe("#08BB00");
  });

  it("does NOT render a bone disc behind the mark", () => {
    const { container } = render(<Bowl size={120} />);
    // Old Knockout-Disc design had a bone (#FAFAF7) circle r=28
    // covering the centre. Corrected spec: mark sits directly on the
    // speckled bowl with no disc backing.
    const stale = container.querySelector(
      'circle[fill="#FAFAF7"][r="28"]',
    );
    expect(stale).toBeNull();
  });

  it("does NOT render the original Halo concept's r=29 engraved ring", () => {
    const { container } = render(<Bowl size={120} />);
    // The Phase-15-fix engraved ring sits at r=22. The old Halo &
    // Rest concept's r=29 ring is explicitly NOT rendered.
    const oldRing = container.querySelector('circle[r="29"]');
    expect(oldRing).toBeNull();
  });

  it("renders the bone engraved ring at r=22 around the mark at size >= 64", () => {
    const { container } = render(<Bowl size={120} />);
    const ring = container.querySelector('circle[r="22"]');
    expect(ring).not.toBeNull();
    expect(ring?.getAttribute("stroke")).toBe("#FAFAF7");
    expect(ring?.getAttribute("stroke-opacity")).toBe("0.55");
    expect(ring?.getAttribute("stroke-width")).toBe("0.8");
    expect(ring?.getAttribute("fill")).toBe("none");
  });

  it("does NOT render the engraved ring at size < 64", () => {
    const { container } = render(<Bowl size={48} />);
    const ring = container.querySelector('circle[r="22"]');
    expect(ring).toBeNull();
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

  it("has no axe violations at small size (no mark)", async () => {
    const { container } = render(<Bowl size={48} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations at large size (with mark)", async () => {
    const { container } = render(<Bowl size={120} />);
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
