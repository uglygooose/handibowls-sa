"use client";

import { MobileTabBar } from "@/components/layout/MobileTabBar";

// Phase 8a — URL-state tab switcher for /me/inbox. Mirrors the Phase
// 7a TournamentsList pattern: `router.replace` with shallow params so
// the active tab survives reload + share without polluting history.
//
// Phase 12.5 / 12.5-1: rewritten as a thin wrapper over the shared
// `<MobileTabBar>` primitive. Audit id `tabs-fork` — closes the
// hand-rolled-tablist-vs-shadcn-Tabs fork; same ARIA semantics
// (Radix Tabs handles role=tablist + tab natively + keyboard nav)
// + URL-driven param behaviour preserved (the primitive owns the
// `router.replace` push).

export type InboxTab = "notifications" | "messages";

type Props = {
  active: InboxTab;
  notificationCount: number;
  messageCount: number;
};

export function InboxTabs({ active, notificationCount, messageCount }: Props) {
  return (
    <MobileTabBar
      ariaLabel="Inbox sections"
      active={active}
      paramKey="tab"
      items={[
        { value: "notifications", label: "Notifications", count: notificationCount },
        { value: "messages", label: "Messages", count: messageCount },
      ]}
    />
  );
}
