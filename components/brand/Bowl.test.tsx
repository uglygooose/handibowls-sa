import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";

import { Bowl } from "./Bowl";

const MARK_BLACK = "/brand/henselite/mark-black.png";
const MARK_WHITE = "/brand/henselite/mark-white.png";

function getMarkHref(container: HTMLElement): string | null {
  // svg <image> element. Both `href` and `xlink:href` come through
  // depending on the JSDOM version; testing-library normalises so
  // querying by tagName is the safe path.
  const image = container.querySelector("image");
  return image?.getAttribute("href") ?? image?.getAttribute("xlink:href") ?? null;
}

describe("Bowl — auto variant crossover", () => {
  it("renders knockout disc at size < 64", () => {
    const { container } = render(<Bowl size={48} />);
    // Knockout has a bone disc (r=28) covering the centre — assert
    // by counting circles with that radius.
    const discCircle = container.querySelector('circle[r="28"]');
    expect(discCircle).not.toBeNull();
  });

  it("renders halo & rest at size >= 64", () => {
    const { container } = render(<Bowl size={120} />);
    // Halo has an engraved ring (r=29) on the bowl, no bone disc.
    const ringCircle = container.querySelector('circle[r="29"]');
    expect(ringCircle).not.toBeNull();
    expect(container.querySelector('circle[r="28"]')).toBeNull();
  });

  it("respects explicit variant override below threshold", () => {
    const { container } = render(<Bowl size={48} variant="halo" />);
    expect(container.querySelector('circle[r="29"]')).not.toBeNull();
    expect(container.querySelector('circle[r="28"]')).toBeNull();
  });

  it("respects explicit variant override above threshold", () => {
    const { container } = render(<Bowl size={120} variant="knockout" />);
    expect(container.querySelector('circle[r="28"]')).not.toBeNull();
  });
});

describe("Bowl — colour tone", () => {
  it("renders the black Henselite mark", () => {
    const { container } = render(<Bowl size={48} />);
    expect(getMarkHref(container)).toBe(MARK_BLACK);
  });

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

  it("knockout disc fill is bone (#FAFAF7)", () => {
    const { container } = render(<Bowl size={48} variant="knockout" />);
    const discCircle = container.querySelector('circle[r="28"]');
    expect(discCircle?.getAttribute("fill")).toBe("#FAFAF7");
  });

  it("renders the radial-gradient shine at >= 32 px", () => {
    const { container } = render(<Bowl size={48} />);
    expect(container.querySelector("radialGradient")).not.toBeNull();
    // Shine reference circle (only present when shine renders)
    const shineRef = container.querySelector('circle[fill^="url(#bowl-shine"]');
    expect(shineRef).not.toBeNull();
  });

  it("omits the radial-gradient shine below 32 px", () => {
    const { container } = render(<Bowl size={24} />);
    const shineRef = container.querySelector('circle[fill^="url(#bowl-shine"]');
    expect(shineRef).toBeNull();
  });
});

describe("Bowl — mono tone", () => {
  it("renders the white Henselite mark on dark surfaces", () => {
    const { container } = render(<Bowl size={120} tone="mono" />);
    expect(getMarkHref(container)).toBe(MARK_WHITE);
  });

  it("uses bone (#FAFAF7) for the bowl base", () => {
    const { container } = render(<Bowl size={120} tone="mono" />);
    const baseCircle = container.querySelector('svg > circle[r="48"]');
    expect(baseCircle?.getAttribute("fill")).toBe("#FAFAF7");
  });

  it("flips knockout disc fill to ink (#0A0A0A) so the white mark contrasts", () => {
    const { container } = render(
      <Bowl size={48} tone="mono" variant="knockout" />,
    );
    const discCircle = container.querySelector('circle[r="28"]');
    expect(discCircle?.getAttribute("fill")).toBe("#0A0A0A");
  });

  it("omits the radial-gradient shine and outer rim", () => {
    const { container } = render(<Bowl size={120} tone="mono" />);
    const shineRef = container.querySelector('circle[fill^="url(#bowl-shine"]');
    expect(shineRef).toBeNull();
    // Outer rim (rgba(0,0,0,0.35) stroke) is colour-tone-only
    const rim = container.querySelector(
      'circle[stroke="rgba(0,0,0,0.35)"]',
    );
    expect(rim).toBeNull();
  });
});

describe("Bowl — size + a11y", () => {
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
      <Bowl size={64} ariaLabel="Atomic Red preset swatch" />,
    );
    expect(
      getByRole("img", { name: "Atomic Red preset swatch" }),
    ).toBeInTheDocument();
  });

  it("has no axe violations (colour, knockout)", async () => {
    const { container } = render(<Bowl size={48} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations (mono, halo)", async () => {
    const { container } = render(<Bowl size={120} tone="mono" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Bowl — speckle culling at small sizes", () => {
  it("drops most speckles at size 16 (favicon-end)", () => {
    const { container: small } = render(<Bowl size={16} variant="halo" />);
    const { container: large } = render(<Bowl size={140} variant="halo" />);
    const smallDots = small.querySelectorAll("circle, ellipse").length;
    const largeDots = large.querySelectorAll("circle, ellipse").length;
    expect(smallDots).toBeLessThan(largeDots);
  });
});
