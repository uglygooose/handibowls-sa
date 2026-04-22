import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";

import { Scoreboard } from "./Scoreboard";

describe("Scoreboard", () => {
  it("renders home and away values", () => {
    const { getByText } = render(
      <Scoreboard home={21} away={18} homeLabel="A" awayLabel="B" />,
    );
    expect(getByText("21")).toBeInTheDocument();
    expect(getByText("18")).toBeInTheDocument();
    expect(getByText("A")).toBeInTheDocument();
    expect(getByText("B")).toBeInTheDocument();
  });

  it("shows end count when provided", () => {
    const { getByText } = render(
      <Scoreboard home={0} away={0} ends={4} totalEnds={21} />,
    );
    expect(getByText(/End 4\/21/)).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <Scoreboard home={10} away={7} homeLabel="Home" awayLabel="Away" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
