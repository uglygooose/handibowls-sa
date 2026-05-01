import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
let mockSearch = new URLSearchParams();
const mockPathname = "/me/inbox";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => mockSearch,
  usePathname: () => mockPathname,
}));

import { MobileTabBar } from "@/components/layout/MobileTabBar";

// Phase 12.5 / 12.5-1 (audit id `tabs-fork`): smoke + behaviour
// coverage for the unified MobileTabBar primitive.
//
// Cases:
//   1. Renders a tablist with the right ARIA shape (role + label).
//   2. Active item has data-state="active" + the inactive items don't.
//   3. Counting badges render.
//   4. Tapping a non-default tab pushes ?tab=<value>.
//   5. Tapping the first item (default) deletes the tab param.

afterEach(() => {
  cleanup();
  replace.mockReset();
  mockSearch = new URLSearchParams();
});

const ITEMS = [
  { value: "notifications", label: "Notifications", count: 3 },
  { value: "messages", label: "Messages", count: 0 },
];

describe("<MobileTabBar />", () => {
  it("renders a Radix tablist with the supplied aria-label", () => {
    render(
      <MobileTabBar items={ITEMS} active="notifications" ariaLabel="Inbox sections" />,
    );
    const list = screen.getByRole("tablist", { name: "Inbox sections" });
    expect(list).toBeInTheDocument();
    expect(within(list).getAllByRole("tab")).toHaveLength(2);
  });

  it("marks the active item via data-state and aria-selected", () => {
    render(
      <MobileTabBar items={ITEMS} active="notifications" ariaLabel="Inbox sections" />,
    );
    const active = screen.getByRole("tab", { name: /Notifications/ });
    expect(active).toHaveAttribute("data-state", "active");
    expect(active).toHaveAttribute("aria-selected", "true");

    const inactive = screen.getByRole("tab", { name: /Messages/ });
    expect(inactive).toHaveAttribute("data-state", "inactive");
    expect(inactive).toHaveAttribute("aria-selected", "false");
  });

  it("renders the count badge when count is provided", () => {
    render(
      <MobileTabBar items={ITEMS} active="notifications" ariaLabel="Inbox sections" />,
    );
    const tab = screen.getByRole("tab", { name: /Notifications/ });
    expect(within(tab).getByText("3")).toBeInTheDocument();
  });

  it("hides the count badge when count is undefined", () => {
    render(
      <MobileTabBar
        items={[{ value: "a", label: "A" }, { value: "b", label: "B" }]}
        active="a"
        ariaLabel="Test"
      />,
    );
    const tab = screen.getByRole("tab", { name: "A" });
    expect(within(tab).queryByTestId("count-badge")).toBeNull();
  });

  it("pushes ?tab=<value> when a non-default tab is selected", async () => {
    const user = userEvent.setup();
    render(
      <MobileTabBar items={ITEMS} active="notifications" ariaLabel="Inbox sections" />,
    );
    await user.click(screen.getByRole("tab", { name: /Messages/ }));
    expect(replace).toHaveBeenCalledWith("/me/inbox?tab=messages", { scroll: false });
  });

  it("deletes the tab param when the default (first) tab is selected", async () => {
    const user = userEvent.setup();
    mockSearch = new URLSearchParams("tab=messages");
    render(
      <MobileTabBar items={ITEMS} active="messages" ariaLabel="Inbox sections" />,
    );
    await user.click(screen.getByRole("tab", { name: /Notifications/ }));
    expect(replace).toHaveBeenCalledWith("/me/inbox", { scroll: false });
  });

  it("preserves other search params when changing tabs", async () => {
    const user = userEvent.setup();
    mockSearch = new URLSearchParams("page=2&filter=open");
    render(
      <MobileTabBar items={ITEMS} active="notifications" ariaLabel="Inbox sections" />,
    );
    await user.click(screen.getByRole("tab", { name: /Messages/ }));
    // Radix may fire onValueChange more than once per click (focus + click);
    // assert via the most recent call rather than a strict count.
    const url = replace.mock.calls.at(-1)?.[0] as string;
    expect(url).toContain("page=2");
    expect(url).toContain("filter=open");
    expect(url).toContain("tab=messages");
  });

  it("supports a custom paramKey", async () => {
    const user = userEvent.setup();
    render(
      <MobileTabBar
        items={ITEMS}
        active="notifications"
        paramKey="section"
        ariaLabel="Inbox sections"
      />,
    );
    await user.click(screen.getByRole("tab", { name: /Messages/ }));
    expect(replace).toHaveBeenCalledWith("/me/inbox?section=messages", { scroll: false });
  });
});
