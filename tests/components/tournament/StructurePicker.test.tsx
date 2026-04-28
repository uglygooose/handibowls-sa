import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StructurePicker } from "@/components/tournament/StructurePicker";

// Knockout + Drawn / Social ship in v1. Round Robin + Sectional are
// rendered locked with a tooltip and never call onChange.

describe("<StructurePicker />", () => {
  it("renders all four structures", () => {
    render(<StructurePicker value="knockout" onChange={vi.fn()} label="Structure" />);
    expect(
      screen.getByRole("radio", { name: /^knockout/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /drawn ?\/ ?social/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /round robin/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /^sectional/i }),
    ).toBeInTheDocument();
  });

  it("exposes a labelled radiogroup", () => {
    render(<StructurePicker value="knockout" onChange={vi.fn()} label="Structure" />);
    expect(
      screen.getByRole("radiogroup", { name: /structure/i }),
    ).toBeInTheDocument();
  });

  it("marks the active structure with aria-checked and data-active", () => {
    render(<StructurePicker value="knockout" onChange={vi.fn()} />);
    const knockout = screen.getByRole("radio", { name: /^knockout/i });
    expect(knockout).toHaveAttribute("aria-checked", "true");
    expect(knockout).toHaveAttribute("data-active", "true");
  });

  it("fires onChange when an enabled structure is picked", async () => {
    const onChange = vi.fn();
    render(<StructurePicker value="knockout" onChange={onChange} />);
    await userEvent.click(
      screen.getByRole("radio", { name: /drawn ?\/ ?social/i }),
    );
    expect(onChange).toHaveBeenCalledWith("drawn_social");
  });

  it.each(["round_robin", "sectional"] as const)(
    "renders %s as locked (disabled, data-locked, tooltip)",
    (id) => {
      render(<StructurePicker value="knockout" onChange={vi.fn()} />);
      const label = id === "round_robin" ? /round robin/i : /^sectional/i;
      const radio = screen.getByRole("radio", { name: label });
      expect(radio).toBeDisabled();
      expect(radio).toHaveAttribute("data-locked", "true");
      expect(radio).toHaveAttribute("aria-disabled", "true");
      expect(radio).toHaveAttribute("title", "Coming in a later release");
    },
  );

  it("does NOT fire onChange when a locked structure is clicked", async () => {
    const onChange = vi.fn();
    render(<StructurePicker value="knockout" onChange={onChange} />);
    await userEvent.click(
      screen.getByRole("radio", { name: /round robin/i }),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("never marks a locked structure as active even if value matches", () => {
    render(<StructurePicker value="round_robin" onChange={vi.fn()} />);
    const rr = screen.getByRole("radio", { name: /round robin/i });
    expect(rr).toHaveAttribute("aria-checked", "false");
    expect(rr).toHaveAttribute("data-active", "false");
  });
});
