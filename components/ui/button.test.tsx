import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";

import { Button } from "./button";

describe("Button", () => {
  it("renders primary/md by default", () => {
    const { getByRole } = render(<Button>Go</Button>);
    const btn = getByRole("button");
    expect(btn).toHaveAttribute("data-variant", "primary");
    expect(btn).toHaveAttribute("data-size", "md");
    expect(btn.className).toContain("h-11");
  });

  it("renders all size variants with correct heights", () => {
    const sizes: Array<["sm" | "md" | "lg" | "xl", string]> = [
      ["sm", "h-9"],
      ["md", "h-11"],
      ["lg", "h-13"],
      ["xl", "h-14"],
    ];
    for (const [size, cls] of sizes) {
      const { getByRole, unmount } = render(<Button size={size}>x</Button>);
      expect(getByRole("button").className).toContain(cls);
      unmount();
    }
  });

  it("matches snapshot for primary button", () => {
    const { container } = render(<Button>Save</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("has no axe violations", async () => {
    const { container } = render(<Button>Label</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
