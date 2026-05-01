import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StubPage } from "@/components/layout/StubPage";

// Phase 12.5 / 12.5-2 (audit id `stub-page-phase-tag`): smoke
// coverage for the StubPage → EmptyState body rewrite. The
// dev-time `phase` prop was dropped at 12-7 (51db553); this
// test pins the post-12.5-2 contract — body is an EmptyState,
// no "Phase N" leakage.

afterEach(cleanup);

describe("<StubPage />", () => {
  it("renders the title via PageHeader (h1)", () => {
    render(<StubPage title="Tournaments" eyebrow="Platform" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Tournaments" }),
    ).toBeInTheDocument();
  });

  it("renders an EmptyState body — eyebrow + title + body copy", () => {
    render(<StubPage title="Tournaments" eyebrow="Platform" />);
    // EmptyState eyebrow + display-h3
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "This surface is still being built.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/route exists so links \+ redirects work/i),
    ).toBeInTheDocument();
  });

  it("never leaks an internal 'Phase N' tracking string into rendered chrome", () => {
    const { container } = render(
      <StubPage title="Tournaments" eyebrow="Platform" />,
    );
    expect(container.textContent ?? "").not.toMatch(/Phase\s+\d/i);
  });
});
