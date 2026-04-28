import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FormatPicker } from "@/components/tournament/FormatPicker";
import type { TournamentFormat } from "@/lib/tournaments/formats";

// All five formats are first-class — Triples is NOT locked (BSA Q9 lock
// honoured per phase brief). Picker fires onChange for every selection
// including the currently-active format (the parent decides whether to
// no-op).

describe("<FormatPicker />", () => {
  function setup(value: TournamentFormat = "singles") {
    const onChange = vi.fn();
    render(
      <FormatPicker value={value} onChange={onChange} label="Format" />,
    );
    return { onChange };
  }

  it("renders all five formats including Triples", () => {
    setup();
    // Anchor "pairs" with ^ to disambiguate from "Mixed Pairs".
    expect(screen.getByRole("radio", { name: /^singles/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^pairs/i })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /^triples/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^fours/i })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /^mixed pairs/i }),
    ).toBeInTheDocument();
  });

  it("exposes role=radiogroup with the provided label", () => {
    setup();
    expect(
      screen.getByRole("radiogroup", { name: /format/i }),
    ).toBeInTheDocument();
  });

  it("marks the active format with aria-checked and data-active", () => {
    setup("triples");
    const triples = screen.getByRole("radio", { name: /^triples/i });
    expect(triples).toHaveAttribute("aria-checked", "true");
    expect(triples).toHaveAttribute("data-active", "true");

    const pairs = screen.getByRole("radio", { name: /^pairs/i });
    expect(pairs).toHaveAttribute("aria-checked", "false");
  });

  it("fires onChange with the selected format id", async () => {
    const { onChange } = setup("singles");
    await userEvent.click(screen.getByRole("radio", { name: /^pairs/i }));
    expect(onChange).toHaveBeenCalledWith("pairs");
  });

  it("disables every option when disabled=true", () => {
    const onChange = vi.fn();
    render(
      <FormatPicker value="singles" onChange={onChange} disabled label="Format" />,
    );
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });

  it("renders shots-up vs ends meta correctly", () => {
    // Singles uses shots-up scoring (unique). Pairs / Triples / Mixed Pairs
    // share the 3-bowls / 18-ends meta — assert there are three of them.
    render(
      <FormatPicker value="singles" onChange={vi.fn()} label="Format" />,
    );
    expect(screen.getByText(/4 bowls · 21 up/i)).toBeInTheDocument();
    expect(screen.getAllByText(/3 bowls · 18 ends/i)).toHaveLength(3);
    expect(screen.getByText(/2 bowls · 15 ends/i)).toBeInTheDocument();
  });
});
