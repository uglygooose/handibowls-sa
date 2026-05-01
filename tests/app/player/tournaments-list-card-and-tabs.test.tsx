import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/tournaments",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { TournamentCard } from "@/app/(player)/(gated)/tournaments/_components/TournamentCard";
import { TournamentsTabs } from "@/app/(player)/(gated)/tournaments/_components/TournamentsTabs";
import type { PlayerTournamentRow } from "@/app/(player)/(gated)/tournaments/_data";

// Phase 12.5 / 12.5-6.5 hotfix — pin the two /tournaments fixes:
//
//   • TournamentCard speckle-band height = h-1.5 (6px) per
//     bundle's `.t-card .speckle-band` (player-styles.css:362-369).
//     Pre-hotfix shipped at h-12 (48px = 8× design) which made the
//     entire top portion of every card read as a red background.
//
//   • TournamentsTabs renders MobileTabBar (the 12.5-1 primitive
//     per audit `tabs-fork`), NOT a custom segmented-pill control.
//     Pre-hotfix /tournaments was the only player surface still
//     on a custom tablist (the 12.5-1 closure migrated /me/inbox
//     but left /tournaments).

afterEach(cleanup);

const SAMPLE_TOURNAMENT: PlayerTournamentRow = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Demo Open Singles 2026",
  scope: "club",
  format: "singles",
  status: "open",
  starts_at: "2026-05-15T08:00:00.000+00:00",
  ends_at: "2026-05-15T17:00:00.000+00:00",
  entries_close_at: null,
  entries_count: 12,
  max_entries: 32,
  handicap_rule: "scratch",
  player_has_open_match: false,
};

describe("TournamentCard speckle-band — bundle .t-card contract (12.5-6.5 hotfix)", () => {
  it("renders the speckle-band at h-1.5 (6px), NOT h-12 (48px) — bundle's `.t-card .speckle-band { height: 6px }`", () => {
    const { container } = render(
      <TournamentCard tournament={SAMPLE_TOURNAMENT} variant="entered" />,
    );
    const band = container.querySelector(
      "[data-slot='tournament-card-speckle-band']",
    );
    expect(band).not.toBeNull();
    const cls = band?.className ?? "";
    // 6px tier — Tailwind `h-1.5`. Drift back to `h-12`, `h-10`,
    // `h-8`, etc. fails the regression-pin.
    expect(cls).toContain("h-1.5");
    expect(cls).not.toMatch(/\bh-(2|3|4|5|6|7|8|9|10|11|12)\b/);
  });

  it("speckle-band is positioned absolute top-0 inset-x-0 (top-edge accent only — NOT a content background)", () => {
    const { container } = render(
      <TournamentCard tournament={SAMPLE_TOURNAMENT} variant="entered" />,
    );
    const band = container.querySelector(
      "[data-slot='tournament-card-speckle-band']",
    );
    const cls = band?.className ?? "";
    expect(cls).toContain("absolute");
    expect(cls).toContain("top-0");
    expect(cls).toContain("inset-x-0");
  });
});

describe("TournamentsTabs — consumes MobileTabBar primitive (12.5-6.5 hotfix)", () => {
  it("renders the shared MobileTabBar (Radix Tabs role=tablist + role=tab semantics) — NOT a custom segmented-pill control", () => {
    const { container } = render(
      <TournamentsTabs
        active="entered"
        availableCount={4}
        enteredCount={2}
      />,
    );
    // MobileTabBar uses Radix Tabs which renders role=tablist on the
    // list + role=tab on each trigger. Pre-hotfix the custom control
    // also rendered role=tablist + role=tab — but the inner DOM was
    // a 2-column grid with rounded-xl pills. The bundle-aligned
    // primitive renders flex with border-bottom on the list.
    const tablist = container.querySelector("[role='tablist']");
    expect(tablist).not.toBeNull();
    const cls = tablist?.className ?? "";
    // Bundle .tab-bar has `border-bottom: 1px solid var(--border)`.
    // MobileTabBar's TabsList carries `border-b border-border`.
    // Drift back to a custom segmented-pill component would fail
    // because that wraps the list in `rounded-xl border bg-surface
    // p-1` instead of `border-b border-border`.
    expect(cls).toMatch(/border-b\b/);
    expect(cls).not.toContain("rounded-xl");
  });

  it("renders both tabs with correct labels + count badges (Entered first as URL-default, Available second)", () => {
    const { container } = render(
      <TournamentsTabs
        active="entered"
        availableCount={4}
        enteredCount={2}
      />,
    );
    const tabs = container.querySelectorAll("[role='tab']");
    expect(tabs).toHaveLength(2);
    // Order: entered first (URL-default — "tab" param removed when
    // active), available second.
    expect(tabs[0].textContent).toContain("Entered");
    expect(tabs[0].textContent).toContain("2");
    expect(tabs[1].textContent).toContain("Available");
    expect(tabs[1].textContent).toContain("4");
  });
});
