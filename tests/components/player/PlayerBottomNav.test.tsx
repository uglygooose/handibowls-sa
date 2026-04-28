import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

let mockPathname = "/play";

import { PlayerBottomNav } from "@/components/nav/PlayerBottomNav";

describe("<PlayerBottomNav />", () => {
  it("renders all 5 design-spec'd tabs in order: Home, Play, Book, T20, Me", () => {
    mockPathname = "/play";
    render(<PlayerBottomNav />);
    const labels = screen
      .getAllByRole("link")
      .map((a) => a.textContent?.trim());
    expect(labels).toEqual(["Home", "Play", "Book", "T20", "Me"]);
  });

  it("marks the Home tab active on /play", () => {
    mockPathname = "/play";
    render(<PlayerBottomNav />);
    const home = screen.getByRole("link", { name: "Home" });
    expect(home).toHaveAttribute("aria-current", "page");
    expect(home).toHaveAttribute("data-active", "true");
  });

  it("marks the Play tab active on /tournaments and nested routes", () => {
    mockPathname = "/tournaments/abc-123";
    render(<PlayerBottomNav />);
    const play = screen.getByRole("link", { name: "Play" });
    expect(play).toHaveAttribute("aria-current", "page");
  });

  it("marks the Me tab active on /me/inbox (sub-route lives on the Me tab)", () => {
    mockPathname = "/me/inbox";
    render(<PlayerBottomNav />);
    const me = screen.getByRole("link", { name: "Me" });
    expect(me).toHaveAttribute("aria-current", "page");
  });

  it("does not render the unread badge when count is zero", () => {
    mockPathname = "/play";
    const { container } = render(<PlayerBottomNav unreadNotifications={0} />);
    expect(container.querySelector("[data-slot='player-nav-unread-dot']")).toBeNull();
  });

  it("renders the unread badge on the Me tab when count > 0", () => {
    mockPathname = "/play";
    const { container } = render(<PlayerBottomNav unreadNotifications={3} />);
    const badge = container.querySelector("[data-slot='player-nav-unread-dot']");
    expect(badge).not.toBeNull();
    expect(badge).toHaveAttribute("data-unread", "3");
    // Badge is anchored inside the Me tab (decorative — count is exposed via
    // aria on the inbox surface itself, not duplicated in the nav).
    const me = screen.getByRole("link", { name: "Me" });
    expect(me.contains(badge)).toBe(true);
  });

  it("each tab has a 44px+ touch target via flex-fill on a 76px-tall nav", () => {
    mockPathname = "/play";
    render(<PlayerBottomNav />);
    // 76px height × flex-1 split across 5 tabs gives a vertical hit area
    // well above the WCAG 2.2 minimum for primary nav. The class string
    // on each link is what produces this; assert it's present.
    const links = screen.getAllByRole("link");
    for (const link of links) {
      expect(link.className).toContain("flex-1");
    }
  });
});
