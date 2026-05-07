import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { ShowcaseT20 } from "./ShowcaseT20";

// Phase 15 — co-brand bowl glyph rollout. The compass diagram's
// rest-position dot at (248, 232) now renders as the Henselite mark
// (black variant) instead of the prior three-circle bowl-marker
// stack. The rest of the compass structure — eight wedges, jack at
// centre, grade legend — must stay unchanged.

describe("ShowcaseT20 compass — rest-position dot is the Henselite mark", () => {
  it("renders an <image> at the (248, 232) rest position pointing at mark-black.png", () => {
    const { container } = render(<ShowcaseT20 />);
    const restMark = container.querySelector(
      'image[href="/brand/henselite/mark-black.png"]',
    );
    expect(restMark).not.toBeNull();
    expect(restMark?.getAttribute("x")).toBe("236");
    expect(restMark?.getAttribute("y")).toBe("220");
    expect(restMark?.getAttribute("width")).toBe("24");
    expect(restMark?.getAttribute("height")).toBe("24");
    expect(restMark?.getAttribute("preserveAspectRatio")).toBe(
      "xMidYMid meet",
    );
  });

  it("does NOT render the prior three-circle landed-bowl-marker stack at (248, 232)", () => {
    const { container } = render(<ShowcaseT20 />);
    // The old marker was: r=12 fill=primary-500 + r=3 fill=on-primary,
    // both at cx=248 cy=232. Asserting absence by querying for any
    // circle at that centre.
    const stale = container.querySelector(
      'circle[cx="248"][cy="232"]',
    );
    expect(stale).toBeNull();
  });

  it("preserves the compass structure: jack at centre + 8 wedges + grade rings", () => {
    const { container } = render(<ShowcaseT20 />);
    // Jack — single bone-fill circle at (200, 200)
    const jack = container.querySelector('circle[cx="200"][cy="200"][r="8"]');
    expect(jack).not.toBeNull();
    // Eight zone wedges — each is a <path> inside the compass <svg>
    // (viewBox 0 0 400 400). The decorative SplatterAccent sibling
    // SVG also contains <path> elements, so scope the query to the
    // compass SVG only.
    const compassSvg = container.querySelector('svg[viewBox="0 0 400 400"]');
    expect(compassSvg).not.toBeNull();
    const wedges = compassSvg!.querySelectorAll("path");
    expect(wedges.length).toBe(8);
    // Grade legend swatches — A, B, C, D
    expect(container.textContent).toContain("A · On the jack");
    expect(container.textContent).toContain("B · In zone");
    expect(container.textContent).toContain("C · Off zone");
    expect(container.textContent).toContain("D · No bowl");
  });
});
