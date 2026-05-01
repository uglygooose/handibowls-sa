"use client";

import { MobileTabBar } from "@/components/layout/MobileTabBar";

// Phase 8b — URL-state Available / Entered tab switch for /tournaments.
//
// Phase 12.5 / 12.5-6.5 hotfix (audit id
// `tournaments-tabs-not-on-mobile-tab-bar-primitive`): rewritten as
// a thin wrapper over the shared `<MobileTabBar>` primitive (shipped
// at 12.5-1 / `44bdee4` per audit `tabs-fork`). Pre-hotfix this
// component shipped a custom 2-column segmented-pill control —
// drift from the bundle's `.tab-bar` (player-styles.css:382-398)
// which prescribes a horizontal text-tab + full-width
// border-bottom underline anchor. The 12.5-1 closure migrated
// `/me/inbox` (PageInbox) but left `/tournaments` (PageTournaments)
// on the legacy custom control; visible drift surfaced post-12.5-6.5
// when the sr-only h1 made the unanchored pill control float in
// the middle of the viewport. Mirrors the InboxTabs.tsx wrapper
// pattern.

export type AvailableEnteredTab = "available" | "entered";

type Props = {
  active: AvailableEnteredTab;
  availableCount: number;
  enteredCount: number;
};

export function TournamentsTabs({
  active,
  availableCount,
  enteredCount,
}: Props) {
  // First item's value ("entered") is the URL-default — when active,
  // the `?tab=` search param is removed by MobileTabBar (matches the
  // pre-hotfix custom-control behaviour: the page module also
  // defaults `tabParam !== "available"` to "entered").
  return (
    <MobileTabBar
      ariaLabel="Tournament list filter"
      active={active}
      paramKey="tab"
      items={[
        { value: "entered", label: "Entered", count: enteredCount },
        { value: "available", label: "Available", count: availableCount },
      ]}
    />
  );
}
