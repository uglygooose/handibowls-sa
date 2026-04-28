import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { OfflineSyncBadge } from "@/components/player/OfflineSyncBadge";

describe("<OfflineSyncBadge />", () => {
  it("synced state reads as 'All saved'", () => {
    render(<OfflineSyncBadge state="synced" />);
    expect(screen.getByText("All saved")).toBeInTheDocument();
    expect(screen.getByLabelText(/sync status/i)).toHaveAttribute(
      "data-state",
      "synced",
    );
  });

  it("pending state pluralises the label and surfaces the count", () => {
    render(<OfflineSyncBadge state="pending" pendingCount={3} />);
    expect(screen.getByText("3 ends pending")).toBeInTheDocument();
  });

  it("pending state singularises for a single queued end", () => {
    render(<OfflineSyncBadge state="pending" pendingCount={1} />);
    expect(screen.getByText("1 end pending")).toBeInTheDocument();
  });

  it("error state reads 'Sync error' regardless of count", () => {
    render(<OfflineSyncBadge state="error" pendingCount={2} />);
    expect(screen.getByText("Sync error")).toBeInTheDocument();
  });

  it("renders as a span when no onClick is wired (passive)", () => {
    const { container } = render(<OfflineSyncBadge state="synced" />);
    expect(container.querySelector("span[data-slot='offline-sync-badge']")).not.toBeNull();
  });

  it("renders as a button when onClick is wired (interactive)", () => {
    const onClick = vi.fn();
    render(<OfflineSyncBadge state="error" onClick={onClick} />);
    const btn = screen.getByRole("button", { name: /sync status: sync error/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("missing pending count defaults to zero", () => {
    render(<OfflineSyncBadge state="pending" />);
    expect(screen.getByText("0 ends pending")).toBeInTheDocument();
  });
});
