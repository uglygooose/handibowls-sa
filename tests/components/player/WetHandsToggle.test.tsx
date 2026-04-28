import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { WetHandsToggle } from "@/components/player/WetHandsToggle";

describe("<WetHandsToggle />", () => {
  it("renders 'Wet hands' when off", () => {
    render(<WetHandsToggle on={false} onToggle={() => {}} />);
    expect(screen.getByRole("switch", { name: /wet hands mode off/i })).toBeInTheDocument();
    expect(screen.getByText("Wet hands")).toBeInTheDocument();
  });

  it("renders 'Wet hands on' when on", () => {
    render(<WetHandsToggle on={true} onToggle={() => {}} />);
    expect(screen.getByRole("switch", { name: /wet hands mode on/i })).toBeInTheDocument();
    expect(screen.getByText("Wet hands on")).toBeInTheDocument();
  });

  it("aria-checked tracks the on prop", () => {
    const { rerender } = render(<WetHandsToggle on={false} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    rerender(<WetHandsToggle on={true} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("data-state reflects the on prop", () => {
    const { rerender } = render(<WetHandsToggle on={false} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "off");
    rerender(<WetHandsToggle on={true} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "on");
  });

  it("calls onToggle on click", () => {
    const onToggle = vi.fn();
    render(<WetHandsToggle on={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
