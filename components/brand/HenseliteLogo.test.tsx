import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";

import { HenseliteLogo, HenseliteLogoMark } from "./HenseliteLogo";

const HENSELITE_HREF = "https://henselite.co.za/";

describe("HenseliteLogo", () => {
  it("renders the colour-variant asset on light surfaces", () => {
    const { getByAltText } = render(<HenseliteLogo variant="colour" />);
    const img = getByAltText("Henselite") as HTMLImageElement;
    expect(img.getAttribute("src")).toContain("henselite-logo.png");
  });

  it("renders the mono-variant asset on dark surfaces", () => {
    const { getByAltText } = render(<HenseliteLogo variant="mono" />);
    const img = getByAltText("Henselite") as HTMLImageElement;
    expect(img.getAttribute("src")).toContain(
      "Henselite-Logo-Black-1024x307.jpg",
    );
  });

  it("wraps in a target=_blank rel=noopener anchor pointing at henselite.co.za", () => {
    const { getByRole } = render(<HenseliteLogo variant="colour" />);
    const anchor = getByRole("link", {
      name: /henselite — opens henselite\.co\.za in a new tab/i,
    }) as HTMLAnchorElement;
    expect(anchor.getAttribute("href")).toBe(HENSELITE_HREF);
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.getAttribute("rel")).toContain("noopener");
    expect(anchor.getAttribute("rel")).toContain("noreferrer");
  });

  it("derives rendered width from source aspect when size is set", () => {
    const { getByAltText } = render(
      <HenseliteLogo variant="colour" size={28} />,
    );
    const img = getByAltText("Henselite") as HTMLImageElement;
    // colour PNG is 373×135 → at height 28, width = round(28 * 373/135) = 77
    expect(img.style.height).toBe("28px");
    expect(img.style.width).toBe("77px");
  });

  it("forwards className for invert filter on dark surfaces", () => {
    const { getByRole } = render(
      <HenseliteLogo variant="mono" className="invert" />,
    );
    const anchor = getByRole("link") as HTMLAnchorElement;
    expect(anchor.className).toContain("invert");
  });

  it("has no axe violations", async () => {
    const { container } = render(<HenseliteLogo variant="colour" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("HenseliteLogoMark", () => {
  it("renders the mono-variant icon-only crop", () => {
    const { getByAltText } = render(<HenseliteLogoMark variant="mono" />);
    const img = getByAltText("Henselite") as HTMLImageElement;
    expect(img.getAttribute("src")).toContain(
      "Henselite-Logo-Black-1024x307.jpg",
    );
  });

  it("renders the colour-variant stacked crop", () => {
    const { getByAltText } = render(<HenseliteLogoMark variant="colour" />);
    const img = getByAltText("Henselite") as HTMLImageElement;
    expect(img.getAttribute("src")).toContain(
      "collection-list-bowls-henselite.webp",
    );
  });

  it("wraps in a link to henselite.co.za by default", () => {
    const { getByRole } = render(<HenseliteLogoMark variant="mono" />);
    const anchor = getByRole("link", {
      name: /henselite — opens henselite\.co\.za in a new tab/i,
    }) as HTMLAnchorElement;
    expect(anchor.getAttribute("href")).toBe(HENSELITE_HREF);
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.getAttribute("rel")).toContain("noopener");
    expect(anchor.getAttribute("rel")).toContain("noreferrer");
  });

  it("renders without an outer anchor when noLink is true (for nesting inside other anchors)", () => {
    const { queryByRole, getByAltText } = render(
      <HenseliteLogoMark variant="mono" noLink />,
    );
    expect(queryByRole("link")).toBeNull();
    expect(getByAltText("Henselite")).toBeInTheDocument();
  });

  it("renders square at the requested size", () => {
    const { container } = render(
      <HenseliteLogoMark variant="mono" size={28} />,
    );
    const wrapper = container.querySelector("span") as HTMLSpanElement;
    expect(wrapper.style.width).toBe("28px");
    expect(wrapper.style.height).toBe("28px");
  });

  it("has no axe violations (with link)", async () => {
    const { container } = render(<HenseliteLogoMark variant="mono" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
