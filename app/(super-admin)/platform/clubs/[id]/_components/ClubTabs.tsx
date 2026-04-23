"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  CLUB_TABS,
  CLUB_TAB_LABELS,
  type ClubTab,
} from "./club-tabs-types";

// ?tab= URL-driven tabstrip. Each tab is a plain <Link>, so tab state survives
// reloads, shares cleanly, and doesn't require client routing logic beyond
// reading the search param. Radix Tabs would duplicate the responsibility.
export function ClubTabs({ active }: { active: ClubTab }) {
  const pathname = usePathname();
  const sp = useSearchParams();

  return (
    <nav
      aria-label="Club sections"
      className="flex w-full overflow-x-auto border-b border-border bg-surface-muted"
      data-slot="club-tabs"
    >
      <ul className="flex min-w-full items-stretch gap-1 px-6">
        {CLUB_TABS.map((tab) => {
          const isActive = tab === active;
          const qs = new URLSearchParams(sp?.toString() ?? "");
          qs.set("tab", tab);
          return (
            <li key={tab}>
              <Link
                href={`${pathname}?${qs.toString()}`}
                aria-current={isActive ? "page" : undefined}
                data-active={isActive ? "true" : undefined}
                data-testid={`tab-${tab}`}
                className={cn(
                  "inline-flex h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-ink-muted hover:text-foreground",
                )}
              >
                {CLUB_TAB_LABELS[tab]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TabPanel({
  tab,
  active,
  children,
}: {
  tab: ClubTab;
  active: ClubTab;
  children: ReactNode;
}) {
  if (tab !== active) return null;
  return (
    <div role="tabpanel" aria-label={CLUB_TAB_LABELS[tab]} className="px-6 py-6">
      {children}
    </div>
  );
}
