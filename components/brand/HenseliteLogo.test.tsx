import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";

import { HenseliteLogo, HenseliteLogoMark } from "./HenseliteLogo";

const HENSELITE_HREF = "https://henselite.co.za/";
const BLACK_ASSET = "Henselite-Logo-Black-1024x307.jpg";
const FORBIDDEN_GREEN_ASSET = "henselite-logo.png";
const FORBIDDEN_STACKED_ASSET = "collection-list-bowls-henselite.webp";

describe("HenseliteLogo (SA brand standard — always black)", () => {
  it("renders the black horizontal lockup asset", () => {
    const { getByAltText } = render(<HenseliteLogo />);
    const img = getByAltText("Henselite") as HTMLImageElement;
    expect(img.getAttribute("src")).toContain(BLACK_ASSET);
  });

  it("does NOT render the green-icon UK colour variant (henselite-logo.png)", () => {
    const { getByAltText } = render(<HenseliteLogo />);
    const img = getByAltText("Henselite") as HTMLImageElement;
    expect(img.getAttribute("src")).not.toContain(FORBIDDEN_GREEN_ASSET);
  });

  it("wraps in a target=_blank rel=noopener anchor pointing at henselite.co.za", () => {
    const { getByRole } = render(<HenseliteLogo />);
    const anchor = getByRole("link", {
      name: /henselite — opens henselite\.co\.za in a new tab/i,
    }) as HTMLAnchorElement;
    expect(anchor.getAttribute("href")).toBe(HENSELITE_HREF);
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.getAttribute("rel")).toContain("noopener");
    expect(anchor.getAttribute("rel")).toContain("noreferrer");
  });

  it("derives rendered width from the black-lockup source aspect when size is set", () => {
    const { getByAltText } = render(<HenseliteLogo size={28} />);
    const img = getByAltText("Henselite") as HTMLImageElement;
    // black JPG is 1024×307 → at height 28, width = round(28 * 1024/307) = 93
    expect(img.style.height).toBe("28px");
    expect(img.style.width).toBe("93px");
  });

  it("forwards className for invert filter on dark surfaces", () => {
    const { getByRole } = render(<HenseliteLogo className="invert" />);
    const anchor = getByRole("link") as HTMLAnchorElement;
    expect(anchor.className).toContain("invert");
  });

  it("has no axe violations", async () => {
    const { container } = render(<HenseliteLogo />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("HenseliteLogoMark (SA brand standard — always black)", () => {
  it("crops the icon area from the black horizontal lockup", () => {
    const { getByAltText } = render(<HenseliteLogoMark />);
    const img = getByAltText("Henselite") as HTMLImageElement;
    expect(img.getAttribute("src")).toContain(BLACK_ASSET);
  });

  it("does NOT render the stacked colour source (collection-list-bowls-henselite.webp)", () => {
    const { getByAltText } = render(<HenseliteLogoMark />);
    const img = getByAltText("Henselite") as HTMLImageElement;
    expect(img.getAttribute("src")).not.toContain(FORBIDDEN_STACKED_ASSET);
  });

  it("wraps in a link to henselite.co.za by default", () => {
    const { getByRole } = render(<HenseliteLogoMark />);
    const anchor = getByRole("link", {
      name: /henselite — opens henselite\.co\.za in a new tab/i,
    }) as HTMLAnchorElement;
    expect(anchor.getAttribute("href")).toBe(HENSELITE_HREF);
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.getAttribute("rel")).toContain("noopener");
    expect(anchor.getAttribute("rel")).toContain("noreferrer");
  });

  it("renders without an outer anchor when noLink is true (for nesting inside other anchors)", () => {
    const { queryByRole, getByAltText } = render(<HenseliteLogoMark noLink />);
    expect(queryByRole("link")).toBeNull();
    expect(getByAltText("Henselite")).toBeInTheDocument();
  });

  it("renders square at the requested size", () => {
    const { container } = render(<HenseliteLogoMark size={28} />);
    const wrapper = container.querySelector("span") as HTMLSpanElement;
    expect(wrapper.style.width).toBe("28px");
    expect(wrapper.style.height).toBe("28px");
  });

  it("has no axe violations (with link)", async () => {
    const { container } = render(<HenseliteLogoMark />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
