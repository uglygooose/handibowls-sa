import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";

import { HandiBowlsWordmark } from "./HandiBowlsWordmark";

describe("HandiBowlsWordmark", () => {
  it("renders with aria-label and role", () => {
    const { getByRole } = render(<HandiBowlsWordmark />);
    const svg = getByRole("img", { name: /handibowls/i });
    expect(svg).toBeInTheDocument();
  });

  it("matches snapshot", () => {
    const { container } = render(<HandiBowlsWordmark height={48} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("has no axe violations", async () => {
    const { container } = render(<HandiBowlsWordmark />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
