import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SpeckleField } from "@/components/brand/SpeckleField";

// Phase 12.5 / 12.5-2: pin SpeckleField's two new props from the
// audit (`speckle-seed` + `speckle-intensity-step`). Coverage:
//   - seedKey distinguishes adjacent same-preset patterns
//   - intensity prop maps to the documented (density, opacityScale)
//     pairs (subtle 1.0/1.0 · medium 1.2/1.2 · bold 1.3/1.4)
//   - explicit numeric props win over named intensity (with dev warn)
//   - non-fluid render without seedKey logs a dev warn

afterEach(cleanup);

function patternIdFromSvg(svg: SVGElement): string | null {
  const pattern = svg.querySelector("pattern");
  return pattern?.getAttribute("id") ?? null;
}

describe("SpeckleField · seedKey", () => {
  it("includes the seedKey value in the pattern id", () => {
    const { container } = render(
      <SpeckleField preset="atomic-red" seedKey="card-1" />,
    );
    const id = patternIdFromSvg(container.querySelector("svg")!);
    expect(id).not.toBeNull();
    expect(id).toContain("card-1");
  });

  it("falls back to 'default' in the pattern id when seedKey is omitted", () => {
    const { container } = render(<SpeckleField preset="atomic-red" />);
    const id = patternIdFromSvg(container.querySelector("svg")!);
    expect(id).toContain("default");
  });

  it("renders distinct pattern ids for two adjacent same-preset fields with distinct seedKeys", () => {
    const { container } = render(
      <>
        <SpeckleField preset="ocean-blue" seedKey="a" />
        <SpeckleField preset="ocean-blue" seedKey="b" />
      </>,
    );
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
    const idA = patternIdFromSvg(svgs[0] as SVGElement);
    const idB = patternIdFromSvg(svgs[1] as SVGElement);
    expect(idA).not.toBeNull();
    expect(idB).not.toBeNull();
    expect(idA).not.toBe(idB);
    expect(idA).toContain("a");
    expect(idB).toContain("b");
  });
});

describe("SpeckleField · intensity prop", () => {
  it("maps intensity='subtle' to density 1 / opacityScale 1 in the pattern id", () => {
    const { container } = render(
      <SpeckleField preset="atomic-red" intensity="subtle" seedKey="t" />,
    );
    const id = patternIdFromSvg(container.querySelector("svg")!);
    // patternId shape: speckle-field-<preset>-<density>-<opacityScale>-<seedKey>
    expect(id).toContain("-1-1-t");
  });

  it("maps intensity='medium' to density 1.2 / opacityScale 1.2", () => {
    const { container } = render(
      <SpeckleField preset="atomic-red" intensity="medium" seedKey="t" />,
    );
    const id = patternIdFromSvg(container.querySelector("svg")!);
    expect(id).toContain("-1.2-1.2-t");
  });

  it("maps intensity='bold' to density 1.3 / opacityScale 1.4", () => {
    const { container } = render(
      <SpeckleField preset="atomic-red" intensity="bold" seedKey="t" />,
    );
    const id = patternIdFromSvg(container.querySelector("svg")!);
    expect(id).toContain("-1.3-1.4-t");
  });
});

describe("SpeckleField · explicit numeric props win over intensity", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("uses explicit density + opacityScale when both are provided alongside intensity", () => {
    const { container } = render(
      <SpeckleField
        preset="atomic-red"
        intensity="bold"
        density={0.5}
        opacityScale={0.5}
        seedKey="t"
      />,
    );
    const id = patternIdFromSvg(container.querySelector("svg")!);
    expect(id).toContain("-0.5-0.5-t");
    expect(warn).toHaveBeenCalled();
  });

  it("logs a dev warn when intensity + explicit numeric props are mixed", () => {
    render(
      <SpeckleField
        preset="atomic-red"
        intensity="medium"
        density={0.7}
        seedKey="t"
      />,
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/intensity=/);
  });
});

describe("SpeckleField · non-fluid render warning", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("logs a dev warn when non-fluid (numeric width+height) is rendered without seedKey", () => {
    render(<SpeckleField preset="atomic-red" width={400} height={140} />);
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0]?.[0]).toMatch(/non-fluid/);
  });

  it("does NOT warn when non-fluid render passes a seedKey", () => {
    render(<SpeckleField preset="atomic-red" width={400} height={140} seedKey="ok" />);
    expect(warn).not.toHaveBeenCalled();
  });

  it("does NOT warn when fluid render omits seedKey (defaults to 'default')", () => {
    render(<SpeckleField preset="atomic-red" />);
    expect(warn).not.toHaveBeenCalled();
  });
});
